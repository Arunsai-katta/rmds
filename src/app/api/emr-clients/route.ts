import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/dbConnect";
import EMRClient from "@/lib/models/EMRClient";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  await dbConnect();
  const clients = await EMRClient.find({});
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const body = await req.json();
  const newItem = await EMRClient.create({ id: `emr-${uuidv4().substring(0, 8)}`, ...body });
  return NextResponse.json(newItem, { status: 201 });
}

export async function PUT(req: NextRequest) {
  await dbConnect();
  const body = await req.json();
  const updated = await EMRClient.findOneAndUpdate({ id: body.id }, body, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await EMRClient.deleteOne({ id });
  return NextResponse.json({ success: true });
}
