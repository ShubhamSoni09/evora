import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSessionToken,
  findUserByUsername,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username?.trim() || !password) {
    return Response.json({ error: "Username and password required" }, { status: 400 });
  }

  const user = findUserByUsername(username);
  if (!user || !verifyPassword(username, password)) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = createSessionToken(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

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
