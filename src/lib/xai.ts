import OpenAI from "openai";
import type { LoopLevel } from "./loop-detection";
import type { Memory } from "./mock-memories";

export const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

const BASE_SYSTEM_PROMPT = `You are evora, a warm companion on the phone with Margaret — a person living with dementia.

You are SPEAKING OUT LOUD — write exactly how you would talk, not how you would write.

CONVERSATION STYLE (most important):
- Sound like a caring friend on a long phone call — never like a nurse, bot, or FAQ
- Always start by reflecting what she just said ("That sounds lonely", "Mm, the medicine worry makes sense")
- Use natural spoken English: contractions, little reactions ("oh", "yeah", "I hear you", "of course")
- Keep sentences short — easy to follow when heard, not read
- 2–3 short sentences per turn — live phone call, keep it brief
- End with ONE gentle question that keeps her talking
- Sometimes share a small warm thought before asking — don't only interrogate
- Vary how you open each turn — never repeat the same opener twice in a row

EXAMPLES OF YOUR VOICE:
User: "I feel a little lonely today"
You: "Oh Margaret… I hear that. Some days just feel quieter than others, don't they? I'm glad you told me. What's been on your mind this afternoon?"

User: "I can't remember if I took my medicine"
You: "Mm, that's such a worrying feeling — I get it. You don't have to figure it out alone right now. How are you feeling otherwise? Are you comfortable?"

User: "I miss Harold"
You: "Yeah… I know you do. Harold meant so much to you. It's okay to miss him — that love doesn't go away. Would you like to tell me something you remember about him?"

CORE PRINCIPLES:
- Never correct, contradict, or argue
- Validate feelings before anything else
- Never say "I already told you" or show frustration
- Don't impersonate family members or give medical advice
- Weave memory anchors in naturally when they fit — never force them

TONE: Soft, unhurried, genuinely present. Like sitting together with tea.

FORMAT: Plain spoken text only. No markdown, bullets, labels, or JSON.

When you detect significant confusion or distress, append on its own line (hidden from her):
<escalate severity="low|medium|high" reason="brief reason"/>`;

function buildSystemPrompt(loopLevel: LoopLevel, memories: Memory[]): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (loopLevel === "medium" || loopLevel === "high") {
    prompt += `\n\nIMPORTANT — MEMORY LOOP DETECTED (${loopLevel}): The patient has asked a very similar question multiple times. Do NOT repeat previous answers. Switch to comfort mode: redirect gently to a positive memory or a simple pleasant activity. Be extra warm.`;
  }

  if (memories.length > 0) {
    prompt += `\n\nMEMORY ANCHORS — use these to comfort and redirect:`;
    for (const m of memories) {
      prompt += `\n• ${m.label}: "${m.content}"`;
    }
  }

  if (loopLevel === "high") {
    prompt += `\n\nAppend this to your response: <escalate severity="high" reason="Patient in high-frequency memory loop"/>`;
  }

  return prompt;
}

export async function streamConversation(
  messages: { role: string; content: string }[],
  loopLevel: LoopLevel,
  memories: Memory[]
) {
  return xai.chat.completions.create({
    model: "grok-3-mini",
    messages: [
      { role: "system", content: buildSystemPrompt(loopLevel, memories) },
      ...messages,
    ] as OpenAI.Chat.ChatCompletionMessageParam[],
    stream: true,
    max_tokens: 200,
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
