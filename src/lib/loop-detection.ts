import type { Message } from "./types";

export type LoopLevel = "none" | "low" | "medium" | "high";

function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const hits = [...wordsA].filter(w => wordsB.has(w)).length;
  return hits / Math.max(wordsA.size, wordsB.size);
}

export function detectLoop(messages: Message[]): LoopLevel {
  const user = messages.filter(m => m.role === "user");
  if (user.length < 2) return "none";
  const recent = user.slice(-8);
  const last = recent[recent.length - 1].content;
  const similar = recent.slice(0, -1).filter(m => wordSimilarity(m.content, last) > 0.55);
  if (similar.length >= 3) return "high";
  if (similar.length >= 2) return "medium";
  if (similar.length >= 1) return "low";
  return "none";
}
