import { NextRequest, NextResponse } from "next/server";
import { Client as SftpClient } from "ssh2";
import dbConnect from "@/lib/dbConnect";
import EMRClientModel from "@/lib/models/EMRClient";
import ResultModel from "@/lib/models/Result";
import { v4 as uuidv4 } from "uuid";

/* ── SFTP upload ─────────────────────────────────────────────────────────── */
function sftpUpload(client: any, content: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new SftpClient();
    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); return reject(err); }

        const writeStream = sftp.createWriteStream(remotePath);
        writeStream.on("close", () => { conn.end(); resolve(); });
        writeStream.on("error", (e: Error) => { conn.end(); reject(e); });
        writeStream.end(Buffer.from(content, "utf-8"));
      });
    });
    conn.on("error", (err: Error) => {
      // Enrich auth errors with actionable context
      if (err.message?.toLowerCase().includes("permission denied")) {
        reject(new Error(
          `SFTP authentication failed for user "${client.sftpUser}" on ${client.sftpHost}:${client.sftpPort || 22}. ` +
          `Check that the username and password stored for this EMR client are correct, ` +
          `or that the server allows password-based authentication.`
        ));
      } else {
        reject(err);
      }
    });
    conn.connect({
      host: client.sftpHost,
      port: parseInt(client.sftpPort || "22", 10),
      username: client.sftpUser,
      password: client.sftpPass,
      readyTimeout: 20000,
      // Allow both password and keyboard-interactive auth
      authHandler: ["password", "keyboard-interactive"],
    });
  });
}

/* ── API send (Practice Fusion style) ───────────────────────────────────── */
async function apiSend(client: any, content: string): Promise<void> {
  const cleaned = content
    .replace(/\r/g, "\n")
    .replace(/^\u000b/, "")
    .replace(/\u001c$/, "");

  const res = await fetch(client.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(client.authToken ? { Authorization: client.authToken } : {}),
    },
    body: cleaned,
  });

  if (!res.ok) {
    throw new Error(`API responded with HTTP ${res.status}`);
  }

  const responseText = await res.text();
  const segments = responseText.split(/\r?\n/);
  const msaSegment = segments.find((s) => s.startsWith("MSA"));
  const errSegment = segments.find((s) => s.startsWith("ERR"));

  if (!msaSegment || errSegment) {
    throw new Error(`EMR rejected the result${errSegment ? `: ${errSegment}` : ""}`);
  }
}

/* ── POST /api/send-hl7 ──────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    const { hl7Content, emrType, fileName, parsedData, resultId } = body as {
      hl7Content: string;
      emrType: string;
      fileName?: string;
      parsedData?: Record<string, unknown>;
      resultId?: string;
    };

    if (!hl7Content || !emrType) {
      return NextResponse.json(
        { error: "hl7Content and emrType are required" },
        { status: 400 }
      );
    }

    // Resolve EMR client from DB
    const client = await EMRClientModel.findOne({ id: emrType }).lean() as any;
    if (!client) {
      return NextResponse.json(
        { error: "EMR client not found" },
        { status: 404 }
      );
    }

    const resolvedFileName = (
      fileName || `HL7_${emrType}_${Date.now()}.txt`
    ).replace(/\s+/g, "_");

    // Update existing DB record if resultId provided, else create new
    let dbResultId = resultId;
    if (dbResultId) {
      await ResultModel.findOneAndUpdate(
        { id: dbResultId },
        { emrClientId: client.id, fileName: resolvedFileName, status: "pending" }
      );
    } else {
      dbResultId = `res-${uuidv4().substring(0, 12)}`;
      await ResultModel.create({
        id: dbResultId,
        parsedData: parsedData || {},
        hl7Content,
        emrClientId: client.id,
        fileName: resolvedFileName,
        status: "pending",
        createdAt: new Date(),
      });
    }

    try {
      if (client.connectionType === "sftp") {
        const folder = (client.sftpFolder || "/").replace(/\/$/, "");
        const remotePath = `${folder}/${resolvedFileName}`;
        console.log(`[send-hl7] SFTP → ${client.sftpUser}@${client.sftpHost}:${client.sftpPort || 22}${remotePath}`);
        await sftpUpload(client, hl7Content, remotePath);
      } else {
        console.log(`[send-hl7] API → ${client.apiUrl} (auth: ${client.authToken ? "present" : "none"})`);
        await apiSend(client, hl7Content);
      }
    } catch (deliveryErr) {
      const errMsg = deliveryErr instanceof Error ? deliveryErr.message : String(deliveryErr);
      console.error(`[send-hl7] Delivery failed for client "${client.name}" (${client.connectionType}): ${errMsg}`);
      // Mark record as failed and surface the error — do NOT mark as sent
      await ResultModel.findOneAndUpdate(
        { id: dbResultId },
        { status: "failed", error: deliveryErr instanceof Error ? deliveryErr.message : String(deliveryErr) }
      );
      return NextResponse.json(
        { error: deliveryErr instanceof Error ? deliveryErr.message : "Delivery failed" },
        { status: 502 }
      );
    }

    // Only reaches here on successful delivery
    await ResultModel.findOneAndUpdate(
      { id: dbResultId },
      { status: "sent", sentAt: new Date() }
    );

    return NextResponse.json({
      success: true,
      resultId: dbResultId,
      message: `HL7 delivered via ${client.connectionType?.toUpperCase() || "API"}`,
      fileName: resolvedFileName,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

/* ── GET /api/send-hl7?id=… (fetch a saved result) ─────────────────────── */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const query = id ? { id } : {};
    const results = await ResultModel.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
