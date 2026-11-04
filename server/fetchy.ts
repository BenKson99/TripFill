// Wikimedia asks for a descriptive User-Agent with contact info; set TRIPFILL_CONTACT in .env to your email/URL.
export const UA = `TripFill/1.1 (local trip planner; ${process.env.TRIPFILL_CONTACT || "self-hosted"}) node-fetch`;
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 3600e3;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function getJSON<T = any>(url: string, timeoutMs = 15000): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal });
      if ((r.status === 429 || r.status >= 500) && attempt < 3) {
        const ra = Number(r.headers.get("retry-after")) || 0;
        await sleep(Math.min(ra * 1000 || 800 * 2 ** attempt, 5000));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      const data = await r.json();
      cache.set(url, { at: Date.now(), data });
      if (cache.size > 2000) cache.delete(cache.keys().next().value!);
      return data as T;
    } finally { clearTimeout(t); }
  }
}
