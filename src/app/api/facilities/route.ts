import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Facility from "@/lib/models/Facility";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  await dbConnect();
  const facilities = await Facility.find({});
  return NextResponse.json(facilities);
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const body = await req.json();
  const newItem = await Facility.create({ id: `fac-${uuidv4().substring(0, 8)}`, ...body });
  return NextResponse.json(newItem, { status: 201 });
}

export async function PUT(req: NextRequest) {
  await dbConnect();
  const body = await req.json();
  const updated = await Facility.findOneAndUpdate({ id: body.id }, body, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await Facility.deleteOne({ id });
  return NextResponse.json({ success: true });
}
