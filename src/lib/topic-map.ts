import type { Message } from "./types";

const STOP = new Set([
  "i","me","my","myself","we","our","the","a","an","and","but","or","in","on","at","to",
  "for","of","with","is","was","are","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","it","its","this","that","these","those",
  "what","who","when","where","how","yes","no","not","so","if","just","very","really",
  "oh","ok","okay","well","um","uh","like","you","your","he","she","they","them","their",
  "here","there","then","now","also","back","up","out","about","got","get","know","think",
  "want","need","feel","dont","cant","wont","its","im","ive","iam","thats","its",
  "tell","about","what","whats","would","could","should","been","being","still","much",
  "more","some","something","someone","into","from","over","after","before","today",
]);

/** Meaningful multi-word topics for dementia conversations */
const TOPIC_PHRASES: { pattern: RegExp; label: string }[] = [
  { pattern: /rose\s+garden/i, label: "rose garden" },
  { pattern: /harold/i, label: "Harold" },
  { pattern: /medicine|medication|pill/i, label: "medicine" },
  { pattern: /lonely|loneliness/i, label: "loneliness" },
  { pattern: /family|daughter|son|sarah/i, label: "family" },
  { pattern: /home|house/i, label: "home" },
  { pattern: /garden/i, label: "garden" },
  { pattern: /remember|memory|memories/i, label: "memories" },
  { pattern: /sleep|night|morning|afternoon/i, label: "daily rhythm" },
  { pattern: /scared|afraid|worried/i, label: "worry" },
  { pattern: /confused|lost/i, label: "confusion" },
];

export interface Topic { word: string; count: number; pct: number; }

function messageText(content: unknown): string {
  return typeof content === "string" ? content : "";
}

export function extractTopics(messages: Message[], limit = 8): Topic[] {
  const freq: Record<string, number> = {};

  for (const m of messages.filter((m) => m.role === "user")) {
    const text = messageText(m.content);
    if (!text) continue;
    const matchedPhrases = new Set<string>();
    for (const { pattern, label } of TOPIC_PHRASES) {
      if (pattern.test(text)) {
        freq[label] = (freq[label] ?? 0) + 1;
        matchedPhrases.add(label.toLowerCase());
      }
    }
    for (const w of (text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [])) {
      if (!STOP.has(w) && ![...matchedPhrases].some((p) => p.includes(w))) {
        freq[w] = (freq[w] ?? 0) + 1;
      }
    }
  }

  const entries = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const max = entries[0]?.[1] ?? 1;
  return entries.map(([word, count]) => ({ word, count, pct: Math.round((count / max) * 100) }));
}

const POSITIVE = new Set([
  "good", "well", "happy", "love", "loved", "nice", "wonderful", "thank", "thanks", "great",
  "okay", "fine", "yes", "better", "enjoy", "remember", "beautiful", "warm", "safe", "calm",
  "peaceful", "glad", "smile", "laugh", "laughing", "comfortable", "relaxed", "content",
  "grateful", "blessed", "sweet", "lovely", "pleasant", "cheerful", "delight", "hopeful",
  "proud", "excited", "wonderful", "perfect", "amazing", "fantastic", "alright", "relief",
]);

const NEGATIVE = new Set([
  "scared", "confused", "lost", "worried", "upset", "afraid", "help", "hurt", "where", "stop",
  "please", "miss", "missing", "gone", "dead", "alone", "lonely", "forget", "forgot", "dizzy",
  "strange", "anxious", "anxiety", "panic", "crying", "cry", "sad", "angry", "mad", "frightened",
  "terrified", "nervous", "trapped", "stuck", "wrong", "bad", "terrible", "awful", "pain", "aching",
  "nightmare", "dark", "cold", "nobody", "nothing", "never", "cant", "cannot", "dont", "wont",
]);

