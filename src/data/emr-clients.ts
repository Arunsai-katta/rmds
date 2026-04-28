export interface EMRClient {
  id: string;
  name: string;
  description: string;
  color: string;
}

export const emrClients: EMRClient[] = [
  {
    id: "practice-fusion",
    name: "Practice Fusion",
    description: "Practice Fusion EHR - Cloud-based electronic health records",
    color: "#6366f1",
  },
  {
    id: "athena",
    name: "Athena Health",
    description: "Athenahealth - Network-enabled clinical and financial services",
    color: "#06b6d4",
  },
  {
    id: "tebra",
    name: "Tebra",
    description: "Tebra (formerly Kareo + PatientPop) - Practice management",
    color: "#10b981",
  },
  {
    id: "ellkay",
    name: "ELLKAY",
    description: "ELLKAY - Healthcare connectivity and data integration",
    color: "#f59e0b",
  },
  {
    id: "drchrono",
    name: "DrChrono",
    description: "DrChrono EHR - Practice management and medical billing",
    color: "#ef4444",
  },
];

export function findEMRById(id: string): EMRClient | undefined {
  return emrClients.find((c) => c.id === id);
}
