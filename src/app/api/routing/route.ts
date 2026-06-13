import { CAREGIVER_PHONE, PATIENT_PHONE } from "@/lib/contacts";
import { isTwilioConfigured } from "@/lib/twilio";

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `+${digits.slice(0, 1)} ••• ••• ${digits.slice(-4)}`;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export async function GET() {
  return Response.json({
    patientPhone: PATIENT_PHONE,
    caregiverConfigured: Boolean(CAREGIVER_PHONE),
    caregiverPhone: CAREGIVER_PHONE ? maskPhone(CAREGIVER_PHONE) : null,
    caregiverPhoneFull: CAREGIVER_PHONE ? formatPhone(CAREGIVER_PHONE) : null,
    twilioConfigured: isTwilioConfigured(),
  });
}
