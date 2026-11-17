import { getJSON, cached } from "./fetchy.js";
import type { Place } from "./weather.js";
import { haversineKm } from "./trip.js";

export interface RoadRoute {
  durationMin: number;
  distanceKm: number;
  src: "osrm" | "estimate";
  midpoint?: { name: string; lat: number; lon: number } | null;
}

function estimateRoute(a: { lat: number; lon: number }, b: { lat: number; lon: number }): RoadRoute {
  const straight = haversineKm(a, b);
  const distanceKm = Math.round(straight * 1.3);
  const durationMin = Math.round((distanceKm / 80) * 60);
  return { durationMin, distanceKm, src: "estimate", midpoint: null };
}

function midCoord(coords: [number, number][]): { lon: number; lat: number } | null {
  if (!coords.length) return null;
  const i = Math.floor(coords.length / 2);
  const [lon, lat] = coords[i] || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lon, lat };
}

async function reverseTown(lat: number, lon: number): Promise<string | null> {
  try {
    const d = await getJSON<any>(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`, 8000);
    const a = d?.address || {};
    const name = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || a.state;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

async function roadRoute0(home: Place, dest: Place, wantMidpoint: boolean): Promise<RoadRoute> {
  const fallback = estimateRoute(home, dest);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${home.lon},${home.lat};${dest.lon},${dest.lat}?overview=simplified&geometries=geojson&steps=false`;
    const d = await getJSON<any>(url, 12000);
    const r = d?.routes?.[0];
    const durationMin = Math.round((r?.duration ?? 0) / 60);
    const distanceKm = Math.round((r?.distance ?? 0) / 1000);
    if (!durationMin || !distanceKm) return fallback;
    const out: RoadRoute = { durationMin, distanceKm, src: "osrm", midpoint: null };
    if (wantMidpoint && durationMin >= 10 * 60) {
      const mid = midCoord(r.geometry?.coordinates || []);
      if (mid) {
        const name = await reverseTown(mid.lat, mid.lon);
        out.midpoint = { name: name || "a town around the midpoint", lat: mid.lat, lon: mid.lon };
      } else {
        out.midpoint = { name: "a town around the midpoint", lat: (home.lat + dest.lat) / 2, lon: (home.lon + dest.lon) / 2 };
      }
    }
    return out;
  } catch {
    return fallback;
  }
}

/** Cached OSRM road route from home to destination. Falls back to a padded straight-line estimate. */
export function roadRoute(home: Place, dest: Place, wantMidpoint = true): Promise<RoadRoute> {
  const key = `road|v1|${home.lat.toFixed(3)},${home.lon.toFixed(3)}|${dest.lat.toFixed(3)},${dest.lon.toFixed(3)}|${wantMidpoint ? "mid" : "nomid"}`;
  return cached(key, () => roadRoute0(home, dest, wantMidpoint));
}
