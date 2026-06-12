const _cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000;

export function getCached<T>(key: string): T | undefined {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T;
  return undefined;
}

export function setCached(key: string, data: unknown): void {
  _cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(...keys: string[]): void {
  if (keys.length === 0) { _cache.clear(); return; }
  keys.forEach(k => _cache.delete(k));
}

export async function cachedFetch<T>(url: string): Promise<T> {
  const cached = getCached<T>(url);
  if (cached !== undefined) return cached;
  const res = await fetch(url);
  if (!res.ok) throw res;
  const data: T = await res.json();
  setCached(url, data);
  return data;
}
