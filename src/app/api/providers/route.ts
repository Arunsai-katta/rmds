import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const FILE_PATH = path.join(process.cwd(), "src", "data", "providers.json");

function readData() {
  try { return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8")); }
  catch { return []; }
}
function writeData(data: any) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json(readData());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readData();
  const newItem = { id: `prov-${uuidv4().substring(0, 8)}`, ...body };
  data.push(newItem);
  writeData(data);
  return NextResponse.json(newItem, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const data = readData();
  const idx = data.findIndex((item: any) => item.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data[idx] = { ...data[idx], ...body };
  writeData(data);
  return NextResponse.json(data[idx]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const data = readData();
  const filtered = data.filter((item: any) => item.id !== id);
  writeData(filtered);
  return NextResponse.json({ success: true });
}
