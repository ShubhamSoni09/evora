import { inngest } from "@/lib/inngest";
import { caregiverNotificationPlan, type AlertSeverity } from "@/lib/alerts";
import { activeSlot, PROACTIVE_CALL_SLOTS } from "@/lib/call-schedule";
import { getCaregiverContacts } from "@/lib/contacts";
import { PATIENT_PHONE } from "@/lib/patient";
import { generateEscalationSummary } from "@/lib/xai";
import { callPatient, isTwilioConfigured, notifyCaregivers } from "@/lib/twilio";

const CRON_TRIGGERS = PROACTIVE_CALL_SLOTS.map((slot) => ({
  cron: `TZ=America/New_York ${slot.minute} ${slot.hour} * * *`,
}));

/** Daily check-in calls → patient phone (+17167509405) */
export const scheduledProactiveCall = inngest.createFunction(
  { id: "scheduled-proactive-call", triggers: CRON_TRIGGERS },
  async ({ step }: { step: any }) => {
    if (!isTwilioConfigured()) {
      return { skipped: true, reason: "twilio_not_configured" };
    }

    const slot = activeSlot();
    if (!slot) return { skipped: true, reason: "no_matching_slot" };

    const call = await step.run("call-patient", () => callPatient(slot.greeting));

    await step.run("log-proactive-call", async () => ({
      patientPhone: PATIENT_PHONE,
      slot: slot.id,
      label: slot.label,
      callSid: call.sid,
      status: call.status,
      timestamp: new Date().toISOString(),
    }));

    return { called: true, slot: slot.id, callSid: call.sid, to: PATIENT_PHONE };
  }
);

export const onManualPatientCall = inngest.createFunction(
  { id: "on-manual-patient-call", triggers: [{ event: "evora/call-patient" }] },
  async ({ event, step }: { event: any; step: any }) => {
    if (!isTwilioConfigured()) {
      return { skipped: true, reason: "twilio_not_configured" };
    }

    const greeting =
      event.data.greeting ??
      `Hi Margaret, it's evora. I was just thinking about you — how are you doing today?`;

    const call = await step.run("call-patient", () => callPatient(greeting));

    return { called: true, callSid: call.sid, to: PATIENT_PHONE, triggeredBy: event.data.triggeredBy ?? "manual" };
  }
);

export const onEvoraCall = inngest.createFunction(
  { id: "on-evora-call", triggers: [{ event: "evora/call-started" }, { event: "evora/call-ended" }] },
  async ({ event, step }: { event: any; step: any }) => {
    await step.run("log-call-event", async () => ({
      event: event.name,
      patientId: event.data.patientId,
      durationSeconds: event.data.durationSeconds ?? null,
      timestamp: event.data.timestamp,
      logged: true,
    }));

    return { handled: true, event: event.name };
  }
);

/** Escalation → notify caregiver when severity + time window warrant it */
export const onEvoraEscalation = inngest.createFunction(
  { id: "on-evora-escalation", triggers: [{ event: "evora/escalation" }] },
  async ({ event, step }: { event: any; step: any }) => {
    const { severity, reason, patientId, conversation = "" } = event.data;
    const sev = severity as AlertSeverity;

    const summary = await step.run("generate-summary", () =>
      generateEscalationSummary(severity, reason, conversation)
    );

    const plan = caregiverNotificationPlan(sev);

    let notifyResults: Awaited<ReturnType<typeof notifyCaregivers>> = [];
    if (plan.notify && isTwilioConfigured() && getCaregiverContacts().length > 0) {
      notifyResults = await step.run("notify-caregiver", () =>
        notifyCaregivers({
          reason,
          summary,
          severity,
          call: plan.call,
          sms: plan.sms,
        })
      );
    }

    await step.run("log-escalation", async () => ({
      patientId,
      severity,
      reason,
      summary,
      plan,
      caregiverContacts: getCaregiverContacts(),
      notifyResults,
      logged: true,
      timestamp: new Date().toISOString(),
    }));

    return { patientId, severity, summary, plan, notifyResults, handled: true };
  }
);
