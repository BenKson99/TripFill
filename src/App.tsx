import { useEffect, useState } from "react";
import { CalendarDays, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, Link2, Printer, Download, CalendarPlus, Upload, Plane, Sun, Thermometer, Users, Wallet } from "lucide-react";
import { ThemeToggle } from "./Theme";
import { LayoutBar, SectionList, useLayout } from "./Sections";
import { InstallButton, useOnline } from "./Pwa";
import { downloadIcs } from "./ics";
import { DAY_COLORS, MapView, pinsFor } from "./MapView";
import { clearShareFromUrl, makeShareLink, readSharedPlan } from "./Share";
import { HomeCityField, Snapshot, useHomeCity } from "./Home";
import { CurrencyPicker, RateLine, crossRate, money, useFx, useHomeCurrency } from "./Money";

const TITLES: Record<string, string> = { weather: "Weather", highlights: "Local highlights", map: "Map", food: "Food to try", packing: "Packing list", itinerary: "Day by day", timeline: "Pre-trip timeline", budget: "Budget (estimate)" };
function WxIcon({ s }: { s: string }) {
  const t = (s || "").toLowerCase();
  const [I, c] = /thunder|storm/.test(t) ? [CloudLightning, "rain"] : /snow|sleet/.test(t) ? [CloudSnow, "cloud"] : /rain|shower|drizzle|wet/.test(t) ? [CloudRain, "rain"] : /fog|mist/.test(t) ? [CloudFog, "cloud"] : /overcast|cloud/.test(t) ? (/part|some|mostly clear/.test(t) ? [CloudSun, ""] : [Cloud, "cloud"]) : [Sun, ""];
  return <I size={26} className={"wxi " + c} aria-hidden />;
}
const HeroArt = () => <svg className="hero-art" viewBox="0 0 400 260" aria-hidden><defs><linearGradient id="hg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".9" /><stop offset="1" stopColor="var(--sun)" stopOpacity=".8" /></linearGradient></defs>
  <circle cx="290" cy="95" r="58" fill="url(#hg)" opacity=".85" />
  <path d="M0 210 C70 170 120 190 180 175 S300 140 400 165 L400 260 L0 260Z" fill="var(--teal)" opacity=".18" />
  <path d="M0 232 C90 205 160 222 240 205 S350 190 400 200 L400 260 L0 260Z" fill="var(--teal)" opacity=".28" />
  <path d="M40 120 Q150 30 260 70" fill="none" stroke="var(--ink)" strokeOpacity=".35" strokeWidth="2" strokeDasharray="5 7" />
  <g transform="translate(262 62) rotate(18)" fill="var(--ink)" opacity=".7"><path d="M0 0 L-14 -5 L-12 0 L-14 5Z" /><rect x="-9" y="-1.2" width="14" height="2.4" rx="1.2" /></g>
  <circle cx="40" cy="120" r="5" fill="var(--accent)" /></svg>;

type Any = any;
const PRESETS: [string, string][] = [["beach", "🏖 Beach"], ["hiking", "🥾 Hiking"], ["ski", "⛷ Ski"], ["city", "🏙 City"], ["business", "💼 Business"], ["kids", "🧒 With kids"], ["roadtrip", "🚗 Road trip"]];
const KEY = "tripfill:v1";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (k: number) => { const d = new Date(); d.setDate(d.getDate() + k); return iso(d); };

