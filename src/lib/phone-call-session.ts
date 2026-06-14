import type { Message } from "./types";
import {
  dbDeletePhoneSession,
  dbLoadPhoneSession,
  dbSavePhoneSession,
} from "./db/ephemeral-sessions";

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
const local = new Map<string, PhoneCallSession>();

function purgeLocal() {
  const now = Date.now();
  for (const [id, s] of local) {
    if (s.expiresAt <= now) local.delete(id);
  }
}

export async function createPhoneSession(opts: {
  role: PhoneCallRole;
  openerParts: string[];
  maxTurns?: number;
  webhookBase?: string | null;
}): Promise<string> {
  purgeLocal();
  const id = crypto.randomUUID().replace(/-/g, "");
  const session: PhoneCallSession = {
    id,
    role: opts.role,
    messages: [],
    openerParts: opts.openerParts.filter(Boolean),
    turnCount: 0,
    reprompts: 0,
    maxTurns: opts.maxTurns ?? (opts.role === "patient" ? 8 : 5),
    webhookBase: opts.webhookBase ?? null,
    expiresAt: Date.now() + TTL_MS,
  };

  local.set(id, session);
  await dbSavePhoneSession(session);
  return id;
}

export async function getPhoneSession(id: string): Promise<PhoneCallSession | null> {
  purgeLocal();
  const fromDb = await dbLoadPhoneSession(id);
  if (fromDb) {
    local.set(id, fromDb);
    return fromDb;
  }

  const session = local.get(id);
  if (!session || session.expiresAt <= Date.now()) {
    local.delete(id);
    return null;
  }
  return session;
}

export async function updatePhoneSession(
  id: string,
  patch: Partial<PhoneCallSession>
): Promise<PhoneCallSession | null> {
  const session = await getPhoneSession(id);
  if (!session) return null;
  Object.assign(session, patch);
  session.expiresAt = Date.now() + TTL_MS;
  local.set(id, session);
  await dbSavePhoneSession(session);
  return session;
}

export async function appendPhoneMessages(
  id: string,
  next: Message[]
): Promise<PhoneCallSession | null> {
  const session = await getPhoneSession(id);
  if (!session) return null;
  session.messages = [...session.messages, ...next].slice(-40);
  session.expiresAt = Date.now() + TTL_MS;
  local.set(id, session);
  await dbSavePhoneSession(session);
  return session;
}

export async function expirePhoneSession(id: string): Promise<void> {
  local.delete(id);
  await dbDeletePhoneSession(id);
}
