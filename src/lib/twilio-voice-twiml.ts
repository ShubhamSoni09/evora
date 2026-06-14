import twilio from "twilio";
import { getPublicAppUrl } from "@/lib/app-url";
import { canUseElevenLabsForPhone } from "@/lib/voice-tts";
import { registerTtsSession } from "@/lib/tts-session";
import { buildTtsPlayUrl } from "@/lib/tts-playback-url";

const VoiceResponse = twilio.twiml.VoiceResponse;
const POLLY_VOICE = "Polly.Ruth-Neural";
const NO_INPUT_FALLBACK = "I did not catch that. We can talk again soon. Take care.";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function soften(text: string) {
  return text
    .replace(/[—–…]/g, ", ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function playParts(response: twilio.twiml.VoiceResponse, parts: string[], baseUrl?: string | null) {
  const useElevenLabs = canUseElevenLabsForPhone() && (baseUrl ?? getPublicAppUrl());
  if (useElevenLabs) {
    const sessionId = registerTtsSession(parts);
    for (let i = 0; i < parts.length; i++) {
      const url = buildTtsPlayUrl(sessionId, i, baseUrl);
      if (url) response.play(url);
      else response.say({ voice: POLLY_VOICE, language: "en-US" }, soften(parts[i]));
      if (i < parts.length - 1) response.pause({ length: 1 });
    }
    return;
  }
  for (let i = 0; i < parts.length; i++) {
    response.say({ voice: POLLY_VOICE, language: "en-US" }, soften(parts[i]));
    if (i < parts.length - 1) response.pause({ length: 1 });
  }
}

function playOne(response: twilio.twiml.VoiceResponse, text: string, baseUrl?: string | null) {
  playParts(response, [text], baseUrl);
}

function addGather(response: twilio.twiml.VoiceResponse, actionUrl: string) {
  const gather = response.gather({
    input: ["speech"],
    action: actionUrl,
    method: "POST",
    speechTimeout: "auto",
    language: "en-US",
    hints: "Margaret, Harold, medicine, lonely, rose garden, Sarah, James, thank you, goodbye",
  });
  gather.pause({ length: 1 });
}

/** Opening TwiML — speak opener lines, then listen */
export function buildPhoneOpenTwiml(
  openerParts: string[],
  turnUrl: string,
  baseUrl?: string | null
): string {
  const response = new VoiceResponse();
  playParts(response, openerParts, baseUrl);
  addGather(response, turnUrl);
  response.say({ voice: POLLY_VOICE }, soften(NO_INPUT_FALLBACK));
  return response.toString();
}

/** Mid-call TwiML — speak reply, listen again */
export function buildPhoneTurnTwiml(
  reply: string,
  turnUrl: string,
  baseUrl?: string | null,
  final = false
): string {
  const response = new VoiceResponse();
  playOne(response, reply, baseUrl);
  if (!final) {
    addGather(response, turnUrl);
    response.say({ voice: POLLY_VOICE }, soften(NO_INPUT_FALLBACK));
  }
  return response.toString();
}

/** End call warmly */
export function buildPhoneFarewellTwiml(farewell: string, baseUrl?: string | null): string {
  const response = new VoiceResponse();
  playOne(response, farewell, baseUrl);
  response.pause({ length: 1 });
  return response.toString();
}

/** End call — speak reply then farewell */
export function buildPhoneReplyAndFarewellTwiml(
  reply: string,
  farewell: string,
  baseUrl?: string | null
): string {
  const response = new VoiceResponse();
  playOne(response, reply, baseUrl);
  response.pause({ length: 1 });
  playOne(response, farewell, baseUrl);
  return response.toString();
}

export function buildTurnActionUrl(sessionId: string, baseUrl?: string | null): string | null {
  const base = baseUrl ?? getPublicAppUrl();
  if (!base) return null;
  return `${base}/api/twilio/voice/turn?session=${sessionId}`;
}

export function buildStartCallUrl(sessionId: string, baseUrl?: string | null): string | null {
  const base = baseUrl ?? getPublicAppUrl();
  if (!base) return null;
  return `${base}/api/twilio/voice?session=${sessionId}`;
}
