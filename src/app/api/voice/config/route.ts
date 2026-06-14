import { getPublicAppUrl } from "@/lib/app-url";
import { getTtsProvider, canUseElevenLabsForPhone } from "@/lib/voice-tts";

export const runtime = "nodejs";

export async function GET() {
  const provider = getTtsProvider();
  const phoneVoice = canUseElevenLabsForPhone() && getPublicAppUrl() ? "elevenlabs" : "twilio-polly";

  return Response.json({
    provider,
    humanVoice: provider === "elevenlabs",
    model:
      provider === "elevenlabs"
        ? process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5"
        : "xai-ara",
    phoneVoice,
    hint: provider
      ? null
      : "Add ELEVENLABS_API_KEY to .env.local for the most natural voice.",
  });
}