const POSITIVE_PHRASES = [
  /feeling (?:good|better|fine|okay|ok|well)/i,
  /thank you/i,
  /i remember/i,
  /that(?:'s| is) (?:nice|wonderful|sweet|lovely)/i,
  /makes? me happy/i,
  /glad to (?:hear|talk|see)/i,
  /love (?:you|this|that)/i,
  /tell me about/i,
  /rose garden/i,
  /peaceful|calm|comfortable/i,
  /nice to (?:talk|hear|see)/i,
  /good (?:memory|memories)/i,
];

const REMINISCENCE_PHRASES = [
  /tell me about/i,
  /remember (?:when|the|him|her)/i,
  /used to/i,
  /back (?:then|in the day)/i,
  /harold/i,
  /rose garden/i,
  /what comes to mind/i,
];

const NEGATIVE_PHRASES = [
  /don'?t know where/i,
  /can'?t find/i,
  /where (?:am i|is (?:everyone|he|she|they|my))/i,
  /who are you/i,
  /i'?m (?:scared|lost|alone|confused|worried|afraid)/i,
  /help me/i,
  /something(?:'s| is) wrong/i,
  /want (?:to go home|my (?:mom|mother|dad|father|husband|wife))/i,
  /nobody (?:here|cares)/i,
  /can'?t remember/i,
  /feel(?:ing)? (?:bad|awful|terrible|sick|strange)/i,
  /what(?:'s| is) (?:happening|going on)/i,
];

function cleanWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z']/g, "").replace(/'s$/, "");
}

function scoreMessage(content: string): number {
  const text = content.trim();
  if (!text) return 0;

  let score = 0;
  const lower = text.toLowerCase();
  const hasDistress = NEGATIVE_PHRASES.some((p) => p.test(text)) ||
    [...NEGATIVE].some((w) => lower.includes(w));

  for (const pattern of NEGATIVE_PHRASES) {
    if (pattern.test(text)) score -= 1.5;
  }
  for (const pattern of POSITIVE_PHRASES) {
    if (pattern.test(text)) score += 1.2;
  }
  for (const pattern of REMINISCENCE_PHRASES) {
    if (pattern.test(text)) score += 1.0;
  }

  const words = text.split(/\s+/).map(cleanWord).filter(Boolean);
  for (const word of words) {
    if (POSITIVE.has(word)) score += 0.8;
    if (NEGATIVE.has(word)) score -= 0.8;
  }

  const questionMarks = (text.match(/\?/g) ?? []).length;
  if (!hasDistress) {
    if (questionMarks === 1) score += 0.15;
    else if (questionMarks >= 2) score -= 0.2;
  } else if (questionMarks >= 2) {
    score -= 0.5;
  }

  if (/!{2,}/.test(text)) score -= 0.4;

  const exclamations = (text.match(/!/g) ?? []).length;
  if (exclamations >= 3) score -= 0.3;

  return Math.max(-1, Math.min(1, score / 2));
}

export interface TonePoint {
  score: number;
  label: string;
  color: string;
  snippet: string;
}

export function getEmotionalTimeline(messages: Message[], slots = 12): (TonePoint | null)[] {
  const userMsgs = messages.filter((m) => m.role === "user" && messageText(m.content));
  const points: TonePoint[] = userMsgs.map((m) => {
    const content = messageText(m.content);
    const score = scoreMessage(content);
    return {
      score,
      label: getEmotionalLabel(score),
      color: getBarColor(score),
      snippet: content.slice(0, 42) + (content.length > 42 ? "…" : ""),
    };
  });

  const timeline: (TonePoint | null)[] = Array(slots).fill(null);
  const slice = points.slice(-slots);
  slice.forEach((p, i) => {
    timeline[slots - slice.length + i] = p;
  });
  return timeline;
}

export function getSentiment(messages: Message[]): number[] {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => scoreMessage(messageText(m.content)));
}

export function getEmotionalLabel(avg: number): string {
  if (avg >= 0.35) return "engaged / calm";
  if (avg >= 0.12) return "settled";
  if (avg <= -0.35) return "distressed";
  if (avg <= -0.12) return "uneasy";
  return "neutral";
}

export function getEmotionalColor(avg: number): string {
  if (avg >= 0.12) return "#059669";
  if (avg <= -0.12) return "#dc2626";
  return "#c9a86c";
}

export function getBarColor(score: number): string {
  if (score >= 0.12) return "#059669";
  if (score <= -0.12) return "#dc2626";
  return "#c9a86c";
}

function barHeight(score: number): number {
  const base = 14;
  const intensity = Math.max(0.18, Math.abs(score));
  return base + intensity * 38;
}

export function getLatestEmotionalSummary(messages: Message[]): {
  label: string;
  color: string;
  latestScore: number;
} {
  const scores = getSentiment(messages);
  if (!scores.length) {
    return { label: "no data yet", color: "#b0a480", latestScore: 0 };
  }
  const latestScore = scores[scores.length - 1]!;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return {
    label: getEmotionalLabel(latestScore !== 0 ? latestScore : avg),
    color: getEmotionalColor(latestScore !== 0 ? latestScore : avg),
    latestScore,
  };
}

export { barHeight };

const DAYS    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function getGrounding() {
  const now = new Date();
  const h = now.getHours();
  const timeOfDay = h < 6 ? "Night" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : h < 21 ? "Evening" : "Night";
  const weather   = "Sunny"; // could wire to a weather API later
  return {
    day: DAYS[now.getDay()],
    date: `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
    timeOfDay,
    weather,
  };
}

export type AgitationRisk = "low" | "medium" | "high";

export function getSundownRisk(): { risk: AgitationRisk; pct: number; note: string; action: string } {
  const h = new Date().getHours();
  if (h >= 17 && h <= 21) {
    const pcts = [55, 72, 88, 78, 62];
    const pct  = pcts[h - 17] ?? 72;
    return {
      risk:   pct >= 80 ? "high" : "medium",
      pct,
      note:   `${["5 PM","6 PM","7 PM","8 PM","9 PM"][h - 17]} · Sundowning window active`,
      action: "Proactive call recommended — try calming music or a familiar voice message.",
    };
  }
  if (h >= 22 || h <= 5) {
    return { risk: "medium", pct: 40, note: "Late night · Confusion risk elevated", action: "Monitor for disorientation if patient wakes." };
  }
  return { risk: "low", pct: 10, note: "Daytime · Stable window", action: "Good time for memory anchors or activities." };
}
