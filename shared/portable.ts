import { validatePacking, migratePacking, syncPackingMembers } from "./packing.js";
import LZ from "lz-string";
export const MAX_PLAN_BYTES = 750_000;
export const MAX_LINK_CHARS = 100_000;
const fail = (s: string): never => { throw new Error(s); };
export const validDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
export function safeUrl(v: unknown): string | undefined { if (typeof v !== "string") return; try { const u = new URL(v); return /^(https?:)$/.test(u.protocol) && !u.username && !u.password ? u.href : undefined; } catch { return; } }
// Data only: bounded trees, no prototype keys, no active URL schemes. React renders strings as text.
function clean(v: any, depth = 0, count = { n: 0 }): any {
  if (++count.n > 45000 || depth > 24) fail("Plan is too complex. Export a smaller trip.");
  if (typeof v === "string") { if (v.length > 30000) fail("A plan text field is too long."); return v; }
  if (v === null || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : fail("Plan contains an invalid number.");
  if (Array.isArray(v)) { if (v.length > 1000) fail("A plan list is too long."); return v.map(x => clean(x, depth + 1, count)); }
  if (!v || typeof v !== "object") fail("Plan contains unsupported data.");
  const out: any = {};
  for (const [k, x] of Object.entries(v)) {
    if (["__proto__", "constructor", "prototype"].includes(k)) fail("Unsafe property in plan. Use an original TripFill export.");
    if (/url$/i.test(k)) { const u = safeUrl(x); if (u) out[k] = u; }
    else { if ((k === "lat" || k === "lon") && x != null && (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > (k === "lat" ? 90 : 180))) fail("Invalid geographic coordinates in plan."); out[k] = clean(x, depth + 1, count); }
  }
  return out;
}
type Rule = string | { [key: string]: Rule } | [Rule];
function check(v: any, rule: Rule, path: string) {
  if (typeof rule === "string") {
    const optional = rule.endsWith("?"); const t = rule.replace(/\?$/, "");
    if (optional && v == null) return;
    if (t === "date" ? !validDate(v) : t === "array" ? !Array.isArray(v) : typeof v !== t || (t === "object" && Array.isArray(v)) || (t === "number" && !Number.isFinite(v))) fail(`Invalid ${path}. Choose a complete TripFill JSON export.`);
  } else if (Array.isArray(rule)) { if (!Array.isArray(v)) fail(`Missing ${path} list.`); v.forEach((x: any, i: number) => check(x, rule[0], `${path}[${i}]`)); }
  else { if (!v || typeof v !== "object" || Array.isArray(v)) fail(`Missing ${path}.`); for (const [k, r] of Object.entries(rule)) check(v[k], r, `${path}.${k}`); }
}
const item = { id: "string", item: "string", reason: "string?", checked: "boolean" };
const place = { id: "number?", name: "string", country: "string", countryCode: "string", lat: "number", lon: "number", admin1: "string?", timezone: "string?" };
const eat = { name: "string", kind: "string", source: "string?", tag: "string?", description: "string?", area: "string?", km: "number?", lat: "number?", lon: "number?", leg: "string?", cuisineEvidence: "string?", retrievedAt: "string?", dietary: "object?", dietaryStatus: "string?" };
const budget = { currency: "string", localCurrency: "string?", usdRate: "number?", pli: "number?", note: "string?", fxNote: "string?", lines: [{ category: "string", basis: "string", total: "number", low: "number", high: "number" }] } as Rule;
export function validatePlan(raw: any): any {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("Not a TripFill plan. Choose a complete TripFill JSON export.");
  if (new TextEncoder().encode(JSON.stringify(raw)).length > MAX_PLAN_BYTES) fail("Plan exceeds 750 KB. Export a smaller trip.");
  let p = clean(raw);
  if (p.format !== undefined) { if (p.format !== "tripfill" || p.schemaVersion !== 1) fail("Unsupported export version. Update TripFill or use a version 1 export."); p = p.plan; }
  check(p, {
    place, generatedAt: "string", title: "string?", input: { destination: "string", start: "date", end: "date", travelers: "number?", purpose: "string?", style: "string?", interests: "string?", presets: "array?" },
    weather: { source: "string", note: "string", days: [{ date: "date", tmax: "number", tmin: "number", summary: "string", typical: "boolean?", receivedAt: "string?", precipProb: "number?", leg: "string?" }], stats: { avgHigh: "number", avgLow: "number", minLow: "number", maxHigh: "number", rainyDays: "number" } },
    highlights: [{ name: "string", description: "string", source: "string?", setting: "string?", type: "string?", lat: "number?", lon: "number?", leg: "string?" }],
    packing: { groups: [{ group: "string", items: [item] }], leaveAtHome: [item] },
    itinerary: [{ date: "date", label: "string", weather: "string", morning: "string", afternoon: "string", evening: "string", notes: "string", rainyBackup: "string?", leg: "string?" }],
    timeline: [{ id: "string", due: "date", task: "string", done: "boolean" }], budget, sources: ["string"]
  }, "plan");
  validatePacking(p.packing);
  p.packing = syncPackingMembers(migratePacking(p.packing), Math.max(1, Number(p.input.travelers) || 1));
  if (!Number.isFinite(Date.parse(p.generatedAt))) fail("Invalid plan generation timestamp.");
  if (p.input.end < p.input.start || !p.place.name.trim() || Math.abs(p.place.lat) > 90 || Math.abs(p.place.lon) > 180) fail("Invalid destination or date range in plan.");
  // Early versions serialized travelers from an input as a string. Migrated below before validation in parsePlan.
  if (p.input.dietaryNeeds !== undefined && !["none", "vegetarian", "vegan", "gluten_free", "halal"].includes(p.input.dietaryNeeds)) fail("Unsupported dietary preference.");
  if (p.input.walkingTolerance !== undefined && !["low", "standard", "high"].includes(p.input.walkingTolerance)) fail("Unsupported walking tolerance.");
  p.input = { ...p.input, ...normalizePreferences(p.input) };
  if (!["forecast", "typical", "mixed"].includes(p.weather.source)) fail("Invalid weather source in plan.");
  for (const day of p.weather.days) if (day.typical === undefined && p.weather.source !== "mixed") day.typical = p.weather.source === "typical";
  if (p.input.presets?.some((x: any) => typeof x !== "string")) fail("Invalid trip types.");
  if (p.input.legs !== undefined) check(p.input.legs, [{ destination: "string", start: "date" }], "plan.input.legs");
  if (p.matches !== undefined) check(p.matches, [place], "plan.matches");
  if (p.prep !== undefined) check(p.prep, [{ id: "string", task: "string", done: "boolean", why: "string?" }], "plan.prep");
  if (p.eats !== undefined) { check(p.eats, { restaurants: [eat], cafes: [eat] }, "plan.eats"); for (const e of [...p.eats.restaurants, ...p.eats.cafes]) { if (!e.sourceUrl) { delete e.retrievedAt; e.cuisineEvidence = "unknown"; e.dietaryStatus = "Dietary information unverified — contact venue"; delete e.dietary; } if (e.dietary) for (const x of Object.values(e.dietary)) if (!["yes", "no", "only", "unknown"].includes(x as string)) fail("Invalid dietary metadata."); } }
  if (p.legs !== undefined) check(p.legs, [{ place, start: "date", end: "date", nights: "number", budget, fromPrev: "object?", alternatives: "array?" }], "plan.legs");
  if (p.legs) for (const leg of p.legs) { if (leg.alternatives) check(leg.alternatives, [place], "plan.legs.alternatives"); if (leg.fromPrev) check(leg.fromPrev, { flightLabel: "string" }, "plan.legs.fromPrev"); }
  if (p.weather.legs !== undefined) check(p.weather.legs, [{ name: "string", stats: { avgHigh: "number", avgLow: "number", rainyDays: "number" } }], "plan.weather.legs");
  if (p.trip !== undefined && p.trip !== null) check(p.trip, { home: place, domestic: "boolean", distanceKm: "number", flightLabel: "string", tzLabel: "string", destTz: "string?", homeTz: "string?", homeCurrency: "string?" }, "plan.trip");
  return p;
}
export function normalizePreferences(p: any = {}): { style: "Slow" | "Mix" | "Packed"; interests: string; dietaryNeeds: string; walkingTolerance: string } {
  return { style: ["Slow", "Mix", "Packed"].includes(p.style) ? p.style : "Mix", interests: typeof p.interests === "string" ? p.interests.slice(0, 500) : "", dietaryNeeds: ["none", "vegetarian", "vegan", "gluten_free", "halal"].includes(p.dietaryNeeds) ? p.dietaryNeeds : "none", walkingTolerance: ["low", "standard", "high"].includes(p.walkingTolerance) ? p.walkingTolerance : "standard" };
}
export function parsePlan(text: string): any {
  if (new TextEncoder().encode(text).length > MAX_PLAN_BYTES) fail("File exceeds 750 KB. Choose a smaller TripFill export.");
  let raw: any; try { raw = JSON.parse(text); } catch { return fail("Invalid JSON. Choose a TripFill .json export, not a PDF or ZIP."); }
  const p = raw?.format ? raw.plan : raw;
  if (p?.input && typeof p.input.travelers === "string" && /^\d+$/.test(p.input.travelers)) p.input.travelers = Number(p.input.travelers);
  return validatePlan(raw);
}
export function exportPlan(plan: any) {
  const snapshot = parsePlan(JSON.stringify(plan));
  // Local undo buffers may contain deleted personal text; never distribute them.
  delete snapshot.packing.lastRemoved;
  const envelope = { format: "tripfill", schemaVersion: 1, exportedAt: new Date().toISOString(), plan: snapshot };
  let text = JSON.stringify(envelope, null, 2);
  if (new TextEncoder().encode(text).length > MAX_PLAN_BYTES) text = JSON.stringify(envelope);
  if (new TextEncoder().encode(text).length > MAX_PLAN_BYTES) fail("Export exceeds 750 KB. Remove some custom content first.");
  return text;
}
// Compact LZ links use a bounded decoder to prevent decompression bombs. lz-string's UTF16
// dictionary decoder is copied to a small, size-limited adaptation in boundedLz.ts.
import { boundedDecompress } from "./boundedLz";
export function encodePlan(plan: any): string { const out = LZ.compressToEncodedURIComponent(exportPlan(plan)); if (out.length > MAX_LINK_CHARS) fail("Plan is too large for a reliable link. Use Export JSON and send the file instead."); return out; }
export function decodePlan(hash: string): any {
  if (!hash || hash.length > MAX_LINK_CHARS || !/^[A-Za-z0-9+$ -]+$/.test(hash)) fail("Share link is too large or damaged. Ask for the JSON export.");
  const text = boundedDecompress(hash, MAX_PLAN_BYTES); if (!text) fail("Share link is damaged or truncated. Ask the sender for a fresh link or JSON export."); return parsePlan(text);
}
export const STORAGE_KEY = "tripfill:v1";
export function readSaved(storage: Pick<Storage, "getItem">) { const text = storage.getItem(STORAGE_KEY); if (!text) return null; const v = JSON.parse(text); return { form: { ...v.form, ...normalizePreferences(v.form) }, plan: v.plan ? parsePlan(JSON.stringify(v.plan)) : null }; }
export function savePlan(storage: Pick<Storage, "setItem">, form: any, plan: any) { storage.setItem(STORAGE_KEY, JSON.stringify({ form, plan })); }

/** Legacy mixed plans lacking per-day evidence do not acquire an invented forecast label. */
export function weatherLabel(day: { typical?: boolean } | undefined, source: string): string {
  if (day?.typical === true || source === "typical") return "Seasonal estimate (not forecast)";
  if (day?.typical === false || source === "forecast") return "Open-Meteo forecast";
  return "Weather basis unknown — regenerate for source labels";
}
