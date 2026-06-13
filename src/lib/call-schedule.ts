import { PATIENT_TIMEZONE } from "./patient";

export type CallSlot = {
  id: string;
  label: string;
  hour: number;
  minute: number;
  greeting: string;
};

/** Proactive outbound calls — aligned with sundowning copilot windows */
export const PROACTIVE_CALL_SLOTS: CallSlot[] = [
  {
    id: "morning",
    label: "Morning check-in",
    hour: 10,
    minute: 0,
    greeting:
      "Hi Margaret, it's evora. I was just thinking about you and wanted to hear your voice. How are you feeling right now?",
  },
  {
    id: "sundown",
    label: "Sundown check-in",
    hour: 17,
    minute: 0,
    greeting:
      "Hi Margaret, it's evora. The evening's settling in — I'm here with you. What's on your mind right now?",
  },
  {
    id: "evening",
    label: "Evening comfort call",
    hour: 19,
    minute: 0,
    greeting:
      "Hi Margaret, it's evora. I wanted to check in before the night gets quiet. How are you feeling?",
  },
];

export function getNextScheduledCall(now = new Date()): { at: Date; slot: CallSlot } | null {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PATIENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  const y = Number(parts.year);
  const mo = Number(parts.month) - 1;
  const d = Number(parts.day);
  const h = Number(parts.hour);
  const mi = Number(parts.minute);
  const localNow = new Date(y, mo, d, h, mi);

  const candidates = PROACTIVE_CALL_SLOTS.map((slot) => {
    const at = new Date(y, mo, d, slot.hour, slot.minute);
    if (at <= localNow) at.setDate(at.getDate() + 1);
    return { at, slot };
  }).sort((a, b) => a.at.getTime() - b.at.getTime());

  return candidates[0] ?? null;
}

export function formatScheduledTime(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: PATIENT_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function activeSlot(now = new Date()): CallSlot | null {
  const h = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PATIENT_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  if (h === 10) return PROACTIVE_CALL_SLOTS[0];
  if (h === 17) return PROACTIVE_CALL_SLOTS[1];
  if (h === 19) return PROACTIVE_CALL_SLOTS[2];
  return null;
}
