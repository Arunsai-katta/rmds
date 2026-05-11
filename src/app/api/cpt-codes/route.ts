import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import CPTCode from "@/lib/models/CPTCode";

export async function GET() {
  try {
    await dbConnect();
    const codes = await CPTCode.find({}).lean();
    return NextResponse.json(codes);
  } catch {
    return NextResponse.json({ error: "Failed to fetch CPT codes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { code, description, shortName, keywords } = body;

    if (!code || !description) {
      return NextResponse.json(
        { error: "code and description are required" },
        { status: 400 }
      );
    }

    const existing = await CPTCode.findOne({ code });
    if (existing) {
      return NextResponse.json({ error: "CPT code already exists" }, { status: 409 });
    }

    const normalizedKeywords = Array.isArray(keywords)
      ? keywords
      : typeof keywords === "string"
      ? keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
      : [];

    const created = await CPTCode.create({ code, description, shortName, keywords: normalizedKeywords });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create CPT code" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { code, description, shortName, keywords } = body;

    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const normalizedKeywords = Array.isArray(keywords)
      ? keywords
      : typeof keywords === "string"
      ? keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
      : [];

    const updated = await CPTCode.findOneAndUpdate(
      { code },
      { description, shortName, keywords: normalizedKeywords },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "CPT code not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update CPT code" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "code query param is required" }, { status: 400 });
    }

    await CPTCode.deleteOne({ code });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete CPT code" }, { status: 500 });
  }
}
