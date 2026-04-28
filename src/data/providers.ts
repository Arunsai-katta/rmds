export interface Provider {
  id: string;
  name: string;
  npi: string;
  credential: string;
  firstName: string;
  lastName: string;
  practiceGroup: string;
}

export const providers: Provider[] = [
  {
    id: "prov-001",
    name: "Vera Arrington NP",
    npi: "1881167112",
    credential: "NP",
    firstName: "VERA",
    lastName: "ARRINGTON",
    practiceGroup: "Reliance",
  },
  {
    id: "prov-002",
    name: "Seleina Kirorei NP",
    npi: "1427390442",
    credential: "NP",
    firstName: "SELEINA",
    lastName: "KIROREI",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-003",
    name: "Priscilla Boahemaa NP",
    npi: "1598125718",
    credential: "NP",
    firstName: "PRISCILLA",
    lastName: "BOAHEMAA",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-004",
    name: "Chidiogo Ebenmelu NP",
    npi: "1306318712",
    credential: "NP",
    firstName: "CHIDIOGO",
    lastName: "EBENMELU",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-005",
    name: "Carolyne Kimelimbaraka NP",
    npi: "1861932253",
    credential: "NP",
    firstName: "CAROLYNE",
    lastName: "KIMELIMBARAKA",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-006",
    name: "Latoya Cains NP",
    npi: "1912515602",
    credential: "NP",
    firstName: "LATOYA",
    lastName: "CAINS",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-007",
    name: "Elsie Umoh NP",
    npi: "1215803648",
    credential: "NP",
    firstName: "ELSIE",
    lastName: "UMOH",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-008",
    name: "Ann Agbor NP",
    npi: "1043062763",
    credential: "NP",
    firstName: "ANN",
    lastName: "AGBOR",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-009",
    name: "Marquita Pickens NP",
    npi: "1588279525",
    credential: "NP",
    firstName: "MARQUITA",
    lastName: "PICKENS",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-010",
    name: "Joy Isebor NP",
    npi: "1265072995",
    credential: "NP",
    firstName: "JOY",
    lastName: "ISEBOR",
    practiceGroup: "KHS Geriatrics",
  },
  {
    id: "prov-011",
    name: "Bharat Latthe MD",
    npi: "1922050186",
    credential: "MD",
    firstName: "BHARAT",
    lastName: "LATTHE",
    practiceGroup: "Reliance",
  },
  {
    id: "prov-012",
    name: "Mercy Gathogo NP",
    npi: "1235592536",
    credential: "NP",
    firstName: "MERCY",
    lastName: "GATHOGO",
    practiceGroup: "Mercy Gathogo",
  },
  {
    id: "prov-013",
    name: "Kwanei Holloway NP",
    npi: "1972345213",
    credential: "NP",
    firstName: "KWANEI",
    lastName: "HOLLOWAY",
    practiceGroup: "KJ Cares",
  },
  {
    id: "prov-014",
    name: "Ahmad Tabbara NP",
    npi: "1568134054",
    credential: "NP",
    firstName: "AHMAD",
    lastName: "TABBARA",
    practiceGroup: "KJ Cares",
  },
  {
    id: "prov-015",
    name: "Mary Kaburu NP",
    npi: "1316327026",
    credential: "NP",
    firstName: "MARY",
    lastName: "KABURU",
    practiceGroup: "KJ Cares",
  },
  {
    id: "prov-016",
    name: "Nadhifa Nyenzi NP",
    npi: "1437915428",
    credential: "NP",
    firstName: "NADHIFA",
    lastName: "NYENZI",
    practiceGroup: "KJ Cares",
  },
  {
    id: "prov-017",
    name: "Anjenelle Del Rosario NP",
    npi: "1194460469",
    credential: "NP",
    firstName: "ANJENELLE",
    lastName: "DEL ROSARIO",
    practiceGroup: "KJ Cares",
  },
  {
    id: "prov-018",
    name: "Khoa Nguyen MD",
    npi: "1437146966",
    credential: "MD",
    firstName: "KHOA",
    lastName: "NGUYEN",
    practiceGroup: "Houston Family Physicians",
  },
  {
    id: "prov-019",
    name: "Adeeba Akhtar MD",
    npi: "1447264429",
    credential: "MD",
    firstName: "ADEEBA",
    lastName: "AKHTAR",
    practiceGroup: "Texas Family and Geriatric Clinic",
  },
  {
    id: "prov-020",
    name: "Bhaviniben Patel MD",
    npi: "1437491727",
    credential: "MD",
    firstName: "BHAVINIBEN",
    lastName: "PATEL",
    practiceGroup: "A to Z Med",
  },
];

export function findProviderByNPI(npi: string): Provider | undefined {
  return providers.find((p) => p.npi === npi);
}

export function findProviderByName(name: string): Provider | undefined {
  const normalized = name.toUpperCase().trim();
  return providers.find((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toUpperCase();
    const reverseName = `${p.lastName} ${p.firstName}`.toUpperCase();
    return (
      fullName === normalized ||
      reverseName === normalized ||
      normalized.includes(p.lastName) && normalized.includes(p.firstName)
    );
  });
}
