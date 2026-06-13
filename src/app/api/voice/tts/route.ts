import { getTtsProvider, synthesizeSpeech } from "@/lib/voice-tts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return Response.json({ error: "text required" }, { status: 400 });
  }

  if (!getTtsProvider()) {
    return Response.json(
      { error: "No TTS configured. Add ELEVENLABS_API_KEY (recommended) or XAI_API_KEY to .env.local." },
      { status: 500 }
    );
  }

  try {
    const { audio, mime, provider } = await synthesizeSpeech(text.slice(0, 5000));
    return new Response(audio, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "no-store",
        "X-TTS-Provider": provider,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "TTS failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
