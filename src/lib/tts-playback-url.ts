import { getPublicAppUrl } from "@/lib/app-url";

export function buildTtsPlayUrl(
  sessionId: string,
  index: number,
  baseUrl?: string | null
): string | null {
  const base = baseUrl ?? getPublicAppUrl();
  if (!base) return null;
  return `${base}/api/voice/play/${sessionId}/${index}`;
}
