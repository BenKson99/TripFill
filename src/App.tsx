import { PackingWorkspace } from "./Packing";
import { packingProgress } from "../shared/packing";
import { ChecklistCheckbox, ChecklistText } from "./Checklist";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, Link2, Printer, Download, CalendarPlus, Upload, Plane, Sun, Thermometer, Users, Wallet } from "lucide-react";
import { SettingsMenu } from "./SettingsMenu";
import { TravelerFields, travelerRows, editTraveler, withMembers, syncFormMembers } from "./Travelers";
import { TravelModeField } from "./TravelMode";
import { resolveTravelMode, type TravelMode } from "../shared/travel";
import { applyTravelMode } from "../shared/applyTravel";
import { readPackMode, writePackMode } from "./Packing";
import { LayoutBar, SectionList, useLayout } from "./Sections";
import { InstallButton, useOnline } from "./Pwa";
import { downloadIcs } from "./ics";
import { DAY_COLORS, MapView, pinsFor } from "./MapView";
import { exportPlan, parsePlan, readSaved, savePlan, normalizePreferences, MAX_PLAN_BYTES, safeUrl, weatherLabel } from "../shared/portable";
import { clearShareFromUrl, makeShareLink, readSharedPlan } from "./Share";
import { HomeCityField, Snapshot, useHomeCity, placeLabel } from "./Home";
import { homeGenerateFields } from "../shared/homeCity";
import { defaultPrep, mergePrepForMode } from "./Prep";
import { CurrencyPicker, RateLine, crossRate, money, useFx, useHomeCurrency } from "./Money";

// Plans saved before 1.4.0 had `food` dish arrays; they simply show the regenerate hint
const eatsOf = (plan: Any) => ({ restaurants: Array.isArray(plan?.eats?.restaurants) ? plan.eats.restaurants : [], cafes: Array.isArray(plan?.eats?.cafes) ? plan.eats.cafes : [] });
const TITLES: Record<string, string> = { weather: "Weather", highlights: "Local highlights", map: "Map", food: "Restaurants & coffee", packing: "Packing list", prep: "Before you leave", itinerary: "Day by day", timeline: "Pre-trip timeline", budget: "Budget (estimate)" };
const TABS = [{ id: "plan", label: "Plan", icon: "🗺", secs: ["weather", "highlights", "map", "food", "itinerary"] }, { id: "pack", label: "Packing & Prep", icon: "🧳", secs: ["packing", "prep", "timeline"] }, { id: "money", label: "Budget", icon: "💰", secs: ["budget"] }] as const;
type TabId = typeof TABS[number]["id"];
const TAB_KEY = "tripfill:tab";
function WxIcon({ s }: { s: string }) {
  const t = (s || "").toLowerCase();
  const [I, c] = /thunder|storm/.test(t) ? [CloudLightning, "rain"] : /snow|sleet/.test(t) ? [CloudSnow, "cloud"] : /rain|shower|drizzle|wet/.test(t) ? [CloudRain, "rain"] : /fog|mist/.test(t) ? [CloudFog, "cloud"] : /overcast|cloud/.test(t) ? (/part|some|mostly clear/.test(t) ? [CloudSun, ""] : [Cloud, "cloud"]) : [Sun, ""];
  return <I size={26} className={"wxi " + c} aria-hidden />;
}
const HeroArt = () => <svg className="hero-art" viewBox="0 0 400 260" aria-hidden><defs>
    <linearGradient id="hg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".95" /><stop offset=".55" stopColor="var(--rose)" stopOpacity=".7" /><stop offset="1" stopColor="var(--sun)" stopOpacity=".85" /></linearGradient>
    <linearGradient id="dune" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--teal)" stopOpacity=".22" /><stop offset="1" stopColor="var(--teal)" stopOpacity=".08" /></linearGradient>
  </defs>
  <circle cx="298" cy="88" r="62" fill="url(#hg)" opacity=".88" />
  <circle cx="298" cy="88" r="78" fill="none" stroke="var(--sun)" strokeOpacity=".25" strokeWidth="1.5" strokeDasharray="3 8" />
  <path d="M0 198 C80 155 140 185 200 168 S310 130 400 155 L400 260 L0 260Z" fill="url(#dune)" />
  <path d="M0 228 C95 200 155 218 240 200 S345 185 400 195 L400 260 L0 260Z" fill="var(--teal)" opacity=".26" />
  <path d="M48 128 Q155 38 255 78" fill="none" stroke="var(--ink)" strokeOpacity=".28" strokeWidth="1.8" strokeDasharray="2 9" strokeLinecap="round" />
  <g transform="translate(258 70) rotate(16)" fill="var(--ink)" opacity=".65"><path d="M0 0 L-13 -4.5 L-11 0 L-13 4.5Z" /><rect x="-8" y="-1.1" width="13" height="2.2" rx="1.1" /></g>
  <ellipse cx="72" cy="168" rx="7" ry="11" fill="var(--teal)" opacity=".35" transform="rotate(-18 72 168)" />
  <ellipse cx="88" cy="175" rx="5" ry="9" fill="var(--rose)" opacity=".4" transform="rotate(12 88 175)" />
  <circle cx="48" cy="128" r="5.5" fill="var(--accent)" /></svg>;

type Any = any;
const PRESETS: [string, string][] = [["beach", "🏖 Beach"], ["hiking", "🥾 Hiking"], ["ski", "⛷ Ski"], ["city", "🏙 City"], ["business", "💼 Business"], ["kids", "🧒 With kids"], ["roadtrip", "🚗 Road trip"]];
const KEY = "tripfill:v1";
// Local calendar date (not UTC) so late evening in Detroit is still "today"
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (k: number) => { const d = new Date(); d.setDate(d.getDate() + k); return iso(d); };

