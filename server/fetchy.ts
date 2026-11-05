// Wikimedia asks for a descriptive User-Agent with contact info; set TRIPFILL_CONTACT in .env to your email/URL.
export const UA = `TripFill/1.5.2 (local trip planner; ${process.env.TRIPFILL_CONTACT || "self-hosted"}) node-fetch`;
import fs from "fs"; import path from "path"; import crypto from "crypto";
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 24 * 3600e3; // Wikipedia/Wikidata/OSRM answers change slowly
const DIR = path.resolve(process.env.TRIPFILL_CACHE_DIR || ".cache/http");
try { fs.mkdirSync(DIR, { recursive: true }); } catch { /* read-only fs: memory only */ }
const file = (k: string) => path.join(DIR, crypto.createHash("sha1").update(k).digest("hex") + ".json");
function diskGet(k: string): unknown | undefined {
  try { const f = file(k); const st = fs.statSync(f); if (Date.now() - st.mtimeMs < TTL) return JSON.parse(fs.readFileSync(f, "utf8")); } catch { /* miss */ }
  return undefined;
}
function put(k: string, data: unknown) {
  cache.set(k, { at: Date.now(), data }); if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  fs.promises.writeFile(file(k), JSON.stringify(data)).catch(() => {});
}
/** Memoise any async lookup in memory + on disk (24 h). Empty results are not cached. */
export let failures = 0; // any failed/throttled upstream call; cached() skips storing results built while calls failed
export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key); if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  const d = diskGet(key); if (d !== undefined) { cache.set(key, { at: Date.now(), data: d }); return d as T; }
  const f0 = failures; const v = await fn(); if (failures === f0 && v != null && !(Array.isArray(v) && !v.length)) put(key, v); return v;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function getJSON<T = any>(url: string, timeoutMs = 15000): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  const dk = diskGet(url); if (dk !== undefined) { cache.set(url, { at: Date.now(), data: dk }); return dk as T; }
  const t0 = Date.now();
  try { return await getJSON0<T>(url, timeoutMs); } finally { if (process.env.TRIPFILL_DEBUG && Date.now() - t0 > 2000) console.log("slow", Date.now() - t0, url.slice(0, 140)); }
}
// Wikimedia throttles bursts (429 + Retry-After): cap concurrent requests per host instead of backing off for seconds
const active = new Map<string, number>(); const waiting = new Map<string, (() => void)[]>();
const LIMIT = (h: string) => /wiki(pedia|voyage|data)\.org$/.test(h) ? 3 : 6;
async function slot<T>(host: string, fn: () => Promise<T>): Promise<T> {
  if ((active.get(host) || 0) >= LIMIT(host)) await new Promise<void>(r => { const q = waiting.get(host) || []; q.push(r); waiting.set(host, q); });
  active.set(host, (active.get(host) || 0) + 1);
  try { return await fn(); } finally { active.set(host, active.get(host)! - 1); waiting.get(host)?.shift()?.(); }
}
async function getJSON0<T>(url: string, timeoutMs: number): Promise<T> {
  return getJSONs<T>(url, timeoutMs).catch(e => { failures++; throw e; });
}
async function getJSONs<T>(url: string, timeoutMs: number): Promise<T> { if (process.env.TRIPFILL_DEBUG) console.log("REQ", url.slice(0, 110)); return slot(new URL(url).host, () => getJSON1<T>(url, timeoutMs)); }
async function getJSON1<T>(url: string, timeoutMs: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal });
      if ((r.status === 429 || r.status >= 500) && attempt < 3) {
        if (process.env.TRIPFILL_DEBUG) console.log("retry", r.status, r.headers.get("retry-after"), url.slice(0, 80));
        const ra = Number(r.headers.get("retry-after")) || 0; // honour short waits; long throttles fail fast (result is then not cached)
        if (ra > 8) throw new Error(`HTTP 429 (retry after ${ra}s) for ${url}`);
        await sleep(Math.min(ra * 1000 || 300 * 2 ** attempt, 8000));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      const data = await r.json();
      put(url, data);
      return data as T;
    } finally { clearTimeout(t); }
  }
}
