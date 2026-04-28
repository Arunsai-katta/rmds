import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse");
import { buildParsedPDFResult } from "@/lib/pdf-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No PDF files provided" },
        { status: 400 }
      );
    }

    const results = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfData = await pdf(buffer);
        const pdfBase64 = buffer.toString("base64");

        const parsed = buildParsedPDFResult(
          file.name,
          pdfData.text,
          pdfBase64
        );

        results.push(parsed);
      } catch (err) {
        results.push({
          id: "",
          fileName: file.name,
          error: `Failed to parse: ${err instanceof Error ? err.message : "Unknown error"}`,
          confidence: 0,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
