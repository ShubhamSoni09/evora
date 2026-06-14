import { isElevenLabsConfigured, fetchElevenLabsPcmStream } from "@/lib/elevenlabs-stream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return Response.json({ error: "text required" }, { status: 400 });
  }

  if (!isElevenLabsConfigured()) {
    return Response.json({ error: "Streaming TTS requires ElevenLabs" }, { status: 503 });
  }

  try {
    const upstream = await fetchElevenLabsPcmStream(text);
    if (!upstream.ok || !upstream.body) {
      const err = await upstream.text();
      return Response.json({ error: err || "TTS stream failed" }, { status: upstream.status });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Audio-Sample-Rate": "22050",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "TTS stream failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
