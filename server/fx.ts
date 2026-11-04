import { getJSON } from "./fetchy.js";

export interface FxResult { ok: boolean; base: "USD"; rates: Record<string, number>; source: string; updated: string | null /* ISO time, or YYYY-MM-DD for daily ECB rates */; fetchedAt: string; fallback: boolean; error?: string }

const PRIMARY = "https://open.er-api.com/v6/latest/USD";
const FALLBACK = "https://api.frankfurter.app/latest?from=USD";
const TTL = 6 * 3600e3, MIN_REFRESH = 60e3;
let cache: { at: number; data: FxResult } | null = null;

// force: "fallback" makes the primary fail, "fail" makes both fail (for testing). Also via FX_FORCE env.
export async function getFx(opts: { refresh?: boolean; force?: string } = {}): Promise<FxResult> {
  const force = opts.force || process.env.FX_FORCE || "";
  const age = cache ? Date.now() - cache.at : Infinity;
  if (!force && cache && cache.data.ok && (age < TTL && (!opts.refresh || age < MIN_REFRESH))) return cache.data;
  const now = new Date().toISOString();
  const bust = `${opts.refresh || force ? `${PRIMARY.includes("?") ? "&" : "?"}t=${Date.now()}` : ""}`;
  let primaryErr = "";
  try {
    if (force === "fallback" || force === "fail") throw new Error("primary disabled (forced)");
    const d = await getJSON<any>(PRIMARY + bust, 8000);
    if (d.result !== "success") throw new Error("primary returned " + d.result);
    const data: FxResult = { ok: true, base: "USD", rates: d.rates, source: "open.er-api.com", updated: d.time_last_update_utc ? new Date(d.time_last_update_utc).toISOString() : null, fetchedAt: now, fallback: false };
    if (!force) cache = { at: Date.now(), data }; return data;
  } catch (e) { primaryErr = (e as Error).message; }
  try {
    if (force === "fail") throw new Error("fallback disabled (forced)");
    const d = await getJSON<any>(FALLBACK + (bust ? `&t=${Date.now()}` : ""), 8000);
    const data: FxResult = { ok: true, base: "USD", rates: { ...d.rates, USD: 1 }, source: "frankfurter.app (ECB reference rates; fallback)", updated: d.date || null, fetchedAt: now, fallback: true, error: `primary failed: ${primaryErr}` };
    if (!force) cache = { at: Date.now(), data }; return data;
  } catch (e) {
    if (cache?.data.ok && !force) return { ...cache.data, error: "live refresh failed; showing cached rates" };
    return { ok: false, base: "USD", rates: { USD: 1 }, source: "none", updated: null, fetchedAt: now, fallback: true, error: `primary failed: ${primaryErr}; fallback failed: ${(e as Error).message}` };
  }
}
