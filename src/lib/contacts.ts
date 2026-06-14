import { PATIENT_NAME } from "./patient";

function cleanPhone(n?: string): string | null {
  if (!n || n.includes("XXXX")) return null;
  return n.replace(/\s/g, "");
}

/** Patient (Margaret) — receives daily check-in calls */
export { PATIENT_PHONE, PATIENT_NAME, PATIENT_TIMEZONE } from "./patient";

/** Caregiver (James) — receives alert calls/SMS when evora escalates */
export const CAREGIVER_PHONE = cleanPhone(process.env.CAREGIVER_PHONE) ?? (process.env.NODE_ENV === "production" ? null : "+17162596124");
export const DOCTOR_PHONE = cleanPhone(process.env.DOCTOR_PHONE);

export function getCaregiverContacts(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phone of [CAREGIVER_PHONE, DOCTOR_PHONE]) {
    if (phone && !seen.has(phone)) {
      seen.add(phone);
      out.push(phone);
    }
  }
  return out;
}
