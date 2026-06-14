import { requireRoles } from "@/lib/api-auth";
import { generateCognitionReport } from "@/lib/xai";
import { extractTopics, getSentiment } from "@/lib/topic-map";
import type { Message } from "@/lib/types";

export async function POST(req: Request) {
  const auth = await requireRoles("caretaker");
  if (auth instanceof Response) return auth;

  const { messages } = await req.json() as { messages: Message[] };
  const topics   = extractTopics(messages, 5);
  const sentiment = getSentiment(messages);
  const avg      = sentiment.length ? sentiment.reduce((a, b) => a + b, 0) / sentiment.length : 0;
  const loopCount = messages.filter(m => m.role === "user").length - new Set(messages.filter(m => m.role === "user").map(m => m.content.toLowerCase().slice(0, 20))).size;

  const report = await generateCognitionReport(
    messages,
    topics.map(t => `${t.word} (${t.count}x)`),
    avg,
    Math.max(0, loopCount)
  );
  return Response.json({ report });
}
