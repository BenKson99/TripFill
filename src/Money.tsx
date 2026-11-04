import { useCallback, useEffect, useMemo, useState } from "react";

export interface Fx { ok: boolean; rates: Record<string, number>; source: string; updated: string | null; fetchedAt: string; fallback: boolean; error?: string; offline?: boolean }
export const HOME_KEY = "tripfill:homeCurrency";

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "JPY", "CNY", "HKD", "SGD", "KRW", "TWD", "INR", "THB", "VND", "IDR", "MYR", "PHP", "CHF", "SEK", "NOK", "DKK", "ISK", "PLN", "CZK", "HUF", "RON", "BGN", "TRY", "ILS", "AED", "SAR", "QAR", "EGP", "MAD", "ZAR", "KES", "NGN", "MXN", "BRL", "ARS", "CLP", "COP", "PEN", "UYU", "CRC", "DOP", "RUB", "UAH", "GEL"];

const REGION_CUR: Record<string, string> = { US: "USD", PR: "USD", EC: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", JP: "JPY", CN: "CNY", HK: "HKD", SG: "SGD", KR: "KRW", TW: "TWD", IN: "INR", TH: "THB", VN: "VND", ID: "IDR", MY: "MYR", PH: "PHP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", TR: "TRY", IL: "ILS", AE: "AED", SA: "SAR", QA: "QAR", EG: "EGP", MA: "MAD", ZA: "ZAR", KE: "KES", NG: "NGN", MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", UY: "UYU", CR: "CRC", DO: "DOP", RU: "RUB", UA: "UAH", GE: "GEL" };
const EURO = "AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK".split(" ");

export function curForRegion(region?: string): string | undefined {
  if (!region) return undefined; region = region.toUpperCase();
  return EURO.includes(region) ? "EUR" : REGION_CUR[region];
}
export function localeCurrency(lang = navigator.language || "en-US"): string {
  try {
    const region = new Intl.Locale(lang).maximize().region || "US";
    return EURO.includes(region) ? "EUR" : REGION_CUR[region] || "USD";
  } catch { return "USD"; }
}
const names = (() => { try { return new Intl.DisplayNames(["en"], { type: "currency" }); } catch { return null; } })();
export const curName = (c: string) => names?.of(c) || c;
export function curSymbol(c: string) {
  try { return new Intl.NumberFormat("en", { style: "currency", currency: c, currencyDisplay: "narrowSymbol" }).formatToParts(0).find(p => p.type === "currency")?.value || c; } catch { return c; }
}
const decimals = (c: string) => { try { return new Intl.NumberFormat("en", { style: "currency", currency: c }).resolvedOptions().maximumFractionDigits ?? 2; } catch { return 2; } };
export function money(n: number, c: string, whole = true) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c, currencyDisplay: "narrowSymbol", maximumFractionDigits: whole ? 0 : decimals(c) }).format(n); } catch { return `${Math.round(n)} ${c}`; }
}
// Rate with ~4 significant digits, more for tiny values
export const fmtRate = (r: number) => r >= 100 ? r.toFixed(1) : r >= 1 ? r.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : Number(r.toPrecision(3)).toString();

/** Explicit picker choice wins; otherwise the home city's country; otherwise the browser locale. */
export function useHomeCurrency(homeCountry?: string): [string, (c: string) => void, boolean] {
  const [c, set] = useState<string | null>(() => localStorage.getItem(HOME_KEY));
  const choose = (x: string) => { localStorage.setItem(HOME_KEY, x); set(x); };
  return [c || curForRegion(homeCountry) || localeCurrency(), choose, !!c];
}

export function useFx() {
  const [fx, setFx] = useState<Fx | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (refresh = false) => {
    setBusy(true);
    try {
      const force = new URLSearchParams(location.search).get("fxForce");
      const r = await fetch(`/api/fx?${refresh ? "refresh=1&" : ""}${force ? `force=${force}` : ""}`);
      setFx(await r.json());
    } catch { setFx({ ok: false, rates: {}, source: "none", updated: null, fetchedAt: new Date().toISOString(), fallback: true, error: "network error" }); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { fx, busy, refresh: () => load(true) };
}

/** local units per 1 home unit, or null when unavailable */
export function crossRate(fx: Fx | null, home: string, local: string): number | null {
  if (home === local) return 1;
  if (!fx?.ok) return null;
  const h = fx.rates[home], l = fx.rates[local];
  return h && l ? l / h : null;
}

export function fmtUpdated(fx: Fx) {
  if (!fx.updated) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(fx.updated)) return `rates of ${fx.updated}`;
  return `updated ${new Date(fx.updated).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

export function RateLine({ fx, home, local, busy, onRefresh, compact, shownIn }: { shownIn?: string; fx: Fx | null; home: string; local: string; busy: boolean; onRefresh: () => void; compact?: boolean }) {
  if (home === local) return <span className="rate same">💱 Local currency is {local} ({curName(local)}) — same as your home currency, no conversion needed.</span>;
  const r = crossRate(fx, home, local);
  if (!fx) return <span className="rate">💱 Loading exchange rate…</span>;
  if (!r) return <span className="rate warn-inline">💱 Exchange rate {home}↔{local} unavailable right now{fx.error ? ` (${fx.error})` : ""} — amounts shown in {shownIn || local} only{shownIn && shownIn !== local ? ` (the USD baseline, since no ${local} rate was available)` : ""}. <button className="linkbtn noprint" onClick={onRefresh} disabled={busy}>↻ Retry</button></span>;
  return (
    <span className="rate" data-testid="rate-line">
      💱 <b>1 {home} = {fmtRate(r)} {local}</b> · 1 {local} = {fmtRate(1 / r)} {home}
      <span className="muted">{compact ? " · " : <br />}{fx.source}{fmtUpdated(fx) ? ` · ${fmtUpdated(fx)}` : ""}{fx.error && fx.ok ? ` · ${fx.error}` : ""}{fx.offline ? " · cached (offline)" : ""}</span>
      <button className="linkbtn noprint" onClick={onRefresh} disabled={busy} aria-label="Refresh exchange rate">{busy ? "…" : "↻"}</button>
    </span>
  );
}

export function CurrencyPicker({ value, onChange, hint }: { value: string; onChange: (c: string) => void; hint?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = useMemo(() => CURRENCIES.map(c => ({ c, label: `${c} — ${curName(c)} (${curSymbol(c)})` })), []);
  const hits = list.filter(x => !q || x.label.toLowerCase().includes(q.toLowerCase()));
  const pick = (c: string) => { onChange(c); setQ(""); setOpen(false); };
  return (
    <div className="curpick">
      <label htmlFor="home-cur">Home currency{hint && <small className="muted"> ({hint})</small>}</label>
      <div className="curbox">
        <input id="home-cur" role="combobox" aria-expanded={open} aria-controls="cur-list" aria-autocomplete="list" autoComplete="off"
          placeholder={`${value} — ${curName(value)} (${curSymbol(value)})`} value={q}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={e => { if (e.key === "Enter" && hits[0]) { e.preventDefault(); pick(hits[0].c); } if (e.key === "Escape") setOpen(false); }} />
        {open && <ul id="cur-list" role="listbox" className="curlist">
          {hits.slice(0, 50).map(x => <li key={x.c} role="option" aria-selected={x.c === value} className={x.c === value ? "sel" : ""} onMouseDown={e => { e.preventDefault(); pick(x.c); }}>{x.label}</li>)}
          {!hits.length && <li className="muted">No match</li>}
        </ul>}
      </div>
    </div>
  );
}
