import { getTtsSessionPart } from "@/lib/tts-session";
import { synthesizeSpeech } from "@/lib/voice-tts";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ sessionId: string; index: string }> };

/** Twilio `<Play>` endpoint — serves ElevenLabs (or xAI fallback) audio for phone calls */
export async function GET(_req: Request, { params }: RouteParams) {
  const { sessionId, index: indexRaw } = await params;
  const index = Number(indexRaw);
  if (!Number.isFinite(index) || index < 0) {
    return new Response("Invalid segment", { status: 400 });
  }

  const text = getTtsSessionPart(sessionId, index);
  if (!text) return new Response("Session expired", { status: 404 });

  try {
    const { audio, mime } = await synthesizeSpeech(text, { forPhone: true });
    return new Response(audio, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (err) {
    console.error("[voice/play]", err);
    return new Response("TTS failed", { status: 502 });
  }
}
