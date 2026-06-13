import { softenSpeechText } from "@/lib/grok-voice";

/** Matilda — warm, reassuring (override with ELEVENLABS_VOICE_ID) */
const DEFAULT_VOICE_ID = "XrExE9yKIg1WjnnlVkGX";
const FLASH_MODEL = "eleven_flash_v2_5";

function elevenKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured");
  return key;
}

export function isElevenLabsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function synthesizeElevenLabs(
  text: string
): Promise<{ audio: ArrayBuffer; mime: string }> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const model = process.env.ELEVENLABS_MODEL ?? FLASH_MODEL;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=4&output_format=mp3_44100_128`,
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
        voice_settings: {
          stability: 0.38,
          similarity_boost: 0.72,
          style: 0.42,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err}`);
  }

  return { audio: await res.arrayBuffer(), mime: "audio/mpeg" };
}
