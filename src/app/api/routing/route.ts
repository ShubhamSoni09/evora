import { requireRoles } from "@/lib/api-auth";
import { CAREGIVER_PHONE, PATIENT_PHONE } from "@/lib/contacts";
import { isTwilioConfigured } from "@/lib/twilio";

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `+${digits.slice(0, 1)} ••• ••• ${digits.slice(-4)}`;
}

export async function GET() {
  const auth = await requireRoles("caretaker");
  if (auth instanceof Response) return auth;

  return Response.json({
    patientPhone: PATIENT_PHONE ? maskPhone(PATIENT_PHONE) : null,
    patientConfigured: Boolean(PATIENT_PHONE),
    caregiverConfigured: Boolean(CAREGIVER_PHONE),
    caregiverPhone: CAREGIVER_PHONE ? maskPhone(CAREGIVER_PHONE) : null,
    twilioConfigured: isTwilioConfigured(),
  });
}
