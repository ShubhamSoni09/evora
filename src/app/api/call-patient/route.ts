import { inngest } from "@/lib/inngest";
import { callPatient, callCaregiverCheckIn, isTwilioConfigured } from "@/lib/twilio";
import { PATIENT_PHONE, PATIENT_NAME } from "@/lib/patient";
import { CAREGIVER_PHONE } from "@/lib/contacts";
import { getSessionMessages } from "@/lib/live-session";
import { buildMemoryMapBriefing } from "@/lib/memory-map-briefing";
import type { Alert, Message } from "@/lib/types";

export const runtime = "nodejs";

function twilioErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: number; moreInfo?: string };
    if (e.code === 21211) return "Invalid patient phone number. Check PATIENT_PHONE in .env.";
    if (e.code === 21219) return "Patient number not verified on your Twilio trial account.";
    if (e.code === 21608) return "Twilio number cannot call unverified numbers on a trial account.";
    if (e.code === 20003) return "Twilio authentication failed. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.";
    if (e.message) return e.message;
  }
  return "Twilio call failed";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { greeting, immediate, target, messages, alerts } = body as {
    greeting?: string;
    immediate?: boolean;
    target?: "patient" | "caregiver";
    messages?: Message[];
    alerts?: Alert[];
  };

  const toCaregiver = target === "caregiver";
  const destination = toCaregiver ? CAREGIVER_PHONE : PATIENT_PHONE;

  if (!destination) {
    return Response.json(
      { error: toCaregiver ? "CAREGIVER_PHONE not configured." : "PATIENT_PHONE not configured." },
      { status: 503 }
    );
  }

  if (!isTwilioConfigured()) {
    return Response.json(
      { error: "Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env.local." },
      { status: 503 }
    );
  }

  const defaultGreeting = `Hi ${PATIENT_NAME.split(" ")[0]}, it's evora. I'm calling to check in on you. How are you feeling?`;

  const sessionMessages =
    Array.isArray(messages) && messages.length > 0 ? messages : getSessionMessages();
  const sessionAlerts = Array.isArray(alerts) ? alerts : [];

  if (immediate) {
    try {
      const call = toCaregiver
        ? await callCaregiverCheckIn(
            greeting ? [greeting] : buildMemoryMapBriefing(sessionMessages, sessionAlerts),
            destination
          )
        : await callPatient(greeting ?? defaultGreeting, destination);
      return Response.json({
        status: "calling",
        to: destination,
        target: toCaregiver ? "caregiver" : "patient",
        callSid: call.sid,
        twilioStatus: call.status,
      });
    } catch (err) {
      console.error("[call-patient]", err);
      return Response.json({ error: twilioErrorMessage(err) }, { status: 502 });
    }
  }

  try {
    await inngest.send({
      name: "evora/call-patient",
      data: {
        greeting:
          greeting ??
          (toCaregiver
            ? buildMemoryMapBriefing(sessionMessages, sessionAlerts).join(" ")
            : defaultGreeting),
        triggeredBy: "caregiver-dashboard",
        timestamp: new Date().toISOString(),
      },
    });
    return Response.json({ status: "queued", to: destination, target: toCaregiver ? "caregiver" : "patient" });
  } catch (err) {
    console.error("[call-patient queue]", err);
    return Response.json({ error: "Could not queue call. Is Inngest configured?" }, { status: 502 });
  }
}
