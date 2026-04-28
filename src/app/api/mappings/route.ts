import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ProviderFacilityMapping } from "@/lib/types";

const MAPPINGS_FILE = path.join(process.cwd(), "src", "data", "mappings.json");

function readMappings(): ProviderFacilityMapping[] {
  try {
    const data = fs.readFileSync(MAPPINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeMappings(mappings: ProviderFacilityMapping[]): void {
  fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2), "utf-8");
}

export async function GET() {
  const mappings = readMappings();
  return NextResponse.json({ mappings });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { providerId, facilityId } = body;

  if (!providerId || !facilityId) {
    return NextResponse.json(
      { error: "providerId and facilityId are required" },
      { status: 400 }
    );
  }

  const mappings = readMappings();

  // Check for duplicate
  const exists = mappings.find(
    (m) => m.providerId === providerId && m.facilityId === facilityId
  );
  if (exists) {
    return NextResponse.json(
      { error: "Mapping already exists" },
      { status: 409 }
    );
  }

  const newMapping: ProviderFacilityMapping = {
    id: `map-${uuidv4().substring(0, 8)}`,
    providerId,
    facilityId,
  };

  mappings.push(newMapping);
  writeMappings(mappings);

  return NextResponse.json({ mapping: newMapping }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, providerId, facilityId } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const mappings = readMappings();
  const idx = mappings.findIndex((m) => m.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  if (providerId) mappings[idx].providerId = providerId;
  if (facilityId) mappings[idx].facilityId = facilityId;

  writeMappings(mappings);

  return NextResponse.json({ mapping: mappings[idx] });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const mappings = readMappings();
  const filtered = mappings.filter((m) => m.id !== id);

  if (filtered.length === mappings.length) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  writeMappings(filtered);

  return NextResponse.json({ success: true });
}
