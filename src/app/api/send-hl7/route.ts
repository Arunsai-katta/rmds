import { NextRequest, NextResponse } from "next/server";
import SFTPClient from "ssh2-sftp-client";
import dbConnect from "@/lib/dbConnect";
import EMRClientModel from "@/lib/models/EMRClient";
import ResultModel from "@/lib/models/Result";
import { v4 as uuidv4 } from "uuid";

/* ── SFTP upload ─────────────────────────────────────────────────────────── */
async function sftpUpload(clientConfig: any, content: string, remotePath: string): Promise<void> {
  const sftp = new SFTPClient();
  sftp.on("error", (err: Error) => console.error("[sftp] connection error:", err));

  const connectSettings: Record<string, unknown> = {
    host: clientConfig.sftpHost,
    port: parseInt(clientConfig.sftpPort || "22", 10),
    username: clientConfig.sftpUser,
    password: clientConfig.sftpPass,
    retries: 2,
  };

  let connected = false;
  try {
    await sftp.connect(connectSettings);
    connected = true;
    console.log(`[send-hl7] SFTP connected -> uploading to ${remotePath}`);
    await sftp.put(Buffer.from(content, "utf-8"), remotePath);
    sftp.end();
  } catch (err) {
    if (connected) sftp.end();
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("permission denied") || msg.toLowerCase().includes("all auth methods failed")) {
      throw new Error(
        `SFTP authentication failed for "${clientConfig.sftpUser}"@${clientConfig.sftpHost}:${clientConfig.sftpPort || 22}. ` +
        `Verify the credentials saved on this EMR client record.`
      );
    }
    throw err;
  }
}

/* ── API send (Practice Fusion style) ───────────────────────────────────── */
async function apiSend(client: any, content: string): Promise<void> {
  const cleaned = content
    .replace(/\r/g, "\n")
    .replace(/^\u000b/, "")
    .replace(/\u001c$/, "");

  // Ensure MSH-10 Message Control ID is fresh and unique right before sending
  const lines = cleaned.split(/\r\n|\r|\n/);
  const updatedLines = lines.map((l) => {
    if (l.startsWith("MSH|")) {
      const parts = l.split("|");
      if (parts.length >= 10) {
        parts[9] = uuidv4(); // Fresh GUID for MSH-10 Message Control ID
      }
      return parts.join("|");
    }
    return l;
  });
  const finalPayload = updatedLines.join("\r\n");

  const res = await fetch(client.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(client.authToken ? { Authorization: client.authToken } : {}),
    },
    body: finalPayload,
  });

  if (!res.ok) {
    throw new Error(`API responded with HTTP ${res.status}`);
  }

  const responseText = await res.text();
  console.log(`[send-hl7] EMR ACK Response:\n${responseText}`);

  // Split ACK response on \r\n, \r, or \n (HL7 standard uses \r segment terminators)
  const segments = responseText.split(/\r\n|\r|\n/).map((s) => s.trim()).filter(Boolean);
  const msaSegment = segments.find((s) => s.startsWith("MSA|"));
  const errSegment = segments.find((s) => s.startsWith("ERR|"));

  if (!msaSegment) {
    throw new Error(`EMR response missing MSA segment: ${responseText}`);
  }

  const msaFields = msaSegment.split("|");
  const ackCode = (msaFields[1] || "").toUpperCase();

  // Success codes: CA (Commit Accept), AA (Application Accept)
  const isSuccess = (ackCode === "CA" || ackCode === "AA") && !errSegment;

  if (!isSuccess) {
    let errorDetail = "";
    if (errSegment) {
      const errFields = errSegment.split("|");
      errorDetail = errFields[7] || errFields[8] || errFields[3] || errSegment;
    } else {
      errorDetail = `MSA code: ${ackCode || "unknown"}`;
    }
    throw new Error(`EMR rejected result: ${errorDetail}`);
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

    const client = await EMRClientModel.findOne({ id: emrType }).lean() as any;
    if (!client) {
      return NextResponse.json({ error: "EMR client not found" }, { status: 404 });
    }

    const resolvedFileName = (
      fileName || `HL7_${emrType}_${Date.now()}.txt`
    ).replace(/\s+/g, "_");

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
        const folder = (client.sftpFolder || ".").replace(/\/$/, "");
        const remotePath = `${folder}/${resolvedFileName}`;
        console.log(`[send-hl7] SFTP -> ${client.sftpUser}@${client.sftpHost}:${client.sftpPort || 22}${remotePath}`);
        await sftpUpload(client, hl7Content, remotePath);
      } else {
        console.log(`[send-hl7] API -> ${client.apiUrl} (auth: ${client.authToken ? "present" : "none"})`);
        await apiSend(client, hl7Content);
      }
    } catch (deliveryErr) {
      const errMsg = deliveryErr instanceof Error ? deliveryErr.message : String(deliveryErr);
      console.error(`[send-hl7] Delivery failed for "${client.name}" (${client.connectionType}): ${errMsg}`);
      await ResultModel.findOneAndUpdate(
        { id: dbResultId },
        { status: "failed", error: errMsg }
      );
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

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

/* ── GET /api/send-hl7?id=... ───────────────────────────────────────────── */
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
