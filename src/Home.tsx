import { useEffect, useState } from "react";
import { resolveTravelMode, type TravelMode } from "../shared/travel";
import { TravelModeField } from "./TravelMode";
type Any = any;
export const HOME_CITY_KEY = "tripfill:homeCity";
export const placeLabel = (p: Any) => [p.name, p.admin1 && p.admin1 !== p.name ? p.admin1 : null, p.country].filter(Boolean).join(", ");

export function useHomeCity(): [Any | null, (p: Any | null) => void] {
  const [p, set] = useState<Any | null>(() => { try { return JSON.parse(localStorage.getItem(HOME_CITY_KEY) || "null"); } catch { return null; } });
  useEffect(() => { p ? localStorage.setItem(HOME_CITY_KEY, JSON.stringify(p)) : localStorage.removeItem(HOME_CITY_KEY); }, [p]);
  return [p, set];
}

/** Text field that geocodes on Enter/blur and lets you pick among matches. */
export function HomeCityField({ value, onChange }: { value: Any | null; onChange: (p: Any | null) => void }) {
  const [q, setQ] = useState(value ? placeLabel(value) : "");
  const [opts, setOpts] = useState<Any[]>([]);
  const [state, setState] = useState("");
  useEffect(() => { if (value) setQ(placeLabel(value)); }, [value?.id]);
  async function resolve() {
    const t = q.trim();
    if (!t) { onChange(null); setOpts([]); return; }
    if (value && t === placeLabel(value)) return;
    setState("…");
    try {
      const r = await (await fetch(`/api/geocode?q=${encodeURIComponent(t.split(",")[0])}`)).json();
      const res: Any[] = r.results || [];
      if (!res.length) { setState(`Couldn't find "${t}"`); return; }
      const best = [...res].sort((a, b) => (b.population || 0) - (a.population || 0))[0];
      onChange(best); setQ(placeLabel(best)); setOpts(res.filter(x => x.id !== best.id).slice(0, 4)); setState("");
    } catch { setState("Geocoding failed"); }
  }
  return (
    <label className="wide">Home city <small className="muted">(optional — for travel time, time difference, domestic/intl.)</small>
      <input data-testid="home-city" placeholder="e.g. Detroit" value={q} onChange={e => setQ(e.target.value)} onBlur={resolve}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); resolve(); } }} />
      {state && <small className="muted">{state}</small>}
      {opts.length > 0 && <small className="muted">Not it? {opts.map((o, i) => <a key={o.id} href="#" onMouseDown={e => { e.preventDefault(); onChange(o); setOpts([]); }}>{i ? " · " : ""}{placeLabel(o)}</a>)}</small>}
    </label>
  );
}

export function Snapshot({ trip, dest, mode, onMode, readOnly }: { trip: Any; dest: Any; mode?: TravelMode; onMode?: (m: TravelMode) => void; readOnly?: boolean }) {
  const resolved = mode || resolveTravelMode(undefined, trip?.distanceKm);
  if (!trip) return <div className="noprint">{onMode && <TravelModeField value={resolved} onChange={onMode} disabled={readOnly} hint="Add a home city for an approximate travel time. Changing the mode updates packing and leave-home tasks without a new weather fetch." />}<p className="muted small">Add a home city to see travel time, time difference and domestic/international.</p></div>;
  return (
    <div className="snap" data-testid="snapshot">
      <div><small>From</small><b>{placeLabel(trip.home)}</b></div>
      <div><small>Trip type</small><b>{trip.domestic ? `Domestic (${dest.country})` : "International"}</b></div>
      <div><small>Travel time</small><b>{trip.flightLabel}</b></div>
      <div><small>Time difference</small><b>{trip.tzLabel}</b>{trip.destTz && <small>{trip.destTz}</small>}</div>
      {onMode && <div className="snap-mode noprint"><TravelModeField value={resolved} onChange={onMode} disabled={readOnly} hint="Approximate times are not a road route or a booked flight. Changing this updates labels and packing suggestions without a new weather fetch." /></div>}
    </div>
  );
}