function Editable({ value, onChange, multiline }: { value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return multiline
    ? <textarea className="ed" value={value} rows={3} onChange={e => onChange(e.target.value)} />
    : <input className="ed" value={value} onChange={e => onChange(e.target.value)} />;
}

const defaultUnit = (): "C" | "F" => /-(US|LR|MM)$/i.test(navigator.language || "") || /^en$/i.test(navigator.language) && Intl.DateTimeFormat().resolvedOptions().timeZone?.startsWith("America/") ? "F" : "C";

export default function App() {
  const [saved] = useState(() => { try { return readSaved(localStorage); } catch (e: Any) { return { form: null, plan: null, error: `Saved trip could not be read: ${e.message} The original browser data has not been overwritten.` }; } });
  const recoveryPending = useRef(!!(saved && "error" in saved));
  const [form, setForm] = useState<Any>(() => {
    const f = withMembers(saved?.form || { ...normalizePreferences(), destination: "", start: plus(10), end: plus(16), travelers: 2, purpose: "Leisure", style: "Mix", interests: "" }, saved?.plan);
    return { ...f, travelMode: f.travelMode || resolveTravelMode(saved?.plan?.input, saved?.plan?.trip?.distanceKm) };
  });
  const [plan, setPlan] = useState<Any>(saved?.plan || null);
  const [matches, setMatches] = useState<Any[] | null>(null);
  const [unit, setUnit] = useState<"C" | "F">(() => (localStorage.getItem(KEY + ":unit") as "C" | "F") || defaultUnit());
  useEffect(() => { localStorage.setItem(KEY + ":unit", unit); }, [unit]);
  const deg = (c: number) => unit === "F" ? `${Math.round(c * 9 / 5 + 32)}°F` : `${Math.round(c)}°C`;
  const T = (s: string) => (s || "").replace(/\{t:(-?[\d.]+)\}/g, (_m, v) => deg(Number(v))).replace(/(-?\d+(?:\.\d+)?)°C\b/g, (_m, v) => deg(Number(v)));
  const [layout, setLayout] = useLayout(Object.keys(TITLES));
  const [homeCity, setHomeCity] = useHomeCity();
  const [homeText, setHomeText] = useState(() => homeCity ? placeLabel(homeCity) : "");
  const [homeErr, setHomeErr] = useState("");
  const [home, setHome, homeExplicit] = useHomeCurrency(homeCity?.countryCode || plan?.trip?.home?.countryCode);
  const { fx, busy: fxBusy, refresh: fxRefresh } = useFx();
  const online = useOnline() && !(fx as Any)?.offline;
  const [tab, setTabRaw] = useState<TabId>(() => (TABS.find(t => t.id === localStorage.getItem(TAB_KEY))?.id) || "plan");
  const setTab = (t: TabId) => { setTabRaw(t); localStorage.setItem(TAB_KEY, t); };
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const en = TABS.filter(t => plan || t.id === "plan"); const cur = en.findIndex(t => t.id === TABS[i].id);
    const j = e.key === "ArrowRight" ? (cur + 1) % en.length : e.key === "ArrowLeft" ? (cur - 1 + en.length) % en.length : e.key === "Home" ? 0 : e.key === "End" ? en.length - 1 : -1;
    if (j < 0) return; e.preventDefault(); setTab(en[j].id); tabRefs.current[en[j].id]?.focus();
  };
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(saved && "error" in saved ? saved.error || "" : "");

  const [simplePacking, setSimplePacking] = useState(() => readPackMode(globalThis.localStorage));
  const changeSimple = (on: boolean) => { setSimplePacking(on); writePackMode(globalThis.localStorage, on); };
  const [settingsOpen, setSettingsOpen] = useState(false), [settingsSlot, setSettingsSlot] = useState<HTMLDivElement | null>(null);
  const [readOnly, setReadOnly] = useState<string | null>(null); // "link" | "server" when viewing a shared plan
  // Settings → Packing edits to the active (own) plan's travelers flow back into the questionnaire; extra rows are kept.
  const planMembersKey = JSON.stringify(plan?.packing?.settings?.members || null);
  useEffect(() => { if (readOnly || !plan?.packing?.settings?.members) return; setForm((f: Any) => syncFormMembers(f, plan.packing.settings.members)); }, [planMembersKey, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shareMsg, setShareMsg] = useState("");
  useEffect(() => {
    const load = () => readSharedPlan().then(r => { if (!r) return; if ("error" in r) setErr(r.error); else { setErr(""); setPlan(r.plan); setReadOnly(r.via); } });
    load(); addEventListener("hashchange", load); return () => removeEventListener("hashchange", load);
  }, []);
  useEffect(() => { if (!readOnly && !(recoveryPending.current && !plan)) { try { savePlan(localStorage, form, plan); } catch { setErr("Browser storage is full or unavailable. Export JSON now to keep your edits."); } } }, [form, plan, readOnly]);
  const closeShared = () => { try { const own = readSaved(localStorage); clearShareFromUrl(); setReadOnly(null); setPlan(own?.plan || null); if (own?.form) setForm(withMembers(own.form, own.plan)); } catch (e: Any) { setErr(e.message); } };
  const importShared = () => { if (localStorage.getItem(KEY) && !confirm("Replace your saved plan with this shared snapshot? To back up your own plan first, choose Cancel, close the shared view, and Export JSON.")) return; recoveryPending.current = false; clearShareFromUrl(); setForm({ ...plan.input, ...normalizePreferences(plan.input) }); setReadOnly(null); setTab("plan"); };
  async function share() {
    setShareMsg("…");
    try {
      const { url } = await makeShareLink(plan);
      let copied = false; try { await navigator.clipboard.writeText(url); copied = true; } catch { /* show selectable field below */ }
      setShareMsg(`${copied ? "Link copied" : "Copy the link below"} — portable snapshot (${url.length.toLocaleString()} characters), no server storage. Long links can be truncated by messaging apps; use JSON export as a backup.`);
      (window as Any).__lastShare = url;
      setTimeout(() => (document.getElementById("share-url") as HTMLInputElement | null)?.select(), 0);
      setShareUrl(url);
    } catch (e: Any) { setShareMsg("Share failed: " + e.message); }
  }
  const [shareUrl, setShareUrl] = useState("");

  async function generate(place?: Any, legsOverride?: Any[]) {
    const legs = (legsOverride || form.legs || []).filter((l: Any) => l.destination?.trim());
    setErr(""); setHomeErr(""); setLoading(true); setMatches(null);
    try {
      const homeFields = homeGenerateFields(homeText, homeCity);
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, today: plus(0), allowPast: form.start < plus(0) || undefined, legs: legs.length ? legs : undefined, place, ...homeFields, fxForce: new URLSearchParams(location.search).get("fxForce") || undefined }) });
      const j = await r.json();
      if (!r.ok) {
        if (/home city/i.test(j.error || "")) setHomeErr(j.error);
        throw new Error(j.error || "Failed");
      }
      setHomeErr("");
      if (j.trip?.home) { setHomeCity(j.trip.home); setHomeText(placeLabel(j.trip.home)); }
      if (j.needsChoice) setMatches(j.matches); else { recoveryPending.current = false; setPlan(j); setShareMsg(""); setShareUrl(""); }
    } catch (e: Any) { setErr(e.message); } finally { setLoading(false); }
  }
  const activeTab: TabId = plan ? tab : "plan";
  const upd = (fn: (p: Any) => void) => readOnly ? undefined : setPlan((p: Any) => { const c = structuredClone(p); fn(c); return c; });
  const changeTravelMode = (m: TravelMode) => {
    if (readOnly) return;
    setPlan((p: Any) => { const next = applyTravelMode(p, m); next.prep = mergePrepForMode(next); return next; });
    setForm((f: Any) => ({ ...f, travelMode: m }));
  };
  const download = () => { try { const a = document.createElement("a"); const url = URL.createObjectURL(new Blob([exportPlan(plan)], { type: "application/json" })); a.href = url; a.download = `tripfill-${plan.place.name}-${plan.input.start}.json`.replace(/[^a-zA-Z0-9_.-]/g, "_"); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e: Any) { setErr(e.message); } };
  const importJson = async (f: File) => { try {
    if (f.size > MAX_PLAN_BYTES) throw new Error("File exceeds 750 KB. Choose a smaller TripFill JSON export.");
    const next = parsePlan(await f.text());
    if ((plan || (saved && "error" in saved)) && !confirm("Importing replaces your saved plan in this browser. Export your current plan first if you need a backup. Continue?")) return;
    recoveryPending.current = false; clearShareFromUrl(); setReadOnly(null); setPlan(next); setForm(withMembers({ ...next.input, ...normalizePreferences(next.input) }, next, true)); setErr(""); setShareMsg(""); setShareUrl(""); setTab("plan");
  } catch (e: Any) { setErr(e.message); } };
  const fmtRange = (a: string, b: string) => { const o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }; const f = (x: string) => new Date(x + "T12:00").toLocaleDateString(undefined, o); return `${f(a)} – ${f(b)}, ${b.slice(0, 4)}`; };
  const placeLabel = (m: Any) => [m.name, m.admin1, m.country].filter(Boolean).join(", ");

  const packItems = plan ? plan.packing.groups.flatMap((g: Any) => g.items) : [];
  const pins = plan ? pinsFor(plan.highlights || [], plan.itinerary || []) : [];
  const summaries: Record<string, string> = plan ? {
    map: `${pins.length} pinned sights across ${new Set(pins.filter(p => p.day != null).map(p => p.day)).size} day(s)`,
    weather: `${plan.weather.source === "forecast" ? "Forecast" : plan.weather.source === "mixed" ? "Forecast + typical" : "Typical"} · highs ~${deg(plan.weather.stats.avgHigh)}, lows ~${deg(plan.weather.stats.avgLow)} · ~${plan.weather.stats.rainyDays} wet day(s)`,
    highlights: `${plan.highlights.length} sights · ${plan.highlights.slice(0, 3).map((h: Any) => h.name).join(", ")}…`,
    food: (() => { const E = eatsOf(plan); return `${E.restaurants.length} restaurants · ${E.cafes.length} coffee shops${E.restaurants.length ? " · " + E.restaurants.slice(0, 2).map((f: Any) => f.name).join(", ") + "…" : ""}`; })(),
    packing: `${packingProgress(packItems).packed}/${packingProgress(packItems).total} active items packed`,
    itinerary: `${plan.itinerary.length} days · ${plan.input.style} pace`,
    prep: (() => { const pr = plan.prep || defaultPrep(plan); return `${pr.length} tasks, ${pr.filter((t: Any) => t.done).length} done`; })(),
    timeline: `${plan.timeline.length} tasks, ${plan.timeline.filter((t: Any) => t.done).length} done · next: ${(plan.timeline.find((t: Any) => !t.done) || {}).task || "all done"}`,
    budget: plan.legs?.length > 1 ? (() => { const parts = plan.legs.map((lg: Any) => { const L = lg.budget.currency; const t = lg.budget.lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); const x = crossRate(fx, home, L); return { s: money(t, L), h: L === home ? t : x ? t / x : null }; }); const all = parts.every((p: Any) => p.h != null); return `${parts.map((p: Any) => '~' + p.s).join(' + ')}${all ? ` ≈ ${money(parts.reduce((a: number, p: Any) => a + p.h, 0), home)} total` : ''} estimate`; })() : (() => { const L = plan.budget.currency; const tot = plan.budget.lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); const x = crossRate(fx, home, L); return `~${money(tot, L)}${x && home !== L ? ` ≈ ${money(tot / x, home)}` : ""} estimate`; })(),
  } : {};
  const budgetTable = (B: Any, G: (p: Any) => Any, tid = "") => <>
          <p className="muted small">Model ranges are not live quotes; your figures remain editable. Missing source/freshness details in older snapshots are unknown.</p>
          <p className="warn">{B.note}</p>
          <p className="muted small">{B.fxNote}</p>
          <p><RateLine fx={fx} home={home} local={B.currency} busy={fxBusy} onRefresh={fxRefresh} /></p>
          {(() => { const L = B.currency; const x = crossRate(fx, home, L); const conv = !!x && home !== L; const H = (n: number) => conv ? money(n / x!, home) : ""; const n = Math.max(1, Number(plan.input.travelers) || 1); const tot = B.lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); const lo = B.lines.reduce((s: number, l: Any) => s + l.low, 0), hi = B.lines.reduce((s: number, l: Any) => s + l.high, 0);
          const setTotal = (v: number) => upd(p => { const cur = G(p).lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); G(p).lines.forEach((l: Any) => { l.total = Math.round(cur ? (Number(l.total) || 0) * v / cur : v / G(p).lines.length); });
            // per-line rounding can leave the sum ±1–2 off what was typed (5000 → 4999); put the remainder on the biggest line
            const ls = G(p).lines, diff = Math.round(v) - ls.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0);
            if (diff && ls.length) { const big = ls.reduce((a: Any, b: Any) => (Number(b.total) || 0) > (Number(a.total) || 0) ? b : a); big.total = (Number(big.total) || 0) + diff; } });
          const Dual = ({ v, set, testid }: { v: number; set: (n: number) => void; testid?: string }) => <div className="dual"><input data-testid={testid ? testid + "-local" : undefined} aria-label={`Amount in ${L}`} type="number" className="ed num" style={{ width: `calc(${Math.max(4, String(Math.round(v)).length + 1)}ch + 2.6em)` }} value={Math.round(v)} onChange={e => set(Number(e.target.value))} /><small>{L}</small>{conv && <><input data-testid={testid ? testid + "-home" : undefined} aria-label={`Amount in ${home}`} type="number" className="ed num" style={{ width: `calc(${Math.max(4, String(Math.round(v / x!)).length + 1)}ch + 2.6em)` }} value={Math.round(v / x!)} onChange={e => set(Number(e.target.value) * x!)} /><small>{home}</small></>}</div>;
          const mx = Math.max(1, ...B.lines.map((l: Any) => Number(l.total) || 0));
          return <><div className="bars" aria-hidden data-testid={tid + "bars"}>{B.lines.map((l: Any) => <div key={l.category} className="bar"><span>{l.category}</span><div className="track"><div className="fill" style={{ width: `${Math.round((Number(l.total) || 0) / mx * 100)}%` }} /></div><b>{money(Number(l.total) || 0, L)}</b></div>)}</div><table><thead><tr><th>Category</th><th>Basis</th><th>Estimated range</th><th>Your figure ({L}{conv ? ` / ${home}` : ""})</th></tr></thead><tbody>
            {B.lines.map((l: Any, i: number) => <tr key={l.category}><td>{l.category}</td><td className="muted small">{l.basis}</td><td className="small">{l.high ? <>{money(l.low, L)}–{money(l.high, L)}{conv && <><br /><span className="muted">≈ {H(l.low)}–{H(l.high)}</span></>}</> : "—"}</td><td>{Dual({ v: Number(l.total) || 0, set: v => upd(p => { G(p).lines[i].total = Math.round(v); }) })}</td></tr>)}
            <tr><td><b>Total</b></td><td className="muted small">range {money(lo, L)}–{money(hi, L)}{conv ? ` (≈ ${H(lo)}–${H(hi)})` : ""}</td><td /><td>{Dual({ testid: tid + "total", v: tot, set: setTotal })}<small className="muted" data-testid={tid + "total-summary"}><b>{money(tot, L)}</b>{conv ? ` ≈ ${H(tot)}` : ""} · {money(tot / n, L)}{conv ? ` ≈ ${H(tot / n)}` : ""} / person</small></td></tr>
          </tbody></table></>; })()}
  </>;
  const bodies: Record<string, JSX.Element> = plan ? {
    weather: <>
          <p className={plan.weather.source !== "forecast" ? "warn" : "muted"}>{plan.weather.source === "typical" ? "📊 " : "📡 "}{plan.weather.note}</p>
          <p className="wxstat"><span><Thermometer size={15} /> Avg high <b>{deg(plan.weather.stats.avgHigh)}</b> · low <b>{deg(plan.weather.stats.avgLow)}</b></span><span><Droplets size={15} /> Wet days ~<b>{plan.weather.stats.rainyDays}</b></span></p>
          {plan.weather.legs?.length > 1 && <ul className="small wx-legs" data-testid="leg-weather">{plan.weather.legs.map((l: Any) => <li key={l.name}><b>{l.name}</b>: avg high {deg(l.stats.avgHigh)} · low {deg(l.stats.avgLow)} · wet days ~{l.stats.rainyDays}</li>)}</ul>}
          <div className="wx">{plan.weather.days.map((d: Any) => <div key={d.date} className="wxd">{plan.legs?.length > 1 && <small className="legtag">{d.leg}</small>}<b>{new Date(d.date + "T12:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</b><WxIcon s={d.summary} /><span className="temp">{deg(d.tmax)} <small>/ {deg(d.tmin)}</small></span><small>{weatherLabel(d, plan.weather.source)} · {d.summary}{d.precipProb != null ? ` · ${d.precipProb}%${d.typical ? " wet in sampled years" : " rain"}` : ""}</small>{d.receivedAt && <small className="muted">Data received {new Date(d.receivedAt).toLocaleString()}</small>}</div>)}</div>
    </>,
    highlights: <>
          <ol className="hl">{plan.highlights.map((h: Any, i: number) => <li key={i}>{plan.legs?.length > 1 && h.leg !== plan.highlights[i - 1]?.leg && <h3 className="leghead">📍 {h.leg}</h3>}
            <Editable value={h.name} onChange={v => upd(p => { p.highlights[i].name = v; })} /><span className={"tag " + (h.setting || (h.indoor ? "indoor" : "outdoor"))}>{h.setting || (h.indoor ? "indoor" : "outdoor")}</span>{h.type && <small className="muted"> {h.type}</small>}
            <Editable multiline value={h.description} onChange={v => upd(p => { p.highlights[i].description = v; })} />
            <small className="muted">Source: {h.url ? <a href={safeUrl(h.url)} target="_blank" rel="noopener noreferrer">{h.source}</a> : h.source} · check official site for hours & prices</small>
          </li>)}</ol>
    </>,
    food: <>
          {(() => { const E = eatsOf(plan); const list = (k: "restaurants" | "cafes") => E[k].length ? <ul className="hl eats">{E[k].map((f: Any, i: number) => <li key={i}>{plan.legs?.length > 1 && f.leg && f.leg !== E[k][i - 1]?.leg && <h3 className="leghead">📍 {f.leg}</h3>}<Editable value={f.name} onChange={v => upd(p => { p.eats[k][i].name = v; })} />{f.tag && <span className="tag eat">{f.tag}</span>}{(f.km != null || f.area) && <small className="muted"> {[f.area, f.km != null ? `${f.km < 1 ? Math.round(f.km * 1000) + " m" : f.km + " km"} straight-line from centre (not walking distance)` : ""].filter(Boolean).join(" · ")}</small>}{f.description && <div className="gloss">{f.description}</div>}<p className="muted small">{f.cuisineEvidence === "source-tag" ? "Cuisine from source tags, not independently verified" : f.cuisineEvidence === "inferred" && f.sourceUrl ? "Cuisine/category inferred from listing or name — may be inaccurate" : "Cuisine metadata unknown"}. {f.dietaryStatus || "Dietary information unverified — contact venue"}. {f.retrievedAt && f.sourceUrl ? `Listing collected ${new Date(f.retrievedAt).toLocaleString()}; may be cached up to 24 h. ` : ""}Source revision age and current opening status unknown.</p><small className="muted"> {safeUrl(f.sourceUrl) ? <a href={safeUrl(f.sourceUrl)} target="_blank" rel="noopener noreferrer">{f.source || "Source listing"}</a> : <span>{f.source || "Unknown source"} — provenance unavailable in this saved plan</span>}{safeUrl(f.url) && f.url !== f.sourceUrl && <> · <a href={safeUrl(f.url)} target="_blank" rel="noopener noreferrer">Website / details</a></>}{f.lat != null && <> · <a href={`https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lon}#map=18/${f.lat}/${f.lon}`} target="_blank" rel="noopener noreferrer">map</a></>}</small></li>)}</ul> : <p className="muted small">{plan.eats ? `No ${k === "cafes" ? "coffee shops" : "restaurants"} found nearby right now — try regenerating in a minute.` : "This plan was saved before TripFill 1.4 — regenerate it to see local restaurants and coffee shops."}</p>;
            return <><p className="warn small">These are source listings, not ratings or guaranteed recommendations. Local-cuisine ordering uses incomplete metadata; it is not a verified authenticity ranking. Confirm menus, availability, hours and allergy/cross-contact handling directly.</p>{(E.restaurants.length < 5 || E.cafes.length < 3) && <p className="warn" data-testid="limited-eats">Limited source coverage: {E.restaurants.length} restaurant(s), {E.cafes.length} coffee shop(s). No results added to pad the lists. {safeUrl(plan.guideUrl) ? <a href={safeUrl(plan.guideUrl)} target="_blank" rel="noopener noreferrer">Check the city guide</a> : "Check the destination tourist information office"} and venue websites.</p>}<h3>🍽 Restaurants</h3>{list("restaurants")}<h3>☕ Coffee shops</h3>{list("cafes")}</>; })()}
          <p className="muted small">Sources: {plan.sources.join(" · ")}{plan.aiPolished ? " · descriptions lightly reworded by AI" : ""}</p>
    </>,
    packing: <PackingWorkspace key={`${plan.generatedAt}:${plan.place.name}:${plan.input.start}:${readOnly || "own"}`} plan={plan} readOnly={!!readOnly} settingsSlot={activeTab === "pack" ? settingsSlot : null} openSettings={() => setSettingsOpen(true)} simple={simplePacking} onSimpleChange={changeSimple} onTravelMode={changeTravelMode} onChange={packing => upd(p => { p.packing = packing; })} T={T} />,
    itinerary: <>
          {plan.itinerary.map((d: Any, i: number) => <div key={d.date} className="day"><h3>{d.label}{plan.legs?.length > 1 && d.leg && <span className="legtag"> 📍 {d.leg}</span>} <small className="muted">{T(d.weather)}{!/(forecast|seasonal estimate)/i.test(d.weather) && ` · ${weatherLabel(plan.weather.days.find((w: Any) => w.date === d.date), plan.weather.source)}`}</small></h3>
            {(["morning", "afternoon", "evening"] as const).map(k => <div key={k} className="slot"><span>{k}</span><Editable value={d[k]} onChange={v => upd(p => { p.itinerary[i][k] = v; })} /></div>)}
            {d.rainyBackup && <div className="slot"><span>☔ backup</span><Editable value={d.rainyBackup} onChange={v => upd(p => { p.itinerary[i].rainyBackup = v; })} /></div>}
            <div className="slot"><span>notes</span><Editable value={d.notes} onChange={v => upd(p => { p.itinerary[i].notes = v; })} /></div>
          </div>)}
    </>,
    prep: <>
          <p className="muted small">Tick these off in the days before you go — saved with this plan.</p>
          {(plan.prep || defaultPrep(plan)).map((t: Any, i: number) => <div key={t.id} className="pk" data-testid="prep-item"><ChecklistCheckbox aria-label={t.task} checked={t.done} onChange={e => upd(p => { p.prep = p.prep || defaultPrep(p); p.prep[i].done = e.target.checked; })} /><ChecklistText value={t.task} onChange={v => upd(p => { p.prep = p.prep || defaultPrep(p); p.prep[i].task = v; })} />{t.why && <small className="why">{t.why}</small>}<button className="x noprint" aria-label="Remove task" onClick={() => upd(p => { p.prep = p.prep || defaultPrep(p); p.prep.splice(i, 1); })}>×</button></div>)}
          <button className="add noprint" onClick={() => upd(p => { p.prep = p.prep || defaultPrep(p); p.prep.push({ id: crypto.randomUUID(), task: "New task", done: false }); })}>+ add</button>
    </>,
    timeline: <>
          {plan.timeline.map((t: Any, i: number) => <div key={t.id} className="pk"><ChecklistCheckbox aria-label={t.task} checked={t.done} onChange={e => upd(p => { p.timeline[i].done = e.target.checked; })} /><input type="date" className="ed date" value={t.due} onChange={e => upd(p => { p.timeline[i].due = e.target.value; })} /><ChecklistText value={t.task} onChange={v => upd(p => { p.timeline[i].task = v; })} /></div>)}
    </>,
    map: <MapView pins={pins} center={(plan.legs?.length > 1 ? plan.legs.map((l: Any) => l.place) : [plan.place]).map((q: Any) => ({ lat: q.lat, lon: q.lon, name: q.name }))} route={plan.legs?.length > 1}
      legend={[...plan.itinerary.map((d: Any, i: number) => ({ label: `Day ${i + 1}`, color: DAY_COLORS[i % DAY_COLORS.length] })).filter((_: Any, i: number) => pins.some(p => p.day === i)), ...(pins.some(p => p.day == null) ? [{ label: "Not scheduled", color: "#8a8f9c" }] : [])]} />,
    budget: plan.legs?.length > 1 ? <>
          {plan.legs.map((lg: Any, k: number) => <div key={k} className="legblock" data-testid={`leg${k}-budget`}><h3>📍 Leg {k + 1}: {lg.place.name} <small className="muted">{lg.start} → {lg.end} · {lg.nights} night(s)</small></h3>{budgetTable(lg.budget, (p: Any) => p.legs[k].budget, `leg${k}-`)}</div>)}
          {(() => { const n = Math.max(1, Number(plan.input.travelers) || 1); const toHome = (amt: number, cur: string) => { const x = crossRate(fx, home, cur); return x ? amt / x : null; };
            const parts = plan.legs.map((lg: Any) => { const t = lg.budget.lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); return { t, cur: lg.budget.currency, h: toHome(t, lg.budget.currency) }; });
            const ok = parts.every((x: Any) => x.h != null); const sum = parts.reduce((s: number, x: Any) => s + (x.h || 0), 0);
            return <p className="grand" data-testid="grand-total"><b>Trip total:</b> {parts.map((x: Any) => money(x.t, x.cur)).join(" + ")}{ok ? <> = <b>{money(sum, home)}</b> · {money(sum / n, home)} / person</> : <span className="muted"> (no exchange rate to add them up in {home})</span>}</p>; })()}
        </> : budgetTable(plan.budget, (p: Any) => p.budget),
  } : {};

  const roBodies = readOnly ? Object.fromEntries(Object.entries(bodies).map(([k, v]) => [k, k === "packing" ? v : <fieldset key={k} className="ro" disabled>{v}</fieldset>])) : bodies;
  // Simple packing mode: hide the pre-trip timeline and tuck Before you leave into a discreet disclosure (view only).
  const viewBodies: Record<string, any> = simplePacking ? { ...roBodies, timeline: null, prep: roBodies.prep && <details className="simple-prep" data-testid="simple-prep"><summary>Before you leave checklist</summary>{roBodies.prep}</details> } : roBodies;
  const tabBodies = (t: TabId) => Object.fromEntries((TABS.find(x => x.id === t)!.secs as readonly string[]).filter(k => viewBodies[k]).map(k => [k, viewBodies[k]]));
  return (
    <div className={"wrap" + (plan ? " compact" : "")}>
      <div className="topbar noprint"><div className="brand"><span className="logo"><Plane size={18} /></span>TripFill</div><SettingsMenu open={settingsOpen} setOpen={setSettingsOpen} unit={unit} setUnit={setUnit} slotRef={setSettingsSlot} /></div>
      <header className="hero noprint"><HeroArt /><span className="eyebrow"><MapPin size={14} />Free · no sign-up · works offline</span><h1>Your next adventure, <em>beautifully planned.</em></h1><p>Destination and dates in — weather, highlights, local restaurants & coffee, packing list and a day-by-day plan out. Everything stays editable and saved in this browser.</p></header>

      {recoveryPending.current && <button className="ghost noprint" onClick={() => { const a = document.createElement("a"); const u = URL.createObjectURL(new Blob([localStorage.getItem(KEY) || ""], { type: "application/json" })); a.href = u; a.download = "tripfill-browser-recovery.json"; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }}>Download original browser data for recovery</button>}
      {err && <div className="card error" role="alert">{err}</div>}
      {plan && <>
        {readOnly && <div className="card shared noprint" data-testid="shared-banner"><b>👀 Shared plan (read-only)</b> — {readOnly === "server" ? "loaded from this TripFill server" : "decoded from the link itself"}. Your own saved plan is untouched.
          <div className="chips"><button onClick={importShared}><Download size={16} />Import as my plan</button><button className="ghost" onClick={closeShared}>Close</button></div></div>}
      </>}
      <div className="tabs noprint" role="tablist" aria-label="TripFill sections">{TABS.map((t, i) => { const dis = !plan && t.id !== "plan"; return <button key={t.id} role="tab" id={`tab-${t.id}`} ref={el => { tabRefs.current[t.id] = el; }} aria-selected={activeTab === t.id} aria-controls={`panel-${t.id}`} aria-disabled={dis || undefined} tabIndex={activeTab === t.id ? 0 : -1} disabled={dis} title={dis ? "Generate a plan first" : undefined} className={activeTab === t.id ? "on" : ""} onClick={() => setTab(t.id)} onKeyDown={e => onTabKey(e, i)}><span aria-hidden>{t.icon}</span> {t.label}</button>; })}</div>
      {!plan && <p className="muted small tabs-hint noprint">Packing & Prep and Budget unlock once you generate a plan.</p>}
      <div role="tabpanel" id="panel-plan" aria-labelledby="tab-plan" hidden={activeTab !== "plan"}>
      {!online && <div className="card warn noprint" data-testid="offline">📴 You're offline — showing your last saved plan. Editing works and is saved in this browser; generating a new plan, the map tiles and live rates need a connection.</div>}
      {!readOnly && <form className="card form noprint" onSubmit={e => { e.preventDefault(); if (form.start < plus(0) && !window.confirm(`Your start date (${form.start}) is before today (${plus(0)}). Plan it anyway? Weather will be typical for the season, not a forecast.`)) return; generate(); }}>
        <label className="wide">Destination<input required placeholder="e.g. Lisbon" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} /></label>
        <label>Start<input type="date" required value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />{form.start < plus(0) && <small className="warn" data-testid="past-warning" role="alert">⚠ This start date is in the past.</small>}</label>
        <label>End<input type="date" required value={form.end} min={form.start} onChange={e => setForm({ ...form, end: e.target.value })} /></label>
        {(form.legs || []).length > 0 && <div className="wide legs" data-testid="legs">
          <small className="muted">Leg 1: <b>{form.destination || "first city"}</b> from {form.start}. Each next city starts on its travel day; the trip ends {form.end}.</small>
          {form.legs.map((l: Any, k: number) => <div key={k} className="legrow" data-testid={`leg-row-${k}`}>
            <label>Then city {k + 2}<input required placeholder="e.g. Porto" value={l.destination} onChange={e => setForm({ ...form, legs: form.legs.map((x: Any, j: number) => j === k ? { destination: e.target.value, start: x.start } : x) })} /></label>
            <label>Travel day<input type="date" required value={l.start} min={(form.legs[k - 1]?.start) || form.start} max={form.end} onChange={e => setForm({ ...form, legs: form.legs.map((x: Any, j: number) => j === k ? { ...x, start: e.target.value } : x) })} /></label>
            <button type="button" className="x" aria-label="Remove city" onClick={() => setForm({ ...form, legs: form.legs.filter((_: Any, j: number) => j !== k) })}>×</button>
          </div>)}
        </div>}
        <button type="button" className="ghost wide addleg" data-testid="add-leg" onClick={() => { const prev = (form.legs || []).at(-1)?.start || form.start; const a = new Date(prev + "T12:00").getTime(), b = new Date(form.end + "T12:00").getTime(); const mid = new Date(a + Math.max(86400000, Math.round((b - a) / 2 / 86400000) * 86400000)).toISOString().slice(0, 10); setForm({ ...form, legs: [...(form.legs || []), { destination: "", start: mid > form.end ? form.end : mid }] }); }}>+ Add another city</button>
        <label>Travelers<input type="number" min={1} max={20} value={form.travelers} onChange={e => setForm({ ...form, travelers: e.target.value })} /></label>
        <fieldset className="wide travelers-q" data-testid="who-traveling"><legend>Who’s traveling?</legend>
          <p className="muted small">Add a name and type for each traveler so every person gets their own packing list from the start. Both are optional, and you can change them later in ⚙ Settings → Packing. Changes here apply when you press Generate.</p>
          <TravelerFields idPrefix="form-traveler" members={travelerRows(form.members, form.travelers)} onEdit={(id, patch) => setForm((f: Any) => ({ ...f, members: editTraveler(f.members, f.travelers, id, patch) }))} />
        </fieldset>
        <label>Purpose<select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>{["Leisure", "Business", "Family", "Celebration", "Adventure", "Other"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Pace<select value={form.style} onChange={e => setForm({ ...form, style: e.target.value })}>{["Slow", "Mix", "Packed"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Walking tolerance<select value={form.walkingTolerance || "standard"} onChange={e => setForm({ ...form, walkingTolerance: e.target.value })}><option value="low">Limited — short outings & rest</option><option value="standard">Standard</option><option value="high">High — longer outings welcome</option></select></label>
        <label>Dietary preference<select value={form.dietaryNeeds || "none"} onChange={e => setForm({ ...form, dietaryNeeds: e.target.value })}>{[["none", "No preference"], ["vegetarian", "Vegetarian"], ["vegan", "Vegan"], ["gluten_free", "Gluten-free"], ["halal", "Halal"]].map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>
        <p className="muted small wide">Limited walking reduces stops and takes priority over hiking, skiing and walking-tour presets; access is not verified. Dietary tags are incomplete: source-tagged matches are preferred, name hints remain unverified, unknown venues stay visible and known conflicts are excluded. Confirm ingredients and cross-contact directly — no allergy-safety guarantee.</p>
        <fieldset className="wide presets"><legend>Trip type <small className="muted">(pick any)</small></legend>
          {PRESETS.map(([k, l]) => <label key={k} className={"chip" + ((form.presets || []).includes(k) ? " on" : "")}><input type="checkbox" data-preset={k} checked={(form.presets || []).includes(k)} onChange={e => setForm({ ...form, presets: e.target.checked ? [...(form.presets || []), k] : (form.presets || []).filter((x: string) => x !== k) })} />{l}</label>)}
        </fieldset>
        <HomeCityField value={homeCity} onChange={setHomeCity} text={homeText} onText={t => { setHomeText(t); setHomeErr(""); }} error={homeErr} />
        <TravelModeField value={form.travelMode === "driving" ? "driving" : "flying"} onChange={m => setForm({ ...form, travelMode: m })} hint={plan ? "Applies when you press Generate — it does not change the plan already on the page. To update this plan without a new weather fetch, use the travel card or ⚙ Settings → Packing." : "Approximate drive times are not a road route. Old trips without a saved choice default to Driving under about 300 km, otherwise Flying."} />
        <label className="wide">Interests<input placeholder="food, museums, hiking, photography…" value={form.interests} onChange={e => setForm({ ...form, interests: e.target.value })} /></label>
        <button disabled={loading || !online}>{!online ? "Offline — connect to generate" : loading ? "Building your plan… (~10s)" : "Generate plan"}</button>
      </form>}
      {matches && !readOnly && <div className="card noprint"><b>Which one did you mean?</b><div className="chips">{matches.map(m => <button key={m.id} onClick={() => generate(m)}>{placeLabel(m)}</button>)}</div></div>}

      {plan && <>
        <section className="card trip-head">
          <div className="kicker"><MapPin size={14} />{plan.legs?.length > 1 ? `${plan.legs.length}-city trip` : plan.trip?.domestic === false ? "International trip" : plan.trip?.domestic ? "Domestic trip" : "Your trip"}</div>
          <h2>{plan.legs?.length > 1 ? plan.title : placeLabel(plan.place)}</h2>
          <p className="dates">{fmtRange(plan.input.start, plan.input.end)}</p>
          <p className="muted">{plan.input.travelers} traveler(s) · {resolveTravelMode(plan.input, plan.trip?.distanceKm) === "driving" ? "Driving" : "Flying"} · {plan.input.purpose} · {plan.input.style} pace · {plan.input.walkingTolerance || "standard"} walking · {(plan.input.dietaryNeeds || "none").replace(/_/g, " ")} dietary preference{plan.input.interests ? ` · ${plan.input.interests}` : ""}{plan.input.presets?.length ? ` · ${plan.input.presets.map((k: string) => (PRESETS.find(p => p[0] === k) || [k, k])[1]).join(" ")}` : ""}</p>
          {plan.matches?.length > 1 && <p className="muted noprint">Wrong place? {plan.matches.filter((m: Any) => m.id !== plan.place.id).slice(0, 4).map((m: Any) => <a key={m.id} href="#" onClick={e => { e.preventDefault(); generate(m); }}>{placeLabel(m)}</a>).reduce((a: Any[], x: Any, i: number) => i ? [...a, " · ", x] : [x], [])}</p>}
          <div className="stats" data-testid="stats">
            <div className="stat"><CalendarDays size={18} /><div><b>{plan.itinerary.length} days</b><small>{plan.input.start} → {plan.input.end}</small></div></div>
            <div className="stat"><Users size={18} /><div><b>{plan.input.travelers}</b><small>traveler(s)</small></div></div>
            <div className="stat"><WxIcon s={plan.weather.days[0]?.summary || ""} /><div><b>{deg(plan.weather.stats.avgHigh)} / {deg(plan.weather.stats.avgLow)}</b><small>avg high / low · {plan.weather.stats.rainyDays} wet</small></div></div>
            <div className="stat"><Wallet size={18} /><div><b>{(summaries.budget || "").replace(/ estimate$/, "").split(" ≈ ").pop()}</b><small>budget estimate</small></div></div>
          </div>
          {plan.legs?.length > 1 && <div className="route" data-testid="route">{plan.legs.map((lg: Any, k: number) => <span key={k}>{k > 0 && <span className="hop">→ {lg.fromPrev?.flightLabel || "travel"} →</span>}<b>📍 {lg.place.name}</b> <small className="muted">{lg.place.country} · {lg.start.slice(5)}–{lg.end.slice(5)} · {lg.nights} night(s)</small>{lg.alternatives?.length > 0 && !readOnly && <small className="muted noprint"> · not it? {lg.alternatives.slice(0, 3).map((a: Any, ai: number) => <a key={ai} href="#" onClick={e => { e.preventDefault(); const L = plan.input.legs.map((x: Any, j: number) => j === k - 1 ? { ...x, place: a } : x); setForm({ ...form, legs: L.map(({ destination, start }: Any) => ({ destination, start })) }); generate(plan.place, L); }}>{a.name}, {a.country}</a>).reduce((acc: Any[], x: Any, i: number) => i ? [...acc, " · ", x] : [x], [])}</small>}</span>)}</div>}
          <Snapshot trip={plan.trip} dest={plan.place} mode={resolveTravelMode(plan.input, plan.trip?.distanceKm)} onMode={changeTravelMode} readOnly={!!readOnly} />
          {plan.capped && <p className="warn">Trips longer than 14 days: weather & itinerary cover the first 14 days.</p>}
        </section>

        <LayoutBar layout={layout} setLayout={setLayout} titles={TITLES} />
        <SectionList layout={layout} setLayout={setLayout} titles={TITLES} summaries={summaries} bodies={tabBodies("plan")} />
        <p className="muted small">Weather: Open-Meteo · Places: Wikivoyage / Wikipedia / Wikidata (CC BY-SA). Generated {new Date(plan.generatedAt).toLocaleString()}.</p>
      </>}
      </div>
      {plan && <>
        <div role="tabpanel" id="panel-pack" aria-labelledby="tab-pack" hidden={activeTab !== "pack"}>
          <SectionList layout={layout} setLayout={setLayout} titles={TITLES} summaries={summaries} bodies={tabBodies("pack")} />
        </div>
        <div role="tabpanel" id="panel-money" aria-labelledby="tab-money" hidden={activeTab !== "money"}>
          <section className="card">
            <div className="moneycard" data-testid="money-card"><b>Money</b>{(plan.legs?.length > 1 ? [...new Set(plan.legs.map((l: Any) => l.budget.currency))] as string[] : [plan.budget?.localCurrency || plan.budget?.currency || home]).map((c: string, i: number) => <RateLine key={c} compact fx={fx} home={home} local={c} shownIn={i === 0 && !(plan.legs?.length > 1) ? plan.budget?.currency : c} busy={fxBusy} onRefresh={fxRefresh} />)}<span className="noprint"><CurrencyPicker value={home} onChange={setHome} hint={homeExplicit ? "your choice" : homeCity ? `from ${homeCity.country}` : "from browser locale"} /></span></div>
          </section>
          <SectionList layout={layout} setLayout={setLayout} titles={TITLES} summaries={summaries} bodies={tabBodies("money")} />
        </div>
      </>}
      <footer className="page-actions noprint" data-testid="page-actions" aria-label="Trip actions">
        <div className="toolbar">
          <label className="btn"><Upload size={16} />Import trip JSON<input type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ""; }} /></label>
          {plan && <>
            {!readOnly && <button data-testid="share" onClick={share}><Link2 size={16} />Copy share link</button>}
            <button onClick={() => window.print()}><Printer size={16} />Print / PDF</button>
            <button onClick={download}><Download size={16} />Export JSON</button>
            <InstallButton />
            <button data-testid="ics" onClick={() => downloadIcs(plan, T)} title="All-day events for each itinerary day + open checklist items. Imports into Google Calendar (Settings → Import), Apple Calendar and Outlook."><CalendarPlus size={16} />Calendar (.ics)</button>
            {!readOnly && <button className="ghost" onClick={() => { if (confirm("Clear this plan?")) setPlan(null); }}>Clear</button>}
          </>}
        </div>
          {plan && shareMsg && !readOnly && <div className="card noprint small" data-testid="share-msg">{shareMsg}{shareUrl && <input id="share-url" readOnly value={shareUrl} onFocus={e => e.target.select()} />}<span className="muted"> Anyone with the full link can read this snapshot, including custom notes. Avoid sensitive details. Edits are not synced.</span></div>}
      </footer>
    </div>
  );
}
