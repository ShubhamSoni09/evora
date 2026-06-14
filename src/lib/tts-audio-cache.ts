type CacheEntry = { audio: ArrayBuffer; mime: string; expiresAt: number };

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 64;
const cache = new Map<string, CacheEntry>();

function cacheKey(text: string, provider: string) {
  return `${provider}:${text}`;
}

export function getCachedTtsAudio(text: string, provider: string): CacheEntry | null {
  const key = cacheKey(text, provider);
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit;
}

export function setCachedTtsAudio(text: string, provider: string, audio: ArrayBuffer, mime: string) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey(text, provider), {
    audio,
    mime,
    expiresAt: Date.now() + TTL_MS,
  });
}
