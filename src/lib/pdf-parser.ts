import { findCPTByKeywords } from "@/data/cpt-codes";
import { ParsedPDFResult } from "./types";
import { v4 as uuidv4 } from "uuid";

interface ExtractionResult {
  patientLastName: string;
  patientFirstName: string;
  patientDOB: string;
  patientGender: string;
  referringPhysicianName: string;
  facilityName: string;
  testName: string;
  testDescription: string;
  examDate: string;
  confidence: number;
}

export function parseReportText(text: string): ExtractionResult {
  const result: ExtractionResult = {
    patientLastName: "", patientFirstName: "", patientDOB: "", patientGender: "U",
    referringPhysicianName: "", facilityName: "", testName: "", testDescription: "",
    examDate: "", confidence: 0,
  };

  let fieldsFound = 0;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // PATIENT NAME
  let match = text.match(/(?:PATIENT\s*NAME|Patient)\s*:\s*([^\n\r]+)/i);
  if (match) {
    const rawName = match[1].split(/Date|DOB/i)[0].trim();
    const parts = rawName.split(",");
    if (parts.length >= 2) {
      result.patientLastName = parts[0].trim();
      result.patientFirstName = parts[1].trim();
      fieldsFound++;
    } else {
      const sp = rawName.split(" ");
      result.patientFirstName = sp[0];
      result.patientLastName = sp.slice(1).join(" ");
      fieldsFound++;
    }
  } else if (lines.length > 0) {
    // Fallback: assume first line might be patient name if it looks like "LAST, FIRST"
    if (lines[0].includes(",")) {
      const parts = lines[0].split(",");
      result.patientLastName = parts[0].trim();
      result.patientFirstName = parts[1].trim();
    }
  }

  // DOB
  match = text.match(/(?:DATE\s*OF\s*BIRTH|DOB)\s*:\s*([\d/\-]+)/i);
  if (match) { result.patientDOB = match[1].trim(); fieldsFound++; }

  // PHYSICIAN
  match = text.match(/(?:REFERRING\s*PHYSICIAN|Ref\s*Phy)\s*:\s*(?:Dr\.\s*)?([^\n\r]+)/i);
  if (match) { 
    result.referringPhysicianName = match[1].replace(/,?\s*(NP|MD|DO|PA|RN)\s*$/i, " $1").trim(); 
    fieldsFound++; 
  }

  // FACILITY
  match = text.match(/FACILITY\s*:\s*([^\n\r]+)/i);
  if (match) { result.facilityName = match[1].trim(); fieldsFound++; }
  else if (text.includes("Reliance Mobile Diagnostic") || text.includes("Reliance Imaging")) {
    result.facilityName = "Reliance Imaging"; fieldsFound++;
  }

  // STUDY
  match = text.match(/STUDY\s*:\s*([^\n\r]+)/i);
  if (match) { result.testName = match[1].trim(); fieldsFound++; }
  else {
    match = text.match(/(?:TWO-DIMENSIONAL|ARTERIAL|VENOUS|RENAL|BREAST|BLADDER)\s+[\w\s]+(?:ECHOCARDIOGRAM|DOPPLER|ULTRASOUND)/i);
    if (match) { result.testName = match[0].trim(); fieldsFound++; }
  }

  // EXAM DATE
  match = text.match(/(?:DATE\s*OF\s*EXAM|Date)\s*:\s*([\d/\-:\s]+)/i);
  if (match) { result.examDate = match[1].trim().split(/\s/)[0]; fieldsFound++; }

  const cpt = findCPTByKeywords(result.testName);
  if (cpt) {
    result.testDescription = cpt.description;
    if (!result.testName) result.testName = cpt.shortName;
  } else {
    result.testDescription = result.testName;
  }

  result.confidence = Math.round((fieldsFound / 6) * 100);
  return result;
}

export async function buildParsedPDFResult(
  fileName: string, text: string, pdfBase64: string
): Promise<ParsedPDFResult> {
  const extracted = parseReportText(text);
  const cpt = findCPTByKeywords(extracted.testName);

  // Fetch dynamic providers to try and match
  let providerMatch = null;
  try {
    const res = await fetch("http://localhost:3000/api/providers");
    if (res.ok) {
      const providers: any[] = await res.json();
      const searchName = extracted.referringPhysicianName.toUpperCase();
      providerMatch = providers.find(p => searchName.includes(p.lastName.toUpperCase()));
    }
  } catch (e) {}

  return {
    id: uuidv4(),
    fileName,
    patientLastName: extracted.patientLastName,
    patientFirstName: extracted.patientFirstName,
    patientDOB: extracted.patientDOB,
    patientGender: extracted.patientGender,
    referringPhysicianName: extracted.referringPhysicianName,
    referringPhysicianNPI: providerMatch?.npi || "",
    referringPhysicianCredential: providerMatch?.credential || "NP",
    referringPhysicianFirstName: providerMatch?.firstName || extracted.referringPhysicianName.split(" ")[0]?.toUpperCase() || "",
    referringPhysicianLastName: providerMatch?.lastName || extracted.referringPhysicianName.split(" ").slice(1).join(" ").toUpperCase() || "",
    facilityName: extracted.facilityName,
    facilityId: "",
    testName: extracted.testName,
    testDescription: extracted.testDescription || extracted.testName,
    cptCode: cpt?.code || "",
    examDate: extracted.examDate,
    pdfBase64,
    rawText: text,
    confidence: extracted.confidence,
  };
}
