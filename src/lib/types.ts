export interface ProviderFacilityMapping {
  id: string;
  providerId: string;
  facilityId: string;
}

export interface Provider {
  id: string;
  name: string;
  npi: string;
  credential: string;
  firstName: string;
  lastName: string;
  practiceGroup: string;
}

export interface Facility {
  id: string;
  name: string;
  companyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface EMRClient {
  id: string;
  name: string;
  connectionType: "api" | "sftp";
  apiUrl?: string;
  authToken?: string;
  sftpHost?: string;
  sftpPort?: string;
  sftpUser?: string;
  sftpPass?: string;
  sftpFolder?: string;
}

export interface ParsedPDFResult {
  id: string;
  fileName: string;
  patientLastName: string;
  patientFirstName: string;
  patientDOB: string;
  patientGender: string;
  referringPhysicianName: string;
  referringPhysicianNPI: string;
  referringPhysicianCredential: string;
  referringPhysicianFirstName: string;
  referringPhysicianLastName: string;
  facilityName: string;
  facilityId: string;
  testName: string;
  testDescription: string;
  cptCode: string;
  examDate: string;
  pdfBase64: string;
  rawText: string;
  confidence: number;
}

export interface HL7Result {
  id: string;
  parsedData: ParsedPDFResult;
  hl7Content: string;
  emrType: string;
  status: "pending" | "sent" | "failed";
  createdAt: string;
  sentAt?: string;
  // Editable overrides
  overridePhysicianNPI?: string;
  overridePhysicianFirstName?: string;
  overridePhysicianLastName?: string;
  overridePhysicianCredential?: string;
  overrideFacilityId?: string;
  overrideFacilityName?: string;
  overrideTestName?: string;
  overrideTestDescription?: string;
  overrideCptCode?: string;
}
