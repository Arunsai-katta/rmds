import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ResultModel from "@/lib/models/Result";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    // Single result fetch by ID — returns full record including hl7Content
    const id = searchParams.get("id");
    if (id) {
      const result = await ResultModel.findOne({ id }).lean();
      if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(result);
    }

    const status = searchParams.get("status");
    // Support comma-separated values: ?status=pending,failed
    const query = status
      ? { status: { $in: status.split(",").map((s) => s.trim()) } }
      : {};
    // Exclude hl7Content from list queries — large field, loaded on demand
    const results = await ResultModel.find(query, { hl7Content: 0 }).sort({ createdAt: -1 }).lean();
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updated = await ResultModel.findOneAndUpdate({ id }, updates, { new: true });
    if (!updated) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await ResultModel.deleteOne({ id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