function Editable({ value, onChange, multiline }: { value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return multiline
    ? <textarea className="ed" value={value} rows={3} onChange={e => onChange(e.target.value)} />
    : <input className="ed" value={value} onChange={e => onChange(e.target.value)} />;
}

const defaultUnit = (): "C" | "F" => /-(US|LR|MM)$/i.test(navigator.language || "") || /^en$/i.test(navigator.language) && Intl.DateTimeFormat().resolvedOptions().timeZone?.startsWith("America/") ? "F" : "C";

export default function App() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } })();
  const [form, setForm] = useState<Any>(saved?.form || { destination: "", start: plus(10), end: plus(16), travelers: 2, purpose: "Leisure", style: "Mix", interests: "" });
  const [plan, setPlan] = useState<Any>(saved?.plan || null);
  const [matches, setMatches] = useState<Any[] | null>(null);
  const [unit, setUnit] = useState<"C" | "F">(() => (localStorage.getItem(KEY + ":unit") as "C" | "F") || defaultUnit());
  useEffect(() => { localStorage.setItem(KEY + ":unit", unit); }, [unit]);
  const deg = (c: number) => unit === "F" ? `${Math.round(c * 9 / 5 + 32)}°F` : `${Math.round(c)}°C`;
  const T = (s: string) => (s || "").replace(/\{t:(-?[\d.]+)\}/g, (_m, v) => deg(Number(v))).replace(/(-?\d+(?:\.\d+)?)°C\b/g, (_m, v) => deg(Number(v)));
  const [layout, setLayout] = useLayout(Object.keys(TITLES));
  const [homeCity, setHomeCity] = useHomeCity();
  const [home, setHome, homeExplicit] = useHomeCurrency(homeCity?.countryCode || plan?.trip?.home?.countryCode);
  const { fx, busy: fxBusy, refresh: fxRefresh } = useFx();
  const online = useOnline() && !(fx as Any)?.offline;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [readOnly, setReadOnly] = useState<string | null>(null); // "link" | "server" when viewing a shared plan
  const [shareMsg, setShareMsg] = useState("");
  useEffect(() => {
    const load = () => readSharedPlan().then(r => { if (!r) return; if ("error" in r) setErr(r.error); else { setErr(""); setPlan(r.plan); setReadOnly(r.via); } });
    load(); addEventListener("hashchange", load); return () => removeEventListener("hashchange", load);
  }, []);
  useEffect(() => { if (!readOnly) localStorage.setItem(KEY, JSON.stringify({ form, plan })); }, [form, plan, readOnly]);
  const closeShared = () => { clearShareFromUrl(); setReadOnly(null); setPlan(saved?.plan || null); };
  const importShared = () => { clearShareFromUrl(); setReadOnly(null); };
  async function share() {
    setShareMsg("…");
    try {
      const { url, mode } = await makeShareLink(plan);
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked */ }
      setShareMsg(mode === "url" ? `Link copied — the whole plan is inside the link (${url.length.toLocaleString()} chars), nothing stored on a server.` : `Plan was too big for a link, so it was saved on this TripFill server; short link copied.`);
      (window as Any).__lastShare = url;
      setTimeout(() => (document.getElementById("share-url") as HTMLInputElement | null)?.select(), 0);
      setShareUrl(url);
    } catch (e: Any) { setShareMsg("Share failed: " + e.message); }
  }
  const [shareUrl, setShareUrl] = useState("");

  async function generate(place?: Any, legsOverride?: Any[]) {
    const legs = (legsOverride || form.legs || []).filter((l: Any) => l.destination?.trim());
    setErr(""); setLoading(true); setMatches(null);
    try {
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, legs: legs.length ? legs : undefined, place, home: homeCity || undefined, fxForce: new URLSearchParams(location.search).get("fxForce") || undefined }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      if (j.needsChoice) setMatches(j.matches); else setPlan(j);
    } catch (e: Any) { setErr(e.message); } finally { setLoading(false); }
  }
  const upd = (fn: (p: Any) => void) => readOnly ? undefined : setPlan((p: Any) => { const c = structuredClone(p); fn(c); return c; });
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" })); a.download = `tripfill-${plan.place.name}-${plan.input.start}.json`.replace(/\s+/g, "_"); a.click(); };
  const importJson = (f: File) => f.text().then(t => setPlan(JSON.parse(t))).catch(() => setErr("Invalid JSON file"));
  const fmtRange = (a: string, b: string) => { const o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }; const f = (x: string) => new Date(x + "T12:00").toLocaleDateString(undefined, o); return `${f(a)} – ${f(b)}, ${b.slice(0, 4)}`; };
  const placeLabel = (m: Any) => [m.name, m.admin1, m.country].filter(Boolean).join(", ");

  const packItems = plan ? plan.packing.groups.flatMap((g: Any) => g.items) : [];
  const pins = plan ? pinsFor(plan.highlights || [], plan.itinerary || []) : [];
  const summaries: Record<string, string> = plan ? {
    map: `${pins.length} pinned sights across ${new Set(pins.filter(p => p.day != null).map(p => p.day)).size} day(s)`,
    weather: `${plan.weather.source === "forecast" ? "Forecast" : plan.weather.source === "mixed" ? "Forecast + typical" : "Typical"} · highs ~${deg(plan.weather.stats.avgHigh)}, lows ~${deg(plan.weather.stats.avgLow)} · ~${plan.weather.stats.rainyDays} wet day(s)`,
    highlights: `${plan.highlights.length} sights · ${plan.highlights.slice(0, 3).map((h: Any) => h.name).join(", ")}…`,
    food: `${plan.food.length} dishes · ${plan.food.slice(0, 3).map((f: Any) => f.name).join(", ")}…`,
    packing: `${packItems.length} items, ${packItems.filter((i: Any) => i.checked).length} packed`,
    itinerary: `${plan.itinerary.length} days · ${plan.input.style} pace`,
    timeline: `${plan.timeline.length} tasks, ${plan.timeline.filter((t: Any) => t.done).length} done · next: ${(plan.timeline.find((t: Any) => !t.done) || {}).task || "all done"}`,
    budget: plan.legs?.length > 1 ? (() => { const parts = plan.legs.map((lg: Any) => { const L = lg.budget.currency; const t = lg.budget.lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); const x = crossRate(fx, home, L); return { s: money(t, L), h: L === home ? t : x ? t / x : null }; }); const all = parts.every((p: Any) => p.h != null); return `${parts.map((p: Any) => '~' + p.s).join(' + ')}${all ? ` ≈ ${money(parts.reduce((a: number, p: Any) => a + p.h, 0), home)} total` : ''} estimate`; })() : (() => { const L = plan.budget.currency; const tot = plan.budget.lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); const x = crossRate(fx, home, L); return `~${money(tot, L)}${x && home !== L ? ` ≈ ${money(tot / x, home)}` : ""} estimate`; })(),
  } : {};
  const budgetTable = (B: Any, G: (p: Any) => Any, tid = "") => <>
          <p className="warn">{B.note}</p>
          <p className="muted small">{B.fxNote}</p>
          <p><RateLine fx={fx} home={home} local={B.currency} busy={fxBusy} onRefresh={fxRefresh} /></p>
          {(() => { const L = B.currency; const x = crossRate(fx, home, L); const conv = !!x && home !== L; const H = (n: number) => conv ? money(n / x!, home) : ""; const n = Math.max(1, Number(plan.input.travelers) || 1); const tot = B.lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); const lo = B.lines.reduce((s: number, l: Any) => s + l.low, 0), hi = B.lines.reduce((s: number, l: Any) => s + l.high, 0);
          const setTotal = (v: number) => upd(p => { const cur = G(p).lines.reduce((s: number, l: Any) => s + (Number(l.total) || 0), 0); G(p).lines.forEach((l: Any) => { l.total = Math.round(cur ? (Number(l.total) || 0) * v / cur : v / G(p).lines.length); }); });
          const Dual = ({ v, set, testid }: { v: number; set: (n: number) => void; testid?: string }) => <div className="dual"><input data-testid={testid ? testid + "-local" : undefined} aria-label={`Amount in ${L}`} type="number" className="ed num" value={Math.round(v)} onChange={e => set(Number(e.target.value))} /><small>{L}</small>{conv && <><input data-testid={testid ? testid + "-home" : undefined} aria-label={`Amount in ${home}`} type="number" className="ed num" value={Math.round(v / x!)} onChange={e => set(Number(e.target.value) * x!)} /><small>{home}</small></>}</div>;
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
          <div className="wx">{plan.weather.days.map((d: Any) => <div key={d.date} className="wxd">{plan.legs?.length > 1 && <small className="legtag">{d.leg}</small>}<b>{new Date(d.date + "T12:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</b><WxIcon s={d.summary} /><span className="temp">{deg(d.tmax)} <small>/ {deg(d.tmin)}</small></span><small>{d.typical ? "typical · " : ""}{d.summary}{d.precipProb != null ? ` · ${d.precipProb}%` : ""}</small></div>)}</div>
    </>,
    highlights: <>
          <ol className="hl">{plan.highlights.map((h: Any, i: number) => <li key={i}>{plan.legs?.length > 1 && h.leg !== plan.highlights[i - 1]?.leg && <h3 className="leghead">📍 {h.leg}</h3>}
            <Editable value={h.name} onChange={v => upd(p => { p.highlights[i].name = v; })} /><span className={"tag " + (h.setting || (h.indoor ? "indoor" : "outdoor"))}>{h.setting || (h.indoor ? "indoor" : "outdoor")}</span>{h.type && <small className="muted"> {h.type}</small>}
            <Editable multiline value={h.description} onChange={v => upd(p => { p.highlights[i].description = v; })} />
            <small className="muted">Source: {h.url ? <a href={h.url} target="_blank">{h.source}</a> : h.source} · check official site for hours & prices</small>
          </li>)}</ol>
    </>,
    food: <>
          <ul className="hl">{plan.food.map((f: Any, i: number) => <li key={i}>{plan.legs?.length > 1 && f.leg && f.leg !== plan.food[i - 1]?.leg && <h3 className="leghead">📍 {f.leg}</h3>}<Editable value={f.name} onChange={v => upd(p => { p.food[i].name = v; })} />{(f.localName || f.gloss) && <div className="gloss">{f.localName && <b>{f.localName}</b>}{f.localName && f.gloss ? " — " : ""}{f.gloss}</div>}<Editable multiline value={f.description} onChange={v => upd(p => { p.food[i].description = v; })} /><small className="muted">{f.url ? <a href={f.url} target="_blank">{f.source}</a> : f.source}</small></li>)}</ul>
          <p className="muted small">Sources: {plan.sources.join(" · ")}{plan.aiPolished ? " · descriptions lightly reworded by AI" : ""}</p>
    </>,
    packing: <>
          <div className="grid">{plan.packing.groups.map((g: Any, gi: number) => <div key={g.group}><h3>{g.group}</h3>
            {g.items.map((it: Any, ii: number) => <div key={it.id} className="pk"><input type="checkbox" checked={it.checked} onChange={e => upd(p => { p.packing.groups[gi].items[ii].checked = e.target.checked; })} /><Editable value={it.item} onChange={v => upd(p => { p.packing.groups[gi].items[ii].item = v; })} />{it.reason && <small className="why">{T(it.reason)}</small>}<button className="x noprint" onClick={() => upd(p => { p.packing.groups[gi].items.splice(ii, 1); })}>×</button></div>)}
            <button className="add noprint" onClick={() => upd(p => { p.packing.groups[gi].items.push({ id: crypto.randomUUID(), item: "New item", reason: "", checked: false }); })}>+ add</button></div>)}
            <div><h3>🚫 Leave at home</h3>{plan.packing.leaveAtHome.map((it: Any, ii: number) => <div key={it.id} className="pk"><Editable value={it.item} onChange={v => upd(p => { p.packing.leaveAtHome[ii].item = v; })} /><small className="why">{T(it.reason)}</small></div>)}</div>
          </div>
    </>,
    itinerary: <>
          {plan.itinerary.map((d: Any, i: number) => <div key={d.date} className="day"><h3>{d.label}{plan.legs?.length > 1 && d.leg && <span className="legtag"> 📍 {d.leg}</span>} <small className="muted">{T(d.weather)}</small></h3>
            {(["morning", "afternoon", "evening"] as const).map(k => <div key={k} className="slot"><span>{k}</span><Editable value={d[k]} onChange={v => upd(p => { p.itinerary[i][k] = v; })} /></div>)}
            {d.rainyBackup && <div className="slot"><span>☔ backup</span><Editable value={d.rainyBackup} onChange={v => upd(p => { p.itinerary[i].rainyBackup = v; })} /></div>}
            <div className="slot"><span>notes</span><Editable value={d.notes} onChange={v => upd(p => { p.itinerary[i].notes = v; })} /></div>
          </div>)}
    </>,
    timeline: <>
          {plan.timeline.map((t: Any, i: number) => <div key={t.id} className="pk"><input type="checkbox" checked={t.done} onChange={e => upd(p => { p.timeline[i].done = e.target.checked; })} /><input type="date" className="ed date" value={t.due} onChange={e => upd(p => { p.timeline[i].due = e.target.value; })} /><Editable value={t.task} onChange={v => upd(p => { p.timeline[i].task = v; })} /></div>)}
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

  return (
    <div className={"wrap" + (plan ? " compact" : "")}>
      <div className="topbar noprint"><div className="brand"><span className="logo"><Plane size={18} /></span>TripFill</div><ThemeToggle /></div>
      <header className="hero noprint"><HeroArt /><span className="eyebrow"><MapPin size={14} />Free · no sign-up · works offline</span><h1>Plan the trip, <em>not the spreadsheet.</em></h1><p>Destination and dates in — weather, highlights, food, packing list and a day-by-day plan out. Everything stays editable and saved in this browser.</p></header>

      {!online && <div className="card warn noprint" data-testid="offline">📴 You're offline — showing your last saved plan. Editing works and is saved in this browser; generating a new plan, the map tiles and live rates need a connection.</div>}
      <form className="card form noprint" onSubmit={e => { e.preventDefault(); generate(); }}>
        <label className="wide">Destination<input required placeholder="e.g. Lisbon" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} /></label>
        <label>Start<input type="date" required value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} /></label>
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
        <label>Travelers<input type="number" min={1} value={form.travelers} onChange={e => setForm({ ...form, travelers: e.target.value })} /></label>
        <label>Purpose<select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>{["Leisure", "Business", "Family", "Celebration", "Adventure", "Other"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Style<select value={form.style} onChange={e => setForm({ ...form, style: e.target.value })}>{["Slow", "Mix", "Packed"].map(x => <option key={x}>{x}</option>)}</select></label>
        <fieldset className="wide presets"><legend>Trip type <small className="muted">(pick any)</small></legend>
          {PRESETS.map(([k, l]) => <label key={k} className={"chip" + ((form.presets || []).includes(k) ? " on" : "")}><input type="checkbox" data-preset={k} checked={(form.presets || []).includes(k)} onChange={e => setForm({ ...form, presets: e.target.checked ? [...(form.presets || []), k] : (form.presets || []).filter((x: string) => x !== k) })} />{l}</label>)}
        </fieldset>
        <HomeCityField value={homeCity} onChange={setHomeCity} />
        <label className="wide">Interests<input placeholder="food, museums, hiking, photography…" value={form.interests} onChange={e => setForm({ ...form, interests: e.target.value })} /></label>
        <button disabled={loading || !online}>{!online ? "Offline — connect to generate" : loading ? "Building your plan… (~10s)" : "Generate plan"}</button>
      </form>
      {err && <div className="card error">{err}</div>}
      {matches && <div className="card noprint"><b>Which one did you mean?</b><div className="chips">{matches.map(m => <button key={m.id} onClick={() => generate(m)}>{placeLabel(m)}</button>)}</div></div>}

      {plan && <>
        {readOnly && <div className="card shared noprint" data-testid="shared-banner"><b>👀 Shared plan (read-only)</b> — {readOnly === "server" ? "loaded from this TripFill server" : "decoded from the link itself"}. Your own saved plan is untouched.
          <div className="chips"><button onClick={importShared}><Download size={16} />Import as my plan</button><button className="ghost" onClick={closeShared}>Close</button></div></div>}
        <div className="toolbar noprint">
          {!readOnly && <button data-testid="share" onClick={share}><Link2 size={16} />Copy share link</button>}
          <button onClick={() => window.print()}><Printer size={16} />Print / PDF</button>
          <button onClick={download}><Download size={16} />Download JSON</button>
          <InstallButton />
          <button data-testid="ics" onClick={() => downloadIcs(plan, T)} title="All-day events for each itinerary day + open checklist items. Imports into Google Calendar (Settings → Import), Apple Calendar and Outlook."><CalendarPlus size={16} />Calendar (.ics)</button>
          <div className="seg" role="group" aria-label="Temperature unit">{(["F", "C"] as const).map(u => <button key={u} className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>°{u}</button>)}</div>
          <label className="btn"><Upload size={16} />Import JSON<input type="file" accept=".json" hidden onChange={e => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
          <button className="ghost" onClick={() => { if (confirm("Clear this plan?")) setPlan(null); }}>Clear</button>
        </div>

        <section className="card trip-head">
          <div className="kicker"><MapPin size={14} />{plan.legs?.length > 1 ? `${plan.legs.length}-city trip` : plan.trip?.domestic === false ? "International trip" : plan.trip?.domestic ? "Domestic trip" : "Your trip"}</div>
          <h2>{plan.legs?.length > 1 ? plan.title : placeLabel(plan.place)}</h2>
          <p className="dates">{fmtRange(plan.input.start, plan.input.end)}</p>
          <p className="muted">{plan.input.travelers} traveler(s) · {plan.input.purpose} · {plan.input.style} pace{plan.input.interests ? ` · ${plan.input.interests}` : ""}{plan.input.presets?.length ? ` · ${plan.input.presets.map((k: string) => (PRESETS.find(p => p[0] === k) || [k, k])[1]).join(" ")}` : ""}</p>
          {plan.matches?.length > 1 && <p className="muted noprint">Wrong place? {plan.matches.filter((m: Any) => m.id !== plan.place.id).slice(0, 4).map((m: Any) => <a key={m.id} href="#" onClick={e => { e.preventDefault(); generate(m); }}>{placeLabel(m)}</a>).reduce((a: Any[], x: Any, i: number) => i ? [...a, " · ", x] : [x], [])}</p>}
          <div className="stats" data-testid="stats">
            <div className="stat"><CalendarDays size={18} /><div><b>{plan.itinerary.length} days</b><small>{plan.input.start} → {plan.input.end}</small></div></div>
            <div className="stat"><Users size={18} /><div><b>{plan.input.travelers}</b><small>traveler(s)</small></div></div>
            <div className="stat"><WxIcon s={plan.weather.days[0]?.summary || ""} /><div><b>{deg(plan.weather.stats.avgHigh)} / {deg(plan.weather.stats.avgLow)}</b><small>avg high / low · {plan.weather.stats.rainyDays} wet</small></div></div>
            <div className="stat"><Wallet size={18} /><div><b>{(summaries.budget || "").replace(/ estimate$/, "").split(" ≈ ").pop()}</b><small>budget estimate</small></div></div>
          </div>
          {plan.legs?.length > 1 && <div className="route" data-testid="route">{plan.legs.map((lg: Any, k: number) => <span key={k}>{k > 0 && <span className="hop">→ {lg.fromPrev?.flightLabel || "travel"} →</span>}<b>📍 {lg.place.name}</b> <small className="muted">{lg.place.country} · {lg.start.slice(5)}–{lg.end.slice(5)} · {lg.nights} night(s)</small>{lg.alternatives?.length > 0 && !readOnly && <small className="muted noprint"> · not it? {lg.alternatives.slice(0, 3).map((a: Any, ai: number) => <a key={ai} href="#" onClick={e => { e.preventDefault(); const L = plan.input.legs.map((x: Any, j: number) => j === k - 1 ? { ...x, place: a } : x); setForm({ ...form, legs: L.map(({ destination, start }: Any) => ({ destination, start })) }); generate(plan.place, L); }}>{a.name}, {a.country}</a>).reduce((acc: Any[], x: Any, i: number) => i ? [...acc, " · ", x] : [x], [])}</small>}</span>)}</div>}
          <Snapshot trip={plan.trip} dest={plan.place} />
          <div className="moneycard" data-testid="money-card"><b>Money</b>{(plan.legs?.length > 1 ? [...new Set(plan.legs.map((l: Any) => l.budget.currency))] as string[] : [plan.budget?.localCurrency || plan.budget?.currency || home]).map((c: string, i: number) => <RateLine key={c} compact fx={fx} home={home} local={c} shownIn={i === 0 && !(plan.legs?.length > 1) ? plan.budget?.currency : c} busy={fxBusy} onRefresh={fxRefresh} />)}<span className="noprint"><CurrencyPicker value={home} onChange={setHome} hint={homeExplicit ? "your choice" : homeCity ? `from ${homeCity.country}` : "from browser locale"} /></span></div>
          {plan.capped && <p className="warn">Trips longer than 14 days: weather & itinerary cover the first 14 days.</p>}
        </section>

        <LayoutBar layout={layout} setLayout={setLayout} titles={TITLES} />
        {shareMsg && !readOnly && <div className="card noprint small" data-testid="share-msg">{shareMsg}{shareUrl && <input id="share-url" readOnly value={shareUrl} onFocus={e => e.target.select()} />}<span className="muted"> Anyone with the link can view a snapshot; edits aren't synced (no live collaboration).</span></div>}
        <SectionList layout={layout} setLayout={setLayout} titles={TITLES} summaries={summaries} bodies={readOnly ? Object.fromEntries(Object.entries(bodies).map(([k, v]) => [k, <fieldset key={k} className="ro" disabled>{v}</fieldset>])) : bodies} />
        <p className="muted small">Weather: Open-Meteo · Places: Wikivoyage / Wikipedia / Wikidata (CC BY-SA). Generated {new Date(plan.generatedAt).toLocaleString()}.</p>
      </>}
    </div>
  );
}
