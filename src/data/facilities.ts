export interface Facility {
  id: string;
  name: string;
  companyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export const facilities: Facility[] = [
  {
    id: "fac-001",
    name: "Reliance Imaging",
    companyId: "relianceimaging",
    address: "1666 N Hampton Rd Ste 104",
    city: "Desoto",
    state: "Texas",
    zip: "75115",
  },
  {
    id: "fac-002",
    name: "Restoration of Health Medical Care PLLC",
    companyId: "1991167112",
    address: "",
    city: "",
    state: "Texas",
    zip: "",
  },
  {
    id: "fac-003",
    name: "KHS Geriatrics Inc",
    companyId: "801317",
    address: "",
    city: "",
    state: "Texas",
    zip: "",
  },
  {
    id: "fac-004",
    name: "Mercy Gathogo",
    companyId: "789917",
    address: "",
    city: "",
    state: "Texas",
    zip: "",
  },
  {
    id: "fac-005",
    name: "KJCares PLLC",
    companyId: "marywhitepracti5",
    address: "",
    city: "",
    state: "Texas",
    zip: "",
  },
  {
    id: "fac-006",
    name: "Houston Family Physicians PA",
    companyId: "hfpmdpractice68",
    address: "",
    city: "",
    state: "Texas",
    zip: "",
  },
  {
    id: "fac-007",
    name: "A To Z MD PLLC",
    companyId: "bhavinibenpatel",
    address: "",
    city: "",
    state: "Texas",
    zip: "",
  },
  {
    id: "fac-008",
    name: "Texas Family and Geriatric Clinic",
    companyId: "adeebaakhtarpra",
    address: "",
    city: "",
    state: "Texas",
    zip: "",
  },
];

export function findFacilityByCompanyId(companyId: string): Facility | undefined {
  return facilities.find(
    (f) => f.companyId.toLowerCase() === companyId.toLowerCase()
  );
}

export function findFacilityByName(name: string): Facility | undefined {
  const normalized = name.toUpperCase().trim();
  return facilities.find((f) => {
    return (
      f.name.toUpperCase().includes(normalized) ||
      normalized.includes(f.name.toUpperCase())
    );
  });
}
