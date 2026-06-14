import { softenSpeechText } from "@/lib/speech-text";

/** Matilda — warm, reassuring companion (override with ELEVENLABS_VOICE_ID) */
const DEFAULT_VOICE_ID = "XrExE9yKIg1WjnnlVkGX";
/** Flash v2.5 — lowest latency, best for live conversation */
const DEFAULT_MODEL = "eleven_flash_v2_5";
/** Multilingual v2 — richer emotion when latency is less critical (phone calls) */
const PHONE_MODEL = "eleven_multilingual_v2";

function elevenKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured");
  return key;
}

export function isElevenLabsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function voiceSettings(forPhone = false) {
  const stability = Number(process.env.ELEVENLABS_STABILITY ?? (forPhone ? 0.42 : 0.32));
  const similarity = Number(process.env.ELEVENLABS_SIMILARITY ?? 0.78);
  const style = Number(process.env.ELEVENLABS_STYLE ?? (forPhone ? 0.48 : 0.52));
  const speed = Number(process.env.ELEVENLABS_SPEED ?? (forPhone ? 0.94 : 0.98));

  return {
    stability: Number.isFinite(stability) ? stability : 0.32,
    similarity_boost: Number.isFinite(similarity) ? similarity : 0.78,
    style: Number.isFinite(style) ? style : 0.52,
    use_speaker_boost: true,
    speed: Number.isFinite(speed) ? speed : 0.98,
  };
}

export async function synthesizeElevenLabs(
  text: string,
  opts?: { forPhone?: boolean }
): Promise<{ audio: ArrayBuffer; mime: string }> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const defaultModel = opts?.forPhone
    ? (process.env.ELEVENLABS_PHONE_MODEL ?? PHONE_MODEL)
    : (process.env.ELEVENLABS_MODEL ?? DEFAULT_MODEL);
  const model = defaultModel;
  const latency = opts?.forPhone ? 2 : 4;
  const format = opts?.forPhone ? "mp3_44100_128" : "mp3_22050_32";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=${latency}&output_format=${format}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: softenSpeechText(text).slice(0, 5000),
        model_id: model,
        voice_settings: voiceSettings(opts?.forPhone),
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err}`);
  }

  return { audio: await res.arrayBuffer(), mime: "audio/mpeg" };
}
