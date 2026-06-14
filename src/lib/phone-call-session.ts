import type { Message } from "./types";

export type PhoneCallRole = "patient" | "caregiver";

export type PhoneCallSession = {
  id: string;
  role: PhoneCallRole;
  messages: Message[];
  openerParts: string[];
  turnCount: number;
  reprompts: number;
  maxTurns: number;
  webhookBase: string | null;
  expiresAt: number;
};

const TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, PhoneCallSession>();

function purge() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.expiresAt <= now) sessions.delete(id);
  }
}

export function createPhoneSession(opts: {
  role: PhoneCallRole;
  openerParts: string[];
  maxTurns?: number;
  webhookBase?: string | null;
}): string {
  purge();
  const id = crypto.randomUUID().replace(/-/g, "");
  sessions.set(id, {
    id,
    role: opts.role,
    messages: [],
    openerParts: opts.openerParts.filter(Boolean),
    turnCount: 0,
    reprompts: 0,
    maxTurns: opts.maxTurns ?? (opts.role === "patient" ? 8 : 5),
    webhookBase: opts.webhookBase ?? null,
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

export function getPhoneSession(id: string): PhoneCallSession | null {
  purge();
  const session = sessions.get(id);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function updatePhoneSession(id: string, patch: Partial<PhoneCallSession>): PhoneCallSession | null {
  const session = getPhoneSession(id);
  if (!session) return null;
  Object.assign(session, patch);
  session.expiresAt = Date.now() + TTL_MS;
  return session;
}

export function appendPhoneMessages(id: string, next: Message[]): PhoneCallSession | null {
  const session = getPhoneSession(id);
  if (!session) return null;
  session.messages = [...session.messages, ...next].slice(-40);
  session.expiresAt = Date.now() + TTL_MS;
  return session;
}
