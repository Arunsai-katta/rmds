import { NextRequest, NextResponse } from "next/server";
import { buildHL7FromParsedResult } from "@/lib/hl7-generator";
import { ParsedPDFResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { parsedData, overrides } = body as {
      parsedData: ParsedPDFResult;
      overrides?: Record<string, string>;
    };

    if (!parsedData) {
      return NextResponse.json(
        { error: "parsedData is required" },
        { status: 400 }
      );
    }

    const hl7Content = buildHL7FromParsedResult(parsedData, overrides);

    return NextResponse.json({
      hl7Content,
      messageId: `hl7-${Date.now()}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to generate HL7: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
