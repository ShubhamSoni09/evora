import { detectLoop } from "@/lib/loop-detection";
import { PATIENT_NAME } from "@/lib/patient";
import {
  extractTopics,
  getLatestEmotionalSummary,
} from "@/lib/topic-map";
import type { Alert, Message } from "@/lib/types";

function toneForSpeech(label: string): string {
  if (label === "engaged / calm") return "engaged and calm";
  if (label === "no data yet") return "still quiet";
  return label;
}

function lastUserLine(messages: Message[]): string | null {
  const last = [...messages].reverse().find((m) => m.role === "user" && m.content?.trim());
  if (!last) return null;
  const text = last.content.trim().replace(/[^\x20-\x7E]/g, " ");
  return text.length > 90 ? `${text.slice(0, 90)}` : text;
}

/** Spoken script for caretaker check-in — mirrors the conversation memory map */
export function buildMemoryMapBriefing(
  messages: Message[],
  alerts: Pick<Alert, "severity" | "reason">[] = []
): string[] {
  const first = PATIENT_NAME.split(" ")[0] ?? "Margaret";
  const opener = `Hey James, it's evora. I wanted to give you a quick update on how ${first}'s been doing.`;

  const userMsgs = messages.filter((m) => m.role === "user" && m.content?.trim());
  if (!userMsgs.length) {
    return [
      opener,
      `She hasn't chatted with me yet today. Whenever she's in the mood, she can just open evora and we'll talk.`,
    ];
  }

  const topics = extractTopics(messages, 3);
  const tone = getLatestEmotionalSummary(messages);
  const loop = detectLoop(messages);
  const lastLine = lastUserLine(messages);

  const parts: string[] = [opener];

  const exchangeLine =
    `${first} has had ${userMsgs.length} exchange${userMsgs.length === 1 ? "" : "s"} with me. ` +
    `Her emotional tone is ${toneForSpeech(tone.label)}.`;
  parts.push(exchangeLine);

  if (topics.length) {
    const topicList = topics.map((t) => t.word).join(", ");
    parts.push(`Top topics today: ${topicList}.`);
  }

  if (lastLine) {
    parts.push(`The last thing she said was, ${lastLine}`);
  }

  if (loop === "high") {
    parts.push(`I'm noticing strong repetition in her questions. A gentle check-in might help.`);
  } else if (loop === "medium") {
    parts.push(`She's repeating herself a bit. Keep an eye on the dashboard when you can.`);
  }

  const highAlerts = alerts.filter((a) => a.severity === "high").length;
  if (highAlerts > 0) {
    parts.push(
      `There ${highAlerts === 1 ? "is" : "are"} ${highAlerts} high priority alert${highAlerts === 1 ? "" : "s"} on your dashboard.`
    );
  } else if (alerts.length > 0) {
    parts.push(
      `There ${alerts.length === 1 ? "is" : "are"} ${alerts.length} alert${alerts.length === 1 ? "" : "s"} logged on your dashboard.`
    );
  }

  return parts;
}
