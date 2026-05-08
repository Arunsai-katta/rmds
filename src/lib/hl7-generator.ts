import { v4 as uuidv4 } from "uuid";
import { ParsedPDFResult } from "./types";
import dbConnect from "./dbConnect";
import FacilityModel from "./models/Facility";

function formatHL7Timestamp(date?: Date): string {
  const d = date || new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
    `.${pad(d.getMilliseconds(), 3)}${sign}${hours}${minutes}`
  );
}

function formatDateOnly(dateStr: string): string {
  // Convert various date formats to YYYYMMDD
  if (!dateStr) return formatHL7Timestamp().substring(0, 8);

  // Try MM/DD/YYYY
  const mdyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    return `${mdyMatch[3]}${mdyMatch[1].padStart(2, "0")}${mdyMatch[2].padStart(2, "0")}`;
  }

  // Try YYYY-MM-DD
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`;
  }

  // Try YYYYMMDD already
  if (/^\d{8}$/.test(dateStr)) return dateStr;

  return dateStr.replace(/[^0-9]/g, "").substring(0, 8);
}

function generateMessageControlId(): string {
  return uuidv4().replace(/-/g, "").substring(0, 20) + Date.now().toString().substring(5);
}

function generateAccessionNumber(): string {
  return Math.floor(Math.random() * 9000000000 + 1000000000).toString();
}

function splitBase64IntoChunks(base64: string, chunkSize = 100): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.substring(i, i + chunkSize));
  }
  return chunks;
}

export interface HL7GeneratorInput {
  patientLastName: string;
  patientFirstName: string;
  patientDOB: string;
  patientGender: string;
  physicianNPI: string;
  physicianFirstName: string;
  physicianLastName: string;
  physicianCredential: string;
  facilityCompanyId: string;
  facilityName: string;
  facilityAddress: string;
  facilityCity: string;
  facilityState: string;
  facilityZip: string;
  testName: string;
  testDescription: string;
  cptCode: string;
  examDate: string;
  pdfBase64: string;
}

export function generateHL7(input: HL7GeneratorInput): string {
  const timestamp = formatHL7Timestamp();
  const messageControlId = generateMessageControlId();
  const accessionNumber = generateAccessionNumber();
  const examDateFormatted = formatDateOnly(input.examDate);
  const dobFormatted = formatDateOnly(input.patientDOB);
  const gender = input.patientGender?.charAt(0).toUpperCase() || "U";

  const segments: string[] = [];

  // MSH Segment
  segments.push(
    `MSH|^~\\&||||${input.facilityCompanyId}|${timestamp}||ORU^R01|${messageControlId}|D|2.3`
  );

  // PID Segment
  segments.push(
    `PID|||||${input.patientLastName.toUpperCase()}^${input.patientFirstName.toUpperCase()}||${dobFormatted}|${gender}`
  );

  // PV1 Segment
  segments.push(
    `PV1|||||||${input.physicianNPI}^${input.physicianLastName.toUpperCase()}^${input.physicianFirstName.toUpperCase()}^^^^${input.physicianCredential}`
  );

  // OBR Segment
  segments.push(
    `OBR|1|${accessionNumber}|^${input.testName}|^${input.testDescription}|||${examDateFormatted}|||||||${examDateFormatted}||||||||${timestamp}|||F`
  );

  // OBX|1 - Text result with facility info
  const facilityString = `${input.facilityCompanyId.toUpperCase()}^${input.facilityName}^${input.facilityAddress}^${input.facilityCity}^${input.facilityState}^${input.facilityZip}`;
  segments.push(
    `OBX|1|TX|${input.cptCode}^${input.testDescription}^CPT||See Attachment||||||F||||${facilityString}`
  );

  // OBX|2+ - Base64 encoded PDF chunks
  const chunks = splitBase64IntoChunks(input.pdfBase64, 100);
  for (const chunk of chunks) {
    segments.push(
      `OBX|2|ED|${input.cptCode}^${input.testDescription}^CPT||${chunk}||||||F`
    );
  }

  return segments.join("\r\n") + "\r\n";
}

export async function buildHL7FromParsedResult(
  parsed: ParsedPDFResult,
  overrides?: Partial<HL7GeneratorInput>
): Promise<string> {
  let facility: any = null;
  try {
    await dbConnect();
    const searchId = overrides?.facilityCompanyId || parsed.facilityId;
    const searchName = overrides?.facilityName || parsed.facilityName;
    if (searchId) {
      facility = await FacilityModel.findOne({ $or: [{ companyId: searchId }, { id: searchId }] }).lean();
    }
    if (!facility && searchName) {
      facility = await FacilityModel.findOne({ name: searchName }).lean();
    }
  } catch (e) {
    console.error("Error querying facility from DB:", e);
  }

  const input: HL7GeneratorInput = {
    patientLastName: parsed.patientLastName,
    patientFirstName: parsed.patientFirstName,
    patientDOB: parsed.patientDOB,
    patientGender: parsed.patientGender || "U",
    physicianNPI: overrides?.physicianNPI || parsed.referringPhysicianNPI,
    physicianFirstName:
      overrides?.physicianFirstName || parsed.referringPhysicianFirstName,
    physicianLastName:
      overrides?.physicianLastName || parsed.referringPhysicianLastName,
    physicianCredential:
      overrides?.physicianCredential || parsed.referringPhysicianCredential || "NP",
    facilityCompanyId:
      overrides?.facilityCompanyId || facility?.companyId || parsed.facilityId || "UNKNOWN",
    facilityName:
      overrides?.facilityName || facility?.name || parsed.facilityName || "Unknown Facility",
    facilityAddress: overrides?.facilityAddress || facility?.address || "",
    facilityCity: overrides?.facilityCity || facility?.city || "",
    facilityState: overrides?.facilityState || facility?.state || "",
    facilityZip: overrides?.facilityZip || facility?.zip || "",
    testName: overrides?.testName || parsed.testName,
    testDescription: overrides?.testDescription || parsed.testDescription,
    cptCode: overrides?.cptCode || parsed.cptCode,
    examDate: parsed.examDate,
    pdfBase64: parsed.pdfBase64,
  };

  return generateHL7(input);
}
