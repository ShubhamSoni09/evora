import { getTtsProvider } from "@/lib/voice-tts";

export const runtime = "nodejs";

export async function GET() {
  const provider = getTtsProvider();
  return Response.json({
    provider,
    humanVoice: provider === "elevenlabs",
    hint: provider
      ? null
      : "Add ELEVENLABS_API_KEY to .env.local for the most natural voice.",
  });
}
