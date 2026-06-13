// Epic open sandbox — no auth required for these test patients
const FHIR_BASE = "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";

// Public test patient IDs from Epic sandbox
export const TEST_PATIENTS: Record<string, string> = {
  "john smith": "eJzlzEMQIy4PgqxY6NZJ8hw3",
  "camille lopez": "erXuFYUfucBZaryVksYEcMg3",
  "jessica adams": "eq081-VQEgP8drUUqCWzHfw3",
};

export type FHIRPatient = {
  id: string;
  name: string;
  age: number;
  dob: string;
  gender: string;
  medications: string[];
  conditions: string[];
  careTeam: CareTeamMember[];
};

export type CareTeamMember = {
  id: string;
  name: string;
  role: string;
  phone: string;
};

async function fhirGet(path: string) {
  const res = await fetch(`${FHIR_BASE}/${path}`, {
    headers: { Accept: "application/fhir+json" },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function lookupPatient(nameOrId: string): Promise<FHIRPatient | null> {
  // For demo: map common names to Epic test patient IDs
  const normalized = nameOrId.toLowerCase().trim();
  const patientId = TEST_PATIENTS[normalized] ?? nameOrId;

  try {
    const [patientData, meds, conditions] = await Promise.all([
      fhirGet(`Patient/${patientId}`),
      fhirGet(`MedicationRequest?patient=${patientId}&status=active`),
      fhirGet(`Condition?patient=${patientId}&clinical-status=active`),
    ]);

    if (!patientData) return getMockPatient(nameOrId);

    const name =
      patientData.name?.[0]?.text ??
      `${patientData.name?.[0]?.given?.[0]} ${patientData.name?.[0]?.family}`;

    const dob = patientData.birthDate ?? "unknown";
    const age = dob !== "unknown" ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : 0;

    const medications: string[] =
      meds?.entry?.map(
        (e: any) => e.resource?.medicationCodeableConcept?.text ?? e.resource?.medicationReference?.display ?? "Unknown"
      ) ?? [];

    const conditionList: string[] =
      conditions?.entry?.map((e: any) => e.resource?.code?.text ?? "Unknown") ?? [];

    return {
      id: patientId,
      name,
      age,
      dob,
      gender: patientData.gender ?? "unknown",
      medications,
      conditions: conditionList,
      careTeam: getMockCareTeam(),
    };
  } catch {
    return getMockPatient(nameOrId);
  }
}

// Realistic mock fallback (used when FHIR is unavailable or patient not found)
function getMockPatient(name: string): FHIRPatient {
  return {
    id: "mock-" + Date.now(),
    name: name,
    age: 63,
    dob: "1961-03-15",
    gender: "male",
    medications: ["Amlodipine 10mg", "Metoprolol 50mg", "Aspirin 81mg"],
    conditions: ["Hypertension", "Type 2 Diabetes", "Coronary Artery Disease"],
    careTeam: getMockCareTeam(),
  };
}

function getMockCareTeam(): CareTeamMember[] {
  return [
    {
      id: "dr-chen",
      name: "Dr. Sarah Chen",
      role: "Primary Care Physician",
      phone: process.env.DEMO_DOCTOR_PHONE ?? "+15005550006",
    },
    {
      id: "dr-patel",
      name: "Dr. Raj Patel",
      role: "Cardiologist",
      phone: process.env.DEMO_DOCTOR_PHONE ?? "+15005550006",
    },
    {
      id: "sf-er",
      name: "SF General Emergency",
      role: "Emergency Department",
      phone: process.env.DEMO_ER_PHONE ?? "+15005550006",
    },
  ];
}
