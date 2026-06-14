/** Demo patient — Margaret Chen */
export const PATIENT_NAME = "Margaret Chen";

function resolvePatientPhone(): string {
  const fromEnv = process.env.PATIENT_PHONE?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "";
  return "+17167509405";
}

export const PATIENT_PHONE = resolvePatientPhone();
export const PATIENT_TIMEZONE = process.env.PATIENT_TIMEZONE ?? "America/New_York";
