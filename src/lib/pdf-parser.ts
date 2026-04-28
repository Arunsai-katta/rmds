import { findCPTByKeywords } from "@/data/cpt-codes";
import { ParsedPDFResult } from "./types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

interface ExtractionResult {
  patientLastName: string;
  patientFirstName: string;
  patientDOB: string;
  patientGender: string;
  referringPhysicianName: string;
  referringPhysicianFirst: string;
  referringPhysicianLast: string;
  referringPhysicianCred: string;
  facilityName: string;
  testName: string;
  testDescription: string;
  examDate: string;
  confidence: number;
}

export function parseReportText(text: string, fileName: string = ""): ExtractionResult {
  const result: ExtractionResult = {
    patientLastName: "", patientFirstName: "", patientDOB: "", patientGender: "U",
    referringPhysicianName: "", referringPhysicianFirst: "", referringPhysicianLast: "", referringPhysicianCred: "",
    facilityName: "", testName: "", testDescription: "",
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
    if (lines[0].includes(",")) {
      const parts = lines[0].split(",");
      result.patientLastName = parts[0].trim();
      result.patientFirstName = parts[1].trim();
    }
  }

  // FALLBACK for empty PDFs using filename: "LASTNAME, FIRSTNAME TESTNAME.pdf"
  if (!result.patientLastName && fileName) {
    const cleanName = fileName.replace(/\.pdf$/i, "");
    const commaIndex = cleanName.indexOf(",");
    if (commaIndex > -1) {
      result.patientLastName = cleanName.substring(0, commaIndex).trim();
      const rest = cleanName.substring(commaIndex + 1).trim();
      const parts = rest.split(" ");
      if (parts.length > 0) {
        result.patientFirstName = parts[0].trim();
        result.testName = parts.slice(1).join(" ").trim();
      }
    }
  }

  // DOB
  match = text.match(/(?:DATE\s*OF\s*BIRTH|DOB)\s*:\s*([\d/\-]+)/i);
  if (match) { result.patientDOB = match[1].trim(); fieldsFound++; }

  // PHYSICIAN
  // Match "REFERRING PHYSICIAN: BOAHEMAA, PRISCILLA NP" or "Ref Phy: Dr. Mary Tang"
  match = text.match(/(?:REFERRING\s*PHYSICIAN|Ref\s*Phy)\s*:\s*(?:Dr\.\s*)?([^\n\r]+)/i);
  if (match) { 
    let rawPhy = match[1].trim();
    result.referringPhysicianName = rawPhy;
    fieldsFound++; 
    
    // Extract credentials if present (NP, MD, DO, PA, RN)
    const credMatch = rawPhy.match(/\b(NP|MD|DO|PA|RN|FNP)\b/i);
    if (credMatch) {
      result.referringPhysicianCred = credMatch[1].toUpperCase();
      rawPhy = rawPhy.replace(/\b(NP|MD|DO|PA|RN|FNP)\b/ig, "").replace(/,\s*$/, "").trim();
    }

    // Determine First/Last name
    if (rawPhy.includes(",")) {
      // Format: LASTNAME, FIRSTNAME
      const parts = rawPhy.split(",");
      result.referringPhysicianLast = parts[0].trim();
      result.referringPhysicianFirst = parts[1].trim();
    } else {
      // Format: FIRSTNAME LASTNAME
      const parts = rawPhy.split(/\s+/);
      if (parts.length > 1) {
        result.referringPhysicianLast = parts.pop() || "";
        result.referringPhysicianFirst = parts.join(" ");
      } else {
        result.referringPhysicianLast = rawPhy;
      }
    }
  }

  // FACILITY
  match = text.match(/FACILITY\s*:\s*([^\n\r]+)/i);
  if (match) { result.facilityName = match[1].trim(); fieldsFound++; }
  else if (text.includes("Reliance Mobile Diagnostic") || text.includes("Reliance Imaging")) {
    result.facilityName = "Reliance Imaging"; fieldsFound++;
  }

  // STUDY
  if (!result.testName) {
    match = text.match(/STUDY\s*:\s*([^\n\r]+)/i);
    if (match) { result.testName = match[1].trim(); fieldsFound++; }
    else {
      match = text.match(/(?:TWO-DIMENSIONAL|ARTERIAL|VENOUS|RENAL|BREAST|BLADDER)\s+[\w\s]+(?:ECHOCARDIOGRAM|DOPPLER|ULTRASOUND)/i);
      if (match) { result.testName = match[0].trim(); fieldsFound++; }
    }
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
  const extracted = parseReportText(text, fileName);
  const cpt = findCPTByKeywords(extracted.testName);

  // Read providers locally instead of fetching from API url to avoid localhost issues
  let providerMatch = null;
  try {
    const providersPath = path.join(process.cwd(), "src", "data", "providers.json");
    if (fs.existsSync(providersPath)) {
      const providers: any[] = JSON.parse(fs.readFileSync(providersPath, "utf-8"));
      
      const extLast = extracted.referringPhysicianLast.toUpperCase();
      const extFirst = extracted.referringPhysicianFirst.toUpperCase();
      
      // Match by exact last name first
      if (extLast) {
        providerMatch = providers.find(p => p.lastName.toUpperCase() === extLast);
        
        // If multiple with same last name, try to match first name
        if (!providerMatch && extFirst) {
          providerMatch = providers.find(p => p.lastName.toUpperCase() === extLast && p.firstName.toUpperCase().includes(extFirst));
        }
      }
      
      // Fallback: match by checking if provider last name is anywhere in the raw extracted string
      if (!providerMatch && extracted.referringPhysicianName) {
        const searchName = extracted.referringPhysicianName.toUpperCase();
        providerMatch = providers.find(p => searchName.includes(p.lastName.toUpperCase()));
      }
    }
  } catch (e) {
    console.error("Error reading providers.json:", e);
  }

  return {
    id: uuidv4(),
    fileName,
    patientLastName: extracted.patientLastName,
    patientFirstName: extracted.patientFirstName,
    patientDOB: extracted.patientDOB,
    patientGender: extracted.patientGender,
    referringPhysicianName: extracted.referringPhysicianName,
    referringPhysicianNPI: providerMatch?.npi || "",
    referringPhysicianCredential: providerMatch?.credential || extracted.referringPhysicianCred || "NP",
    referringPhysicianFirstName: providerMatch?.firstName || extracted.referringPhysicianFirst || "",
    referringPhysicianLastName: providerMatch?.lastName || extracted.referringPhysicianLast || "",
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
