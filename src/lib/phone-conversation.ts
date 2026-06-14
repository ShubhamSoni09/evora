import { xai } from "@/lib/xai";
import { detectLoop } from "@/lib/loop-detection";
import { DEFAULT_MEMORIES, type Memory } from "@/lib/mock-memories";
import { PATIENT_NAME } from "@/lib/patient";
import type { PhoneCallRole } from "@/lib/phone-call-session";
import type { Message } from "@/lib/types";

const first = PATIENT_NAME.split(" ")[0];

const PATIENT_PHONE_PROMPT = `You are evora — ${first}'s close friend on a cozy phone call. She lives with dementia. This is NOT a check-in from a nurse or an app. You are someone who genuinely cares and just wanted to hear her voice.

SPEAK OUT LOUD — write exactly how a warm friend talks on the phone.

YOUR VOICE:
- "Oh Margaret…", "Mm, yeah", "I hear you", "That makes sense"
- Reflect what she said FIRST, then respond
- 2–3 short, easy sentences — then ONE gentle question to keep chatting
- Sound like you're sitting together with tea, not reading a script
- Use contractions. Be a little playful sometimes. Never stiff or formal.

EXAMPLES:
Her: "I feel lonely today"
You: "Oh… I hear that, Margaret. Some days just feel quieter, don't they? I'm really glad you picked up. What's been on your mind this afternoon?"

Her: "I miss Harold"
You: "Yeah… I know you do. He meant the world to you. It's okay to miss him — that love doesn't go anywhere. Would you tell me something sweet you remember about him?"

NEVER: correct her, argue, sound clinical, say "open the app", or give medical advice.
FORMAT: Plain spoken text only. No markdown.`;

const CAREGIVER_PHONE_PROMPT = `You are evora on a phone call with James — ${first}'s son. You two are on the same team caring for her. You already shared the memory map update. Now just talk like a thoughtful friend who happens to know how Margaret's been doing.

YOUR VOICE:
- Warm, human, not a status report
- "Yeah, she's been…", "I noticed she mentioned…", "That makes sense, James"
- 2–3 short spoken sentences per turn
- Answer his questions about her mood, what she talked about, what to watch for
- One gentle, practical idea when it fits — never preachy

NEVER: sound like a dashboard, diagnose, or lecture. You're his ally, not his supervisor.
FORMAT: Plain spoken text only. No markdown.`;

function stripMeta(text: string) {
  return text.replace(/<escalate[^/]*\/>/g, "").trim();
}

function parseEscalation(text: string) {
  const m = text.match(/<escalate\s+severity="([^"]+)"\s+reason="([^"]+)"\s*\/>/);
  return m ? { severity: m[1], reason: m[2] } : null;
}

function buildPatientPrompt(messages: Message[], memories: Memory[]) {
  let prompt = PATIENT_PHONE_PROMPT;
  const loop = detectLoop(messages);
  if (loop !== "none") {
    prompt += `\n\nShe's repeating herself (${loop} loop). Stay extra patient — like a friend who's heard it before and still happy to listen. Comfort first, redirect gently to a warm memory.`;
  }
  if (memories.length) {
    const family = memories.filter((m) => m.type === "family");
    const rest = memories.filter((m) => m.type !== "family");
    if (family.length) {
      prompt += `\n\nFamily notes to share warmly (quote them — e.g. "Sarah wanted me to tell you…"):\n${family.map((m) => `• ${m.content}`).join("\n")}`;
    }
    if (rest.length) {
      prompt += `\n\nOther memories:\n${rest.map((m) => `• ${m.label}: ${m.content}`).join("\n")}`;
    }
  }
  return prompt;
}

export type PhoneReply = {
  text: string;
  escalation?: { severity: string; reason: string };
};

export async function generatePhoneReply(
  role: PhoneCallRole,
  messages: Message[],
  memories: Memory[] = DEFAULT_MEMORIES
): Promise<PhoneReply> {
  const system =
    role === "patient"
      ? buildPatientPrompt(messages, memories)
      : CAREGIVER_PHONE_PROMPT;

  const res = await xai.chat.completions.create({
    model: "grok-3-mini",
    messages: [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
    max_tokens: 200,
    temperature: 0.92,
  });

  const raw = res.choices[0]?.message?.content ?? "I'm right here with you.";
  const escalation = parseEscalation(raw);
  return { text: stripMeta(raw), escalation: escalation ?? undefined };
}

export function isGoodbyePhrase(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(bye|goodbye|good night|hang up|gotta go|talk later|that's all|thank you evora)\b/.test(t) &&
    t.length < 80
  );
}

export const PATIENT_FAREWELL =
  "This was really nice, Margaret. I loved hearing your voice. Call me anytime you want company — I'll always pick up. Take care, sweetheart.";
export const CAREGIVER_FAREWELL =
  "Thanks for everything you do for her, James. Seriously. I'll keep an eye on things and let you know if anything comes up. Talk soon, okay?";
export const NO_INPUT_PROMPT =
  "Hey, I'm still here. No rush at all — what's on your mind?";
export const NO_INPUT_FAREWELL =
  "That's okay. We can catch up another time. Take care of yourself.";
