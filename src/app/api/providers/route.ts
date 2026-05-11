import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Provider from "@/lib/models/Provider";
import { v4 as uuidv4 } from "uuid";

/* ───────────── GET: Fetch all providers ───────────── */
export async function GET() {
  try {
    await dbConnect();
    const providers = await Provider.find({});
    return NextResponse.json(providers);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}

/* ───────────── POST: Create provider ───────────── */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const newItem = await Provider.create({
      id: `prov-${uuidv4().substring(0, 8)}`,
      ...body,
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create provider" },
      { status: 500 }
    );
  }
}

/* ───────────── PUT: Update provider ───────────── */
export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const updated = await Provider.findOneAndUpdate(
      { id: body.id },
      body,
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update provider" },
      { status: 500 }
    );
  }
}

/* ───────────── DELETE: Delete provider ───────────── */
export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const deleted = await Provider.deleteOne({ id });

    if (deleted.deletedCount === 0) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete provider" },
      { status: 500 }
    );
  }
}