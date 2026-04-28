import { findProviderByName } from "@/data/providers";
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

/**
 * Parse text extracted from an RMDS diagnostic report PDF.
 * Handles two known layouts:
 *   Format A (X-Ray): PATIENT NAME:, DATE OF BIRTH:, REFERRING PHYSICIAN:, STUDY:
 *   Format B (Echo):  Patient:, DOB:, Ref Phy:, Diagnosis:
 */
export function parseReportText(text: string): ExtractionResult {
  const result: ExtractionResult = {
    patientLastName: "",
    patientFirstName: "",
    patientDOB: "",
    patientGender: "",
    referringPhysicianName: "",
    facilityName: "",
    testName: "",
    testDescription: "",
    examDate: "",
    confidence: 0,
  };

  let fieldsFound = 0;
  const totalFields = 6; // name, dob, physician, facility, test, exam date

  // === PATIENT NAME ===
  // Format A: "PATIENT NAME: LASTNAME, FIRSTNAME"
  let match = text.match(/PATIENT\s*NAME\s*:\s*([^\n\r]+)/i);
  if (match) {
    const nameParts = match[1].trim().split(",");
    if (nameParts.length >= 2) {
      result.patientLastName = nameParts[0].trim();
      result.patientFirstName = nameParts[1].trim();
      fieldsFound++;
    }
  }
  // Format B: "Patient: Lastname, Firstname"
  if (!result.patientLastName) {
    match = text.match(/Patient\s*:\s*([^\n\r]+)/i);
    if (match) {
      const raw = match[1].trim();
      // May have other fields on same line like "Date:", split by known fields
      const cleaned = raw.split(/\s+Date\s*:/i)[0].trim();
      const nameParts = cleaned.split(",");
      if (nameParts.length >= 2) {
        result.patientLastName = nameParts[0].trim();
        result.patientFirstName = nameParts[1].trim();
        fieldsFound++;
      }
    }
  }

  // === DATE OF BIRTH ===
  match = text.match(/(?:DATE\s*OF\s*BIRTH|DOB)\s*:\s*([\d/\-]+)/i);
  if (match) {
    result.patientDOB = match[1].trim();
    fieldsFound++;
  }

  // === REFERRING PHYSICIAN ===
  // Format A: "REFERRING PHYSICIAN: JOY IDEBOR, NP"
  match = text.match(/REFERRING\s*PHYSICIAN\s*:\s*([^\n\r]+)/i);
  if (match) {
    result.referringPhysicianName = match[1].trim().replace(/,?\s*(NP|MD|DO|PA|RN)\s*$/i, " $1").trim();
    fieldsFound++;
  }
  // Format B: "Ref Phy: Dr. Mary Tang"
  if (!result.referringPhysicianName) {
    match = text.match(/Ref\s*Phy\s*:\s*(?:Dr\.\s*)?([^\n\r]+)/i);
    if (match) {
      result.referringPhysicianName = match[1].trim();
      fieldsFound++;
    }
  }

  // === FACILITY ===
  match = text.match(/FACILITY\s*:\s*([^\n\r]+)/i);
  if (match) {
    result.facilityName = match[1].trim();
    fieldsFound++;
  }
  // Try to extract from header — "Reliance" is always in the header
  if (!result.facilityName) {
    if (text.includes("Reliance Mobile Diagnostic") || text.includes("Reliance Imaging")) {
      result.facilityName = "Reliance Imaging";
      fieldsFound++;
    }
  }

  // === STUDY / TEST NAME ===
  match = text.match(/STUDY\s*:\s*([^\n\r]+)/i);
  if (match) {
    result.testName = match[1].trim();
    fieldsFound++;
  }
  // Try to extract from title-like patterns  
  if (!result.testName) {
    match = text.match(/(?:TWO-DIMENSIONAL|ARTERIAL|VENOUS|RENAL|BREAST|BLADDER)\s+[\w\s]+(?:ECHOCARDIOGRAM|DOPPLER|ULTRASOUND)/i);
    if (match) {
      result.testName = match[0].trim();
      fieldsFound++;
    }
  }

  // === EXAM DATE ===
  match = text.match(/DATE\s*OF\s*EXAM\s*:\s*([\d/\-:\s]+)/i);
  if (match) {
    result.examDate = match[1].trim().split(/\s/)[0]; // Just the date part
    fieldsFound++;
  }
  // Format B: "Date: MM/DD/YYYY"
  if (!result.examDate) {
    match = text.match(/Date\s*:\s*([\d/\-]+)/i);
    if (match) {
      result.examDate = match[1].trim();
      fieldsFound++;
    }
  }

  // === GENDER (try to infer) ===
  // Not in PDF typically, default to U
  result.patientGender = "U";

  // Build test description from CPT lookup
  const cpt = findCPTByKeywords(result.testName || result.testDescription);
  if (cpt) {
    result.testDescription = cpt.description;
    if (!result.testName) result.testName = cpt.shortName;
  } else {
    result.testDescription = result.testName;
  }

  result.confidence = Math.round((fieldsFound / totalFields) * 100);

  return result;
}

export function buildParsedPDFResult(
  fileName: string,
  text: string,
  pdfBase64: string
): ParsedPDFResult {
  const extracted = parseReportText(text);
  const provider = findProviderByName(extracted.referringPhysicianName);
  const cpt = findCPTByKeywords(extracted.testName);

  return {
    id: uuidv4(),
    fileName,
    patientLastName: extracted.patientLastName,
    patientFirstName: extracted.patientFirstName,
    patientDOB: extracted.patientDOB,
    patientGender: extracted.patientGender,
    referringPhysicianName: extracted.referringPhysicianName,
    referringPhysicianNPI: provider?.npi || "",
    referringPhysicianCredential: provider?.credential || "NP",
    referringPhysicianFirstName: provider?.firstName || extracted.referringPhysicianName.split(" ")[0]?.toUpperCase() || "",
    referringPhysicianLastName: provider?.lastName || extracted.referringPhysicianName.split(" ").slice(1).join(" ").toUpperCase() || "",
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
