/** Public HTTPS base URL — required for Twilio webhooks and ElevenLabs phone playback */
export function getPublicAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return null;
}

/** Infer public URL from an incoming request (works with ngrok / Vercel proxies) */
export function getPublicAppUrlFromRequest(req: Request): string | null {
  const env = getPublicAppUrl();
  if (env) return env;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || host.includes("localhost") || host.startsWith("127.")) return null;

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`.replace(/\/$/, "");
}
