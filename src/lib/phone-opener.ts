import type { Memory } from "@/lib/mock-memories";

/** Spoken opener segments for outbound patient phone calls */
export function buildPatientPhoneOpenerParts(greeting: string, memories: Memory[]): string[] {
  const parts = [greeting.trim()].filter(Boolean);

  const family = memories.filter((m) => m.type === "family");
  if (family.length) {
    const latest = family[family.length - 1];
    const from = latest.label.replace(/^Message from /i, "") || "Sarah";
    parts.push(`Oh, and ${from} wanted me to pass something along. She said: ${latest.content}`);
  }

  const voiceMsg = memories.find((m) => m.type === "voice");
  if (voiceMsg && !family.some((f) => f.content === voiceMsg.content)) {
    parts.push(`I also have this from your family: ${voiceMsg.content}`);
  }

  return parts;
}

/** Extra lines for caregiver check-in about family portal messages */
export function buildFamilyBriefingLines(memories: Memory[]): string[] {
  const family = memories.filter((m) => m.type === "family");
  if (!family.length) return [];

  const latest = family[family.length - 1];
  const from = latest.label.replace(/^Message from /i, "") || "Sarah";
  return [
    `${from} left a message for Margaret through the family portal. It says: ${latest.content}`,
  ];
}
