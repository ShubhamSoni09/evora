import twilio from "twilio";
import { PATIENT_NAME, PATIENT_PHONE } from "./patient";
import { CAREGIVER_PHONE, getCaregiverContacts } from "./contacts";
import { canUseElevenLabsForPhone } from "./voice-tts";
import { registerTtsSession } from "./tts-session";
import { buildTtsPlayUrl } from "./tts-playback-url";
import { getPublicAppUrl } from "./app-url";
import { createPhoneSession } from "./phone-call-session";
import { buildStartCallUrl } from "./twilio-voice-twiml";

/** Fallback when ElevenLabs playback URLs are unavailable */
const EVORA_TWILIO_VOICE = "Polly.Ruth-Neural";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function softenForSpeech(text: string): string {
  return text
    .replace(/[—–…]/g, ", ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sayBlock(text: string) {
  const safe = escapeXml(softenForSpeech(text));
  return `<Say voice="${EVORA_TWILIO_VOICE}" language="en-US" rate="95%">${safe}</Say>`;
}

function buildPollyTwiml(parts: string[]) {
  return (
    `<Response>` +
    parts.map((p) => sayBlock(p)).join(`<Pause length="1"/>`) +
    `</Response>`
  );
}

function buildElevenLabsTwiml(parts: string[]) {
  const sessionId = registerTtsSession(parts);
  const segments = parts
    .map((_, i) => buildTtsPlayUrl(sessionId, i))
    .filter((url): url is string => Boolean(url));

  if (segments.length !== parts.length) {
    return buildPollyTwiml(parts);
  }

  const body = segments
    .map((url) => `<Play>${escapeXml(url)}</Play><Pause length="1"/>`)
    .join("");

  return `<Response>${body}</Response>`;
}

function buildVoiceTwiml(parts: string[]) {
  const useElevenLabs = canUseElevenLabsForPhone() && getPublicAppUrl();
  return useElevenLabs ? buildElevenLabsTwiml(parts) : buildPollyTwiml(parts);
}

function fromNumber() {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER not set");
  return from;
}

function buildCaregiverAlertTwiml(reason: string, summary?: string) {
  const detail = summary?.trim() || reason;
  const msg = `Urgent evora alert for ${PATIENT_NAME}. ${detail}. Please check on ${PATIENT_NAME.split(" ")[0]} when you can.`;
  return buildVoiceTwiml([msg, msg]);
}

function buildProactiveTwiml(greeting: string) {
  return buildVoiceTwiml([
    greeting,
    "I'm so glad you picked up. What's been on your mind?",
  ]);
}

function buildCaregiverCheckInTwiml(parts: string[]) {
  return buildVoiceTwiml([
    ...parts,
    `That's everything for now. Anything on your mind about ${PATIENT_NAME.split(" ")[0]}, or anything you'd like me to keep an eye on?`,
  ]);
}

function canInteractivePhoneCalls(webhookBase?: string | null) {
  return Boolean(webhookBase ?? getPublicAppUrl());
}

/** Daily check-in — rings the patient */
export async function callPatient(
  greeting: string,
  to = PATIENT_PHONE,
  webhookBase?: string | null
) {
  const client = getClient();
  if (!client) throw new Error("Twilio not configured");

  const base = webhookBase ?? getPublicAppUrl();
  const startUrl = canInteractivePhoneCalls(base)
    ? buildStartCallUrl(
        createPhoneSession({
          role: "patient",
          openerParts: [greeting],
          webhookBase: base,
        }),
        base
      )
    : null;

  if (startUrl) {
    return client.calls.create({
      to,
      from: fromNumber(),
      url: startUrl,
      method: "POST",
    });
  }

  return client.calls.create({
    to,
    from: fromNumber(),
    twiml: buildProactiveTwiml(greeting),
  });
}

/** Caretaker check-in — rings caregiver */
export async function callCaregiverCheckIn(
  script: string | string[],
  to = CAREGIVER_PHONE,
  webhookBase?: string | null
) {
  const client = getClient();
  if (!client) throw new Error("Twilio not configured");
  if (!to) throw new Error("CAREGIVER_PHONE not configured");

  const parts = Array.isArray(script)
    ? script
    : [
        script ||
          `Hey James, it's evora. I wanted to catch you up on how ${PATIENT_NAME.split(" ")[0]}'s been doing.`,
      ];

  const openerParts = [
    ...parts,
    `That's everything for now.`,
    `Anything on your mind about ${PATIENT_NAME.split(" ")[0]}, or anything you'd like me to keep an eye on?`,
  ];

  const base = webhookBase ?? getPublicAppUrl();
  const startUrl = canInteractivePhoneCalls(base)
    ? buildStartCallUrl(
        createPhoneSession({
          role: "caregiver",
          openerParts,
          maxTurns: 5,
          webhookBase: base,
        }),
        base
      )
    : null;

  if (startUrl) {
    return client.calls.create({
      to,
      from: fromNumber(),
      url: startUrl,
      method: "POST",
    });
  }

  return client.calls.create({
    to,
    from: fromNumber(),
    twiml: buildCaregiverCheckInTwiml(parts),
  });
}

/** Voice alert — rings caregiver/doctor */
export async function callCaregiver(reason: string, summary?: string, to?: string) {
  const client = getClient();
  if (!client) throw new Error("Twilio not configured");
  const phone = to ?? getCaregiverContacts()[0];
  if (!phone) throw new Error("CAREGIVER_PHONE not configured");

  return client.calls.create({
    to: phone,
    from: fromNumber(),
    twiml: buildCaregiverAlertTwiml(reason, summary),
  });
}

/** Text alert — SMS caregiver */
export async function smsCaregiver(body: string, to?: string) {
  const client = getClient();
  if (!client) throw new Error("Twilio not configured");
  const phone = to ?? getCaregiverContacts()[0];
  if (!phone) throw new Error("CAREGIVER_PHONE not configured");

  return client.messages.create({
    to: phone,
    from: fromNumber(),
    body: body.slice(0, 1500),
  });
}

export type CaregiverNotifyResult = {
  phone: string;
  callSid?: string;
  smsSid?: string;
  error?: string;
};

/** Notify all caregiver contacts per plan */
export async function notifyCaregivers(opts: {
  reason: string;
  summary?: string;
  severity: string;
  call: boolean;
  sms: boolean;
}): Promise<CaregiverNotifyResult[]> {
  const contacts = getCaregiverContacts();
  if (!contacts.length) return [];

  const smsBody =
    `evora alert (${opts.severity}) for ${PATIENT_NAME}\n` +
    `${opts.summary?.trim() || opts.reason}\n` +
    `Patient: ${PATIENT_PHONE}`;

  const results: CaregiverNotifyResult[] = [];

  for (const phone of contacts) {
    const result: CaregiverNotifyResult = { phone };
    try {
      if (opts.call) {
        const call = await callCaregiver(opts.reason, opts.summary, phone);
        result.callSid = call.sid;
      }
      if (opts.sms) {
        const sms = await smsCaregiver(smsBody, phone);
        result.smsSid = sms.sid;
      }
    } catch (err: unknown) {
      result.error = err instanceof Error ? err.message : "notify failed";
    }
    results.push(result);
  }

  return results;
}
