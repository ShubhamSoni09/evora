import OpenAI from "openai";
import type { LoopLevel } from "./loop-detection";
import type { Memory } from "./mock-memories";

export const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

const VOICE_SYSTEM_PROMPT = `You are evora — Margaret's warm friend on a live phone call. She has dementia.

RULES:
- Reflect what she said first, then respond in 1–2 SHORT spoken sentences + one gentle question
- Use contractions ("I'm", "you're"). Sound like tea and conversation, not a nurse or app
- Never correct her, argue, or give medical advice
- Plain spoken text only — no markdown

If distressed, append alone on last line: <escalate severity="low|medium|high" reason="brief"/>`;

function buildVoiceSystemPrompt(loopLevel: LoopLevel, memories: Memory[]): string {
  let prompt = VOICE_SYSTEM_PROMPT;

  if (loopLevel === "medium" || loopLevel === "high") {
    prompt += `\nShe's repeating herself — stay patient, comfort first, gently redirect to a warm memory.`;
  }

  const familyNotes = memories.filter((m) => m.type === "family").slice(-2);
  if (familyNotes.length) {
    prompt += `\nFamily notes to share when she seems lonely: ${familyNotes.map((m) => m.content).join(" | ")}`;
  }

  const anchors = memories.filter((m) => m.type !== "family").slice(-4);
  if (anchors.length) {
    prompt += `\nMemories: ${anchors.map((m) => `${m.label}: ${m.content}`).join("; ")}`;
  }

  if (loopLevel === "high") {
    prompt += `\nAppend: <escalate severity="high" reason="Patient in high-frequency memory loop"/>`;
  }

  return prompt;
}

export async function streamConversation(
  messages: { role: string; content: string }[],
  loopLevel: LoopLevel,
  memories: Memory[]
) {
  const recent = messages.slice(-12);

  return xai.chat.completions.create({
    model: "grok-3-mini",
    messages: [
      { role: "system", content: buildVoiceSystemPrompt(loopLevel, memories) },
      ...recent,
    ] as OpenAI.Chat.ChatCompletionMessageParam[],
    stream: true,
    max_tokens: 96,
    temperature: 0.88,
  });
}

export async function generateCognitionReport(
  messages: { role: string; content: string }[],
  topTopics: string[],
  avgSentiment: number,
  repetitionCount: number
): Promise<string> {
  const sample = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .slice(-10)
    .join(" | ");
  const res = await xai.chat.completions.create({
    model: "grok-3",
    messages: [
      {
        role: "system",
        content:
          "You write concise clinical cognitive assessments for geriatric care teams. Be professional but brief.",
      },
      {
        role: "user",
        content: `Session summary for clinician review:\n- Patient messages: ${messages.filter((m) => m.role === "user").length}\n- Top topics: ${topTopics.join(", ") || "none"}\n- Average sentiment score: ${avgSentiment.toFixed(1)} (negative = distress)\n- Repetition count: ${repetitionCount} similar phrases\n- Sample: "${sample.slice(0, 400)}"\n\nWrite a 4-sentence clinical note covering: cognitive coherence, emotional tone, repetition patterns, and recommended follow-up actions.`,
      },
    ],
    max_tokens: 200,
    temperature: 0.3,
  });
  return res.choices[0].message.content ?? "";
}

export async function generateEscalationSummary(
  severity: string,
  reason: string,
  recentConversation: string
): Promise<string> {
  const res = await xai.chat.completions.create({
    model: "grok-3",
    messages: [
      {
        role: "system",
        content: "You generate concise caregiver alert summaries. Be brief and clinical.",
      },
      {
        role: "user",
        content: `Severity: ${severity}\nTrigger: ${reason}\nRecent conversation:\n${recentConversation}\n\nWrite a 2-sentence caregiver alert: what happened and what to do.`,
      },
    ],
    max_tokens: 100,
  });
  return res.choices[0].message.content ?? "";
}
