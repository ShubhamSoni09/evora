import { softenSpeechText } from "@/lib/speech-text";
import { isElevenLabsConfigured } from "@/lib/elevenlabs-voice";

export { isElevenLabsConfigured };

const DEFAULT_VOICE_ID = "XrExE9yKIg1WjnnlVkGX";
const DEFAULT_MODEL = "eleven_flash_v2_5";

function elevenKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured");
  return key;
}

/** Low-latency PCM stream for in-app playback (22050 Hz mono int16) */
export async function fetchElevenLabsPcmStream(text: string): Promise<Response> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const model = process.env.ELEVENLABS_MODEL ?? DEFAULT_MODEL;

  return fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4&output_format=pcm_22050`,
    {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey(),
        "Content-Type": "application/json",
        Accept: "audio/pcm",
      },
      body: JSON.stringify({
        text: softenSpeechText(text).slice(0, 5000),
        model_id: model,
        voice_settings: {
          stability: Number(process.env.ELEVENLABS_STABILITY ?? 0.28),
          similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY ?? 0.75),
          style: Number(process.env.ELEVENLABS_STYLE ?? 0.45),
          use_speaker_boost: true,
          speed: Number(process.env.ELEVENLABS_SPEED ?? 0.98),
        },
      }),
    }
  );
}
