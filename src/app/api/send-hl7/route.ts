import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const EMR_FILE = path.join(process.cwd(), "src", "data", "emr-clients.json");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hl7Content, emrType, fileName } = body;
    if (!hl7Content || !emrType) {
      return NextResponse.json({ error: "hl7Content and emrType are required" }, { status: 400 });
    }

    let clients = [];
    try { clients = JSON.parse(fs.readFileSync(EMR_FILE, "utf-8")); } catch {}
    const client = clients.find((c: any) => c.id === emrType);

    if (!client) {
       return NextResponse.json({ error: "EMR Client configuration not found" }, { status: 404 });
    }

    const outputDir = path.join(process.cwd(), "output", emrType);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFileName = fileName || `HL7_${emrType}_${Date.now()}.txt`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, hl7Content, "utf-8");

    let connMsg = "";
    if (client.connectionType === "sftp") {
       const folder = client.sftpFolder || "/";
       connMsg = `Simulated SFTP upload to ${client.sftpUser}@${client.sftpHost}:${client.sftpPort} at folder ${folder}`;
    } else {
       const url = client.apiUrl || "unknown endpoint";
       connMsg = `Simulated API push to ${url} with auth token ${client.authToken ? "********" : "None"}`;
    }

    return NextResponse.json({ 
      success: true, 
      message: `HL7 saved locally. ${connMsg}`, 
      filePath: outputPath, 
      fileName: outputFileName 
    });
  } catch (err) {
    return NextResponse.json({ error: `Failed: ${err instanceof Error ? err.message : "Unknown"}` }, { status: 500 });
  }
}
