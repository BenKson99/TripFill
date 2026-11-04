import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
type Any = any;

export const DAY_COLORS = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#9a6324", "#469990", "#800000", "#808000", "#000075", "#e6beff", "#aaffc3"];
export interface Pin { name: string; lat: number; lon: number; day: number | null; dayLabel?: string; slot?: string; url?: string; type?: string }

/** Which itinerary day (0-based) and slot mention each highlight. */
export function pinsFor(highlights: Any[], itinerary: Any[]): Pin[] {
  return highlights.filter(h => typeof h.lat === "number" && typeof h.lon === "number").map(h => {
    let day: number | null = null, slot: string | undefined, dayLabel: string | undefined;
    itinerary.forEach((d: Any, i: number) => {
      if (day != null) return;
      for (const s of ["morning", "afternoon", "evening"]) if ((d[s] || "").includes(h.name)) { day = i; slot = s; dayLabel = d.label; return; }
    });
    return { name: h.name, lat: h.lat, lon: h.lon, day, slot, dayLabel, url: h.url, type: h.type };
  });
}

export function MapView({ pins, center, legend, route }: { pins: Pin[]; center: { lat: number; lon: number; name?: string }[]; route?: boolean; legend: { label: string; color: string }[] }) {
  const el = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false });
    map.current = m;
    // OSM tile usage policy: visible attribution, standard tile URL, no bulk/prefetch; the browser sends its own UA + Referer.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
    const pts: L.LatLngExpression[] = [];
    for (const c of center) { L.circleMarker([c.lat, c.lon], { radius: 5, color: "#222", fillOpacity: 1 }).addTo(m).bindTooltip(c.name || "Destination"); pts.push([c.lat, c.lon]); }
    if (route && center.length > 1) L.polyline(center.map(c => [c.lat, c.lon] as [number, number]), { color: "#222", weight: 2, dashArray: "6 6", opacity: 0.7 }).addTo(m).bindTooltip("Route between cities");
    for (const p of [...pins].sort((a, b) => (a.day == null ? 0 : 1) - (b.day == null ? 0 : 1))) {
      const color = p.day == null ? "#8a8f9c" : DAY_COLORS[p.day % DAY_COLORS.length];
      const mk = L.circleMarker([p.lat, p.lon], { radius: 9, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.95 }).addTo(m);
      const div = document.createElement("div");
      const b = document.createElement("b"); b.textContent = p.name; div.append(b, document.createElement("br"));
      div.append(p.day == null ? "Not scheduled yet" : `${p.dayLabel} · ${p.slot}`);
      if (p.url) { const a = document.createElement("a"); a.href = p.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = " Wikipedia ↗"; div.append(document.createElement("br"), a); }
      mk.bindPopup(div); mk.bindTooltip(p.name); (mk as Any)._tfName = p.name;
      pts.push([p.lat, p.lon]);
    }
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 }); else if (pts.length) m.setView(pts[0], 12);
    const ro = new ResizeObserver(() => m.invalidateSize()); ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, [JSON.stringify(pins), JSON.stringify(center), route]);
  return (
    <div>
      <div ref={el} className="map" data-testid="map" />
      <div className="legend">{legend.map(l => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}</div>
      <p className="muted small">Pins are approximate (Wikidata coordinates). Map data © OpenStreetMap contributors, tiles from tile.openstreetmap.org (fair-use policy; no offline caching of tiles).</p>
    </div>
  );
}
