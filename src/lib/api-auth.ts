import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  userForSession,
  verifySessionToken,
  type AuthUser,
} from "@/lib/auth";
import type { Domain } from "@/lib/domains";

export type AuthSession = {
  user: AuthUser;
  domain: Domain;
};

export async function getAuthSession(): Promise<AuthSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = userForSession(payload);
  if (!user) return null;

  return { user, domain: user.domain };
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireAuth(): Promise<AuthSession | Response> {
  const session = await getAuthSession();
  return session ?? unauthorized();
}

export async function requireRoles(
  ...roles: Domain[]
): Promise<AuthSession | Response> {
  const session = await requireAuth();
  if (session instanceof Response) return session;
  if (!roles.includes(session.domain)) return forbidden();
  return session;
}
