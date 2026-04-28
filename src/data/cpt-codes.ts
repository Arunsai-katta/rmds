/** Common CPT code mappings for imaging/diagnostic studies */
export interface CPTMapping {
  code: string;
  description: string;
  shortName: string;
  keywords: string[];
}

export const cptMappings: CPTMapping[] = [
  { code: "73562", description: "Knee Complete", shortName: "KNEE X-RAY", keywords: ["knee", "x-ray", "xray"] },
  { code: "72100", description: "Spine Lumbar", shortName: "SPINE LUMBAR X-RAY", keywords: ["spine", "lumbar", "x-ray", "xray"] },
  { code: "71046", description: "Chest X-Ray 2 Views", shortName: "CHEST X-RAY", keywords: ["chest", "x-ray", "xray"] },
  { code: "76770", description: "Renal Ultrasound", shortName: "RENAL ULTRASOUND", keywords: ["renal", "ultrasound", "kidney"] },
  { code: "93306", description: "2D Echocardiogram", shortName: "2D ECHOCARDIOGRAM", keywords: ["echo", "echocardiogram", "2d", "cardiac"] },
  { code: "93925", description: "Arterial Doppler Legs", shortName: "ARTERIAL DOPPLER LEGS", keywords: ["arterial", "doppler", "legs", "lower extremity"] },
  { code: "76857", description: "Bladder Ultrasound", shortName: "BLADDER ULTRASOUND", keywords: ["bladder", "ultrasound", "pelvis"] },
  { code: "76641", description: "Breast Ultrasound", shortName: "BREAST ULTRASOUND", keywords: ["breast", "ultrasound"] },
  { code: "74018", description: "Abdomen X-Ray", shortName: "ABDOMEN X-RAY", keywords: ["abdomen", "abdominal", "x-ray", "xray"] },
  { code: "72170", description: "Pelvis X-Ray", shortName: "PELVIS X-RAY", keywords: ["pelvis", "hip", "x-ray", "xray"] },
  { code: "70553", description: "Brain MRI", shortName: "BRAIN MRI", keywords: ["brain", "mri", "head"] },
  { code: "73721", description: "MRI Lower Extremity Joint", shortName: "MRI LEG JOINT", keywords: ["mri", "leg", "joint", "lower extremity"] },
  { code: "93880", description: "Carotid Duplex", shortName: "CAROTID DUPLEX", keywords: ["carotid", "duplex"] },
  { code: "93970", description: "Venous Doppler Legs", shortName: "VENOUS DOPPLER LEGS", keywords: ["venous", "doppler", "legs", "dvt"] },
  { code: "76700", description: "Abdominal Ultrasound Complete", shortName: "ABDOMINAL ULTRASOUND", keywords: ["abdominal", "abdomen", "ultrasound", "complete"] },
];

export function findCPTByKeywords(testName: string): CPTMapping | undefined {
  const normalized = testName.toLowerCase();
  let bestMatch: CPTMapping | undefined;
  let bestScore = 0;

  for (const mapping of cptMappings) {
    let score = 0;
    for (const keyword of mapping.keywords) {
      if (normalized.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = mapping;
    }
  }

  return bestScore > 0 ? bestMatch : undefined;
}
