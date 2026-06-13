/**
 * xAI Grok Voice — TTS & STT for in-app calls
 * TTS: POST /v1/tts — voice `ara` (warm, conversational)
 * STT: POST /v1/stt — batch transcription
 */

export const EVORA_VOICE = "ara";
export const EVORA_TTS_SPEED = 0.86;

/** Insert natural pauses so TTS sounds less rushed or robotic */
export function softenSpeechText(text: string): string {
  return text
    .replace(/—/g, ", ")
    .replace(/;\s*/g, ", ")
    .replace(/\.\s+/g, ". ")
    .replace(/,\s*/g, ", ")
    .trim();
}

const XAI_BASE = "https://api.x.ai/v1";

function xaiKey() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY not configured");
  return key;
}

export async function synthesizeSpeech(text: string): Promise<{ audio: ArrayBuffer; mime: string }> {
  const res = await fetch(`${XAI_BASE}/tts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${xaiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: softenSpeechText(text).slice(0, 15000),
      voice_id: EVORA_VOICE,
      language: "en",
      speed: EVORA_TTS_SPEED,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`xAI TTS failed (${res.status}): ${err}`);
  }

  const mime = res.headers.get("content-type") ?? "audio/mpeg";
  return { audio: await res.arrayBuffer(), mime };
}

export async function transcribeAudio(file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("language", "en");

  const res = await fetch(`${XAI_BASE}/stt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${xaiKey()}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`xAI STT failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
