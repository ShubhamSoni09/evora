type SessionPayload = {
  userId: string;
  domain: string;
  exp: number;
};

function decodeBase64Url(b64: string): string {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(base64);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySessionTokenEdge(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig || !secret) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b64));
    if (!timingSafeEqualHex(sig, toHex(mac))) return null;

    const data = JSON.parse(decodeBase64Url(b64)) as SessionPayload;
    if (!data.userId || !data.domain || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function middlewareAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") return "";
  return "evora-dev-secret";
}
