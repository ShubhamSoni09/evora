import { transcribeAudio } from "@/lib/grok-voice";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.XAI_API_KEY) {
    return Response.json({ error: "XAI_API_KEY not configured" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "audio file required" }, { status: 400 });
  }

  const name = file instanceof File ? file.name : "audio.webm";

  try {
    const text = await transcribeAudio(file, name);
    return Response.json({ text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "STT failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
