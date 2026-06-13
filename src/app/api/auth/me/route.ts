import { cookies } from "next/headers";
import { SESSION_COOKIE, userForSession, verifySessionToken } from "@/lib/auth";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ user: null });

  const session = verifySessionToken(token);
  if (!session) {
    jar.delete(SESSION_COOKIE);
    return Response.json({ user: null });
  }

  const user = userForSession(session);
  if (!user) {
    jar.delete(SESSION_COOKIE);
    return Response.json({ user: null });
  }

  return Response.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      domain: user.domain,
      subtitle: user.subtitle,
    },
  });
}
