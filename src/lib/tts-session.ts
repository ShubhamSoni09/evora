import { randomBytes } from "crypto";

type TtsSession = {
  parts: string[];
  expiresAt: number;
};

const TTL_MS = 15 * 60 * 1000;
const sessions = new Map<string, TtsSession>();

function purgeExpired() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

export function registerTtsSession(parts: string[]): string {
  purgeExpired();
  const id = randomBytes(16).toString("hex");
  sessions.set(id, {
    parts: parts.map((p) => p.trim()).filter(Boolean),
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

export function getTtsSessionPart(sessionId: string, index: number): string | null {
  purgeExpired();
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session.parts[index] ?? null;
}
