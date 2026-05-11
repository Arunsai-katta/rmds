import { NextRequest, NextResponse } from "next/server";
import { buildHL7FromParsedResult } from "@/lib/hl7-generator";
import { ParsedPDFResult } from "@/lib/types";
import dbConnect from "@/lib/dbConnect";
import ResultModel from "@/lib/models/Result";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { parsedData, overrides, saveToDb, resultId: existingId } = body as {
      parsedData: ParsedPDFResult;
      overrides?: Record<string, string>;
      saveToDb?: boolean;
      resultId?: string;
    };

    if (!parsedData) {
      return NextResponse.json(
        { error: "parsedData is required" },
        { status: 400 }
      );
    }

    const hl7Content = await buildHL7FromParsedResult(parsedData, overrides);
    const messageId = existingId || `hl7-${uuidv4().substring(0, 12)}`;

    if (saveToDb) {
      await dbConnect();
      const fileName = `${parsedData.patientLastName || "UNKNOWN"}_${parsedData.patientFirstName || "UNKNOWN"}_HL7.txt`;
      if (existingId) {
        // Update existing record (e.g. after edit + regenerate)
        await ResultModel.findOneAndUpdate(
          { id: existingId },
          { parsedData, hl7Content, fileName, status: "pending" }
        );
      } else {
        await ResultModel.create({
          id: messageId,
          parsedData,
          hl7Content,
          fileName,
          status: "pending",
          createdAt: new Date(),
        });
      }
    }

    return NextResponse.json({ hl7Content, messageId });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to generate HL7: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
