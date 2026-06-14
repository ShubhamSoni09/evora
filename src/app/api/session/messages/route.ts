import { getSessionMessages, syncSessionMessages } from "@/lib/live-session";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ messages: await getSessionMessages() });
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages?: Message[] };
  if (Array.isArray(messages)) await syncSessionMessages(messages);
  return Response.json({ ok: true });
}
