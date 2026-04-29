import { NextRequest, NextResponse } from "next/server";
import { buildParsedPDFResult } from "@/lib/pdf-parser";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, ocrText, pdfBase64 } = body;

    if (!fileName || !ocrText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const parsed = await buildParsedPDFResult(
      fileName,
      ocrText,
      pdfBase64 || ""
    );

    return NextResponse.json({ result: parsed });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
