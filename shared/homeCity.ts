/** Home-city lookup shared by the form and /api/generate. No network here. */
export type HomePlace = { name: string; admin1?: string; country?: string };
export const placeLabel = (p: HomePlace) => [p.name, p.admin1 && p.admin1 !== p.name ? p.admin1 : null, p.country].filter(Boolean).join(", ");

export function homeTextMatches(place: HomePlace, typed: string): boolean {
  const t = typed.trim().toLowerCase();
  if (!t || !place?.name) return false;
  const label = placeLabel(place).toLowerCase();
  const name = place.name.toLowerCase();
  return t === label || t === name || label.startsWith(t + ",") || t.startsWith(name + ",");
}

/** If the typed field is empty there is no home. If it already matches a resolved place, reuse it.
 *  Otherwise the server (or a pending client lookup) must geocode the typed text — never drop it. */
export function homeLookupQuery(typed: string, resolved?: HomePlace | null): { query: string | null; reuse: HomePlace | null } {
  const t = typed.trim();
  if (!t) return { query: null, reuse: null };
  if (resolved && homeTextMatches(resolved, t)) return { query: null, reuse: resolved };
  return { query: (t.split(",")[0] || t).trim(), reuse: null };
}

export function homeGenerateFields(typed: string, resolved?: HomePlace | null) {
  const look = homeLookupQuery(typed, resolved);
  return { home: look.reuse || undefined, homeCity: t(typed) };
}
const t = (s: string) => s.trim() || undefined;
