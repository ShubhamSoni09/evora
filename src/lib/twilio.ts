import twilio from "twilio";
import { PATIENT_NAME, PATIENT_PHONE } from "./patient";
import { CAREGIVER_PHONE, getCaregiverContacts } from "./contacts";

/** Warm neural voice — less robotic than standard Polly */
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
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function softenForSpeech(text: string): string {
  return text
    .replace(/—/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapSoothingSsml(text: string): string {
  const softened = softenForSpeech(text);
  const withBreaks = escapeXml(softened)
    .replace(/\. /g, '.<break time="550ms"/> ')
    .replace(/\? /g, '?<break time="650ms"/> ')
    .replace(/, /g, ',<break time="280ms"/> ');
  return `<prosody rate="94%" pitch="-4%">${withBreaks}</prosody>`;
}

function sayBlock(text: string) {
  return `<Say voice="${EVORA_TWILIO_VOICE}" language="en-US">${wrapSoothingSsml(text)}</Say>`;
}

function buildSoothingTwiml(parts: string[]) {
  return (
    `<Response>` +
    parts.map((p) => sayBlock(p)).join(`<Pause length="1"/>`) +
    `</Response>`
  );
}

function fromNumber() {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER not set");
  return from;
}

function buildCaregiverAlertTwiml(reason: string, summary?: string) {
  const detail = summary?.trim() || reason;
  const msg = `Urgent evora alert for ${PATIENT_NAME}. ${detail}. Please check on ${PATIENT_NAME.split(" ")[0]} when you can.`;
  return buildSoothingTwiml([msg, msg]);
}

function buildProactiveTwiml(greeting: string) {
  const followUp = `Whenever you'd like to keep talking, just open evora. I'll be right here with you.`;
  return buildSoothingTwiml([greeting, followUp]);
}

function buildCaregiverCheckInTwiml(parts: string[]) {
  const closing = `That's the memory map for now. Take good care of yourself too.`;
  return buildSoothingTwiml([...parts, closing]);
}

/** Daily check-in — rings the patient */
export async function callPatient(greeting: string, to = PATIENT_PHONE) {
  const client = getClient();
  if (!client) throw new Error("Twilio not configured");

  return client.calls.create({
    to,
    from: fromNumber(),
    twiml: buildProactiveTwiml(greeting),
  });
}

/** Caretaker check-in — rings caregiver at +17162596124 */
export async function callCaregiverCheckIn(
  script: string | string[],
  to = CAREGIVER_PHONE
) {
  const client = getClient();
  if (!client) throw new Error("Twilio not configured");
  if (!to) throw new Error("CAREGIVER_PHONE not configured");

  const parts = Array.isArray(script)
    ? script
    : [
        script ||
          `Hi James, it's evora. I wanted to check in with you about ${PATIENT_NAME}. From what I can see, she's been doing alright.`,
      ];

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
