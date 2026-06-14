import { synthesizeElevenLabs, isElevenLabsConfigured } from "@/lib/elevenlabs-voice";
import { synthesizeSpeech as synthesizeXaiSpeech } from "@/lib/grok-voice";
import { getCachedTtsAudio, setCachedTtsAudio } from "@/lib/tts-audio-cache";

export type TtsProvider = "elevenlabs" | "xai";

function preferredProvider(): TtsProvider | null {
  const pref = (process.env.TTS_PROVIDER ?? "auto").toLowerCase();
  if (pref === "xai") return process.env.XAI_API_KEY ? "xai" : null;
  if (pref === "elevenlabs") return isElevenLabsConfigured() ? "elevenlabs" : null;
  if (isElevenLabsConfigured()) return "elevenlabs";
  if (process.env.XAI_API_KEY) return "xai";
  return null;
}

export function getTtsProvider(): TtsProvider | null {
  return preferredProvider();
}

export function canUseElevenLabsForPhone() {
  return isElevenLabsConfigured() && preferredProvider() !== "xai";
}

export async function synthesizeSpeech(
  text: string,
  opts?: { forPhone?: boolean; provider?: TtsProvider }
): Promise<{ audio: ArrayBuffer; mime: string; provider: TtsProvider }> {
  const provider = opts?.provider ?? preferredProvider();
  if (!provider) throw new Error("No TTS provider configured");

  const cached = getCachedTtsAudio(text, provider);
  if (cached) {
    return { audio: cached.audio, mime: cached.mime, provider };
  }

  if (provider === "elevenlabs") {
    try {
      const result = await synthesizeElevenLabs(text, { forPhone: opts?.forPhone });
      setCachedTtsAudio(text, "elevenlabs", result.audio, result.mime);
      return { ...result, provider: "elevenlabs" };
    } catch (err) {
      if (opts?.provider === "elevenlabs") throw err;
      console.warn("[voice-tts] ElevenLabs failed, falling back to xAI:", err);
    }
  }

  const result = await synthesizeXaiSpeech(text);
  setCachedTtsAudio(text, "xai", result.audio, result.mime);
  return { ...result, provider: "xai" };
}
