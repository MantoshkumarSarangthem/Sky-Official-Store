const _cache = new Map<string, { data: unknown; ts: number; ttl: number }>();

const DEFAULT_TTL = 300_000;

export function getCached<T>(key: string): T | undefined {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < entry.ttl) return entry.data as T;
  return undefined;
}

export function setCached(key: string, data: unknown, ttl = DEFAULT_TTL): void {
  _cache.set(key, { data, ts: Date.now(), ttl });
}

export function invalidateCache(...keys: string[]): void {
  if (keys.length === 0) { _cache.clear(); return; }
  keys.forEach(k => _cache.delete(k));
}

export async function cachedFetch<T>(url: string, cacheTtlMs = DEFAULT_TTL, fetchTimeoutMs = 10000): Promise<T> {
  const cached = getCached<T>(url);
  if (cached !== undefined) return cached;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), fetchTimeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw res;
    const data: T = await res.json();
    setCached(url, data, cacheTtlMs);
    return data;
  } finally {
    clearTimeout(timer);
  }
}
