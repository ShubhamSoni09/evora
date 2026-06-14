import { inngest } from "@/lib/inngest";
import {
  appendPhoneMessages,
  getPhoneSession,
  updatePhoneSession,
} from "@/lib/phone-call-session";
import {
  CAREGIVER_FAREWELL,
  generatePhoneReply,
  isGoodbyePhrase,
  NO_INPUT_PROMPT,
  PATIENT_FAREWELL,
} from "@/lib/phone-conversation";
import { syncSessionMessages } from "@/lib/live-session";
import { getSessionMemories } from "@/lib/memory-store";
import { validateTwilioWebhook } from "@/lib/twilio-webhook";
import {
  buildPhoneFarewellTwiml,
  buildPhoneReplyAndFarewellTwiml,
  buildPhoneTurnTwiml,
  buildTurnActionUrl,
} from "@/lib/twilio-voice-twiml";

export const runtime = "nodejs";
export const maxDuration = 60;

function twimlResponse(xml: string) {
  return new Response(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}

async function maybeEscalate(
  role: "patient" | "caregiver",
  severity: string,
  reason: string,
  conversation: string
) {
  if (role !== "patient") return;
  try {
    await inngest.send({
      name: "evora/escalation",
      data: {
        severity,
        reason,
        patientId: "margaret",
        conversation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[twilio/voice/turn] escalation failed", err);
  }
}

/** Twilio Gather callback — each spoken turn from patient or caregiver */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = value.toString();
  });
  if (!validateTwilioWebhook(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const sessionId = new URL(req.url).searchParams.get("session");
  if (!sessionId) {
    return twimlResponse(`<Response><Say>Sorry, something went wrong.</Say></Response>`);
  }

  const session = await getPhoneSession(sessionId);
  const turnUrl = buildTurnActionUrl(sessionId, session?.webhookBase);
  if (!session || !turnUrl) {
    return twimlResponse(`<Response><Say>This call has ended.</Say></Response>`);
  }

  const base = session.webhookBase;
  const speech = form.get("SpeechResult")?.toString()?.trim() ?? "";

  if (!speech) {
    const reprompts = session.reprompts + 1;
    if (reprompts >= 2) {
      const farewell = session.role === "patient" ? PATIENT_FAREWELL : CAREGIVER_FAREWELL;
      return twimlResponse(await buildPhoneFarewellTwiml(farewell, base));
    }
    await updatePhoneSession(sessionId, { reprompts });
    return twimlResponse(await buildPhoneTurnTwiml(NO_INPUT_PROMPT, turnUrl, base));
  }

  if (isGoodbyePhrase(speech)) {
    const farewell = session.role === "patient" ? PATIENT_FAREWELL : CAREGIVER_FAREWELL;
    await appendPhoneMessages(sessionId, [{ role: "user", content: speech }]);
    return twimlResponse(await buildPhoneFarewellTwiml(farewell, base));
  }

  const userMsg = { role: "user" as const, content: speech };
  const history = [...session.messages, userMsg];
  const turnCount = session.turnCount + 1;

  let replyText: string;
  let escalation: { severity: string; reason: string } | undefined;

  try {
    const memories = await getSessionMemories();
    const reply = await generatePhoneReply(session.role, history, memories);
    replyText = reply.text;
    escalation = reply.escalation;
  } catch (err) {
    console.error("[twilio/voice/turn]", err);
    replyText =
      session.role === "patient"
        ? "I'm still here with you. Tell me a little more about how you're feeling."
        : "I'm here. What would you like to know about Margaret?";
  }

  await appendPhoneMessages(sessionId, [
    userMsg,
    { role: "assistant", content: replyText },
  ]);

  if (session.role === "patient") {
    const updated = await getPhoneSession(sessionId);
    if (updated) await syncSessionMessages(updated.messages);
  }

  if (escalation) {
    await maybeEscalate(
      session.role,
      escalation.severity,
      escalation.reason,
      history.map((m) => `${m.role}: ${m.content}`).join("\n")
    );
  }

  const maxTurns = session.maxTurns;
  const ending = turnCount >= maxTurns;
  await updatePhoneSession(sessionId, { turnCount, reprompts: 0 });

  if (ending) {
    const farewell = session.role === "patient" ? PATIENT_FAREWELL : CAREGIVER_FAREWELL;
    return twimlResponse(await buildPhoneReplyAndFarewellTwiml(replyText, farewell, base));
  }

  return twimlResponse(await buildPhoneTurnTwiml(replyText, turnUrl, base));
}
