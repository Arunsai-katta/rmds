import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hl7Content, emrType, fileName } = body;
    if (!hl7Content || !emrType) {
      return NextResponse.json({ error: "hl7Content and emrType are required" }, { status: 400 });
    }
    const outputDir = path.join(process.cwd(), "output", emrType);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFileName = fileName || `HL7_${emrType}_${Date.now()}.txt`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, hl7Content, "utf-8");
    return NextResponse.json({ success: true, message: `HL7 saved to ${emrType}`, filePath: outputPath, fileName: outputFileName });
  } catch (err) {
    return NextResponse.json({ error: `Failed: ${err instanceof Error ? err.message : "Unknown"}` }, { status: 500 });
  }
}
