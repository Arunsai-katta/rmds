import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Mapping from "@/lib/models/Mapping";
import { v4 as uuidv4 } from "uuid";

/* ───────────── GET ───────────── */
export async function GET() {
  try {
    await dbConnect();
    const mappings = await Mapping.find({});
    return NextResponse.json(mappings);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }
}

/* ───────────── POST ───────────── */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { providerId, facilityId } = body;

    if (!providerId || !facilityId) {
      return NextResponse.json(
        { error: "providerId and facilityId are required" },
        { status: 400 }
      );
    }

    const exists = await Mapping.findOne({ providerId, facilityId });
    if (exists) {
      return NextResponse.json({ error: "Mapping already exists" }, { status: 409 });
    }

    const newMapping = await Mapping.create({
      id: `map-${uuidv4().substring(0, 8)}`,
      providerId,
      facilityId,
    });

    return NextResponse.json(newMapping, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create mapping" }, { status: 500 });
  }
}

/* ───────────── PUT ───────────── */
export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { id, providerId, facilityId } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updated = await Mapping.findOneAndUpdate(
      { id },
      { providerId, facilityId },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
  }
}

/* ───────────── DELETE ───────────── */
export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const deleted = await Mapping.deleteOne({ id });

    if (deleted.deletedCount === 0) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete mapping" }, { status: 500 });
  }
}