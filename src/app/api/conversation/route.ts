import { streamConversation } from "@/lib/xai";

export const runtime = "edge";

export async function POST(req: Request) {
  const { messages, loopLevel, memories } = await req.json();

  const stream = await streamConversation(messages, loopLevel, memories);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
