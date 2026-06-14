import { createHmac, timingSafeEqual } from "crypto";
import type { Domain } from "./domains";
import {
  type AuthUser,
  findUserById,
  findUserByUsername,
} from "./auth-users";
import { isProduction } from "./env";

export {
  AUTH_USERS,
  type AuthUser,
  findUserById,
  findUserByUsername,
} from "./auth-users";

export const SESSION_COOKIE = "evora_session";

const DEV_PASSWORDS: Record<string, string> = {
  margaret: "evora",
  james: "evora",
  sarah: "evora",
};

function authSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (isProduction()) {
    throw new Error("AUTH_SECRET is required in production");
  }
  return "evora-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("hex");
}

export type SessionPayload = {
  userId: string;
  domain: Domain;
  exp: number;
};

export function createSessionToken(user: AuthUser): string {
  const payload: SessionPayload = {
    userId: user.id,
    domain: user.domain,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  try {
    const expected = sign(b64);
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as SessionPayload;
    if (!data.userId || !data.domain || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifyPassword(username: string, password: string): boolean {
  const user = findUserByUsername(username);
  if (!user) return false;
  const envKey = `AUTH_PASSWORD_${user.domain.toUpperCase()}` as keyof NodeJS.ProcessEnv;
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return password === fromEnv;
  if (isProduction()) return false;
  return password === DEV_PASSWORDS[user.username];
}

export function userForSession(session: SessionPayload): AuthUser | null {
  const user = findUserById(session.userId);
  if (!user || user.domain !== session.domain) return null;
  return user;
}
