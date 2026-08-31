import { v4 as uuidv4 } from "uuid";
import { ParsedPDFResult } from "./types";
import dbConnect from "./dbConnect";
import FacilityModel from "./models/Facility";
import ProviderModel from "./models/Provider";
import EMRClientModel from "./models/EMRClient";

function formatHL7Timestamp(date?: Date, includeMs = true): string {
  const d = date || new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  const ms = includeMs ? `.${pad(d.getMilliseconds(), 3)}` : "";
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
    `${ms}${sign}${hours}${minutes}`
  );
}

function formatDateOnly(dateStr: string): string {
  if (!dateStr) return formatHL7Timestamp().substring(0, 8);

  const mdyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    return `${mdyMatch[3]}${mdyMatch[1].padStart(2, "0")}${mdyMatch[2].padStart(2, "0")}`;
  }

  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`;
  }

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
  patientId?: string;
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
  emrClientId?: string;
  isPracticeFusion?: boolean;
}

export function generateHL7(input: HL7GeneratorInput): string {
  const isPF =
    input.isPracticeFusion ||
    input.emrClientId === "practice-fusion" ||
    input.emrClientId?.toLowerCase().includes("practicefusion");

  const dobFormatted = formatDateOnly(input.patientDOB);
  const gender = input.patientGender?.trim() ? input.patientGender.charAt(0).toUpperCase() : "U";

  if (isPF) {
    // ── Practice Fusion 2.5.1 HL7 Format (as in sampleresult.hl7) ─────────
    const pfTimestamp = formatHL7Timestamp(undefined, false);
    const guid = uuidv4();
    const accessionNumber = generateAccessionNumber();

    const fn = (input.patientFirstName || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const ln = (input.patientLastName || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const patientId = input.patientId || (fn && ln ? `${fn}${ln}${dobFormatted}` : "test12");

    const cptCode = input.cptCode || "74018";
    const testDesc = input.testDescription || input.testName || "Abdomen X-Ray";
    const facCompanyId = input.facilityCompanyId || "789917";
    const facName = input.facilityName || "Reliance Imaging";

    const facAddrParts = [input.facilityAddress, input.facilityCity, input.facilityState, input.facilityZip].filter(Boolean);
    const facAddrStr = facAddrParts.length > 0 ? facAddrParts.join("^") : "4337 Lindbergh Drive^Addison^TX^75001";

    const segments: string[] = [];

    // MSH - MSH-4 is static "RI001"
    segments.push(
      `MSH|^~\\&||RI001|PracticeFusion|${facCompanyId}|${pfTimestamp}||ORU^R01^ORU_R01|${guid}|P|2.5.1|||AL|AL|||||LRI_NG_RN_Profile^^2.16.840.1.113883.9.20^ISO`
    );

    // PID
    segments.push(
      `PID|1||${patientId}^^^^MR||${input.patientLastName.toUpperCase()}^${input.patientFirstName.toUpperCase()}||${dobFormatted}|${gender}|||`
    );

    // ORC
    segments.push(
      `ORC|RE|${cptCode}|${accessionNumber}|||||||||${input.physicianNPI}^${input.physicianLastName}^${input.physicianFirstName}`
    );

    // OBR
    segments.push(
      `OBR|1|${cptCode}|${accessionNumber}|${cptCode}^${testDesc}^LN|||${pfTimestamp}|||||||||${input.physicianNPI}^${input.physicianLastName}^${input.physicianFirstName}||||||${pfTimestamp}|||F`
    );

    // OBX
    segments.push(
      `OBX|1|ED|${cptCode}^${testDesc}^CPT||^AP^^Base64^${input.pdfBase64}||||||F|||${pfTimestamp}|||||||||${facName}|${facAddrStr}`
    );

    return segments.join("\r\n") + "\r\n";
  }

  // ── Standard HL7 Version 2.3 Format ─────────────────────────────────────
  const timestamp = formatHL7Timestamp();
  const messageControlId = generateMessageControlId();
  const accessionNumber = generateAccessionNumber();
  const examDateFormatted = formatDateOnly(input.examDate);

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
  const chunks = splitBase64IntoChunks(input.pdfBase64, 300);
  for (const chunk of chunks) {
    segments.push(
      `OBX|2|ED|${input.cptCode}^${input.testDescription}^CPT||${chunk}||||||F`
    );
  }
  return segments.join("\r\n") + "\r\n";
}

export async function buildHL7FromParsedResult(
  parsed: ParsedPDFResult,
  overrides?: Partial<HL7GeneratorInput> & { emrClientId?: string }
): Promise<string> {
  let facility: any = null;
  let emrClient: any = null;
  try {
    await dbConnect();

    // 1. Look up the provider by NPI to get their linked facilityId
    const npi = overrides?.physicianNPI || parsed.referringPhysicianNPI;
    let facilityId: string | undefined;
    if (npi) {
      const provider = await ProviderModel.findOne({ npi }).lean() as any;
      if (provider?.facilityId) {
        facilityId = provider.facilityId;
        console.log(`[buildHL7] Found provider NPI=${npi} -> facilityId="${facilityId}"`);
      }
    }

    // 2. Override facilityId can still be passed explicitly (e.g. from edit form)
    facilityId = overrides?.facilityCompanyId || overrides?.facilityAddress || facilityId;

    // 3. Load the facility record
    if (facilityId) {
      facility = await FacilityModel.findOne({ $or: [{ id: facilityId }, { companyId: facilityId }] }).lean();
    }
    if (!facility && parsed.facilityId) {
      facility = await FacilityModel.findOne({ id: parsed.facilityId }).lean();
    }
    if (!facility) {
      console.warn(`[buildHL7] No facility found for facilityId="${facilityId}" — HL7 facility fields will be empty`);
    }

    // 4. Determine target EMR Client ID
    const targetEmrClientId = overrides?.emrClientId || facility?.emrClientId || "";
    if (targetEmrClientId) {
      emrClient = await EMRClientModel.findOne({ id: targetEmrClientId }).lean();
    }
  } catch (e) {
    console.error("Error querying provider/facility from DB:", e);
  }
  console.log(`[buildHL7] facility:`, facility);
  console.log(`[buildHL7] emrClient:`, emrClient);
  console.log(`[buildHL7] overrides:`, overrides);
  const emrClientId = overrides?.emrClientId || facility?.emrClientId || emrClient?.id || "";
  const isPracticeFusion =
    overrides?.isPracticeFusion ||
    emrClientId.toLowerCase() === "practice-fusion" ||
    emrClientId.toLowerCase().includes("practicefusion") ||
    emrClient?.name?.toLowerCase().includes("practice fusion") ||
    false;

  const input: HL7GeneratorInput = {
    patientLastName: overrides?.patientLastName || parsed.patientLastName,
    patientFirstName: overrides?.patientFirstName || parsed.patientFirstName,
    patientDOB: overrides?.patientDOB || parsed.patientDOB,
    patientGender: overrides?.patientGender || parsed.patientGender || "",
    physicianNPI: overrides?.physicianNPI || parsed.referringPhysicianNPI,
    physicianFirstName:
      overrides?.physicianFirstName || parsed.referringPhysicianFirstName,
    physicianLastName:
      overrides?.physicianLastName || parsed.referringPhysicianLastName,
    physicianCredential:
      overrides?.physicianCredential || parsed.referringPhysicianCredential || "NP",
    facilityCompanyId:
      facility?.companyId || facility?.id || overrides?.facilityCompanyId || "UNKNOWN",
    facilityName:
      facility?.name || overrides?.facilityName || parsed.facilityName || "Unknown Facility",
    facilityAddress: overrides?.facilityAddress || facility?.address || "",
    facilityCity: overrides?.facilityCity || facility?.city || "",
    facilityState: overrides?.facilityState || facility?.state || "",
    facilityZip: overrides?.facilityZip || facility?.zip || "",
    testName: overrides?.testName || parsed.testName,
    testDescription: overrides?.testDescription || parsed.testDescription,
    cptCode: overrides?.cptCode || parsed.cptCode,
    examDate: parsed.examDate,
    pdfBase64: parsed.pdfBase64,
    emrClientId,
    isPracticeFusion,
  };

  return generateHL7(input);
}

