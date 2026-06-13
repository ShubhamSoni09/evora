import { synthesizeElevenLabs, isElevenLabsConfigured } from "@/lib/elevenlabs-voice";
import { synthesizeSpeech as synthesizeXaiSpeech } from "@/lib/grok-voice";

export type TtsProvider = "elevenlabs" | "xai";

export function getTtsProvider(): TtsProvider | null {
  if (isElevenLabsConfigured()) return "elevenlabs";
  if (process.env.XAI_API_KEY) return "xai";
  return null;
}

export async function synthesizeSpeech(
  text: string
): Promise<{ audio: ArrayBuffer; mime: string; provider: TtsProvider }> {
  if (isElevenLabsConfigured()) {
    try {
      const result = await synthesizeElevenLabs(text);
      return { ...result, provider: "elevenlabs" };
    } catch (err) {
      console.warn("[voice-tts] ElevenLabs failed, falling back to xAI:", err);
    }
  }

  const result = await synthesizeXaiSpeech(text);
  return { ...result, provider: "xai" };
}
