import { randomBytes } from "crypto";
import { dbLoadTtsPart, dbSaveTtsSession } from "./db/ephemeral-sessions";

type TtsSession = {
  parts: string[];
  expiresAt: number;
};

const TTL_MS = 15 * 60 * 1000;
const local = new Map<string, TtsSession>();

function purgeExpired() {
  const now = Date.now();
  for (const [id, session] of local) {
    if (session.expiresAt <= now) local.delete(id);
  }
}

export async function registerTtsSession(parts: string[]): Promise<string> {
  purgeExpired();
  const id = randomBytes(16).toString("hex");
  const session: TtsSession = {
    parts: parts.map((p) => p.trim()).filter(Boolean),
    expiresAt: Date.now() + TTL_MS,
  };
  local.set(id, session);
  await dbSaveTtsSession(id, session.parts, session.expiresAt);
  return id;
}

export async function getTtsSessionPart(
  sessionId: string,
  index: number
): Promise<string | null> {
  purgeExpired();

  const fromDb = await dbLoadTtsPart(sessionId, index);
  if (fromDb) return fromDb;

  const session = local.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    local.delete(sessionId);
    return null;
  }
  return session.parts[index] ?? null;
}
