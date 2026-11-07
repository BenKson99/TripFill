import { decodePlan, encodePlan, parsePlan, safeUrl } from "../shared/portable";
export { safeUrl };
export const MAX_URL_CHARS = 100_000;
/** New shares never fall back silently to ephemeral server storage. */
export async function makeShareLink(plan: any): Promise<{ url: string; mode: "url" }> {
  const url = `${location.origin}${location.pathname}#plan=${encodePlan(plan)}`;
  if (url.length > MAX_URL_CHARS) throw new Error("Plan is too large for a link. Export JSON and send the file instead.");
  return { url, mode: "url" };
}
export async function readSharedPlan(): Promise<{ plan: any; via: string } | { error: string } | null> {
  try {
    if (location.hash.startsWith("#plan=")) return { plan: decodePlan(location.hash.slice(6)), via: "link" };
    const id = new URLSearchParams(location.search).get("share");
    if (!id) return null;
    const r = await fetch(`/api/share/${encodeURIComponent(id)}`); const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Legacy shared plan unavailable. Ask the sender for a new portable link or JSON export. Lost server links cannot be recovered.");
    return { plan: parsePlan(JSON.stringify(j.plan)), via: "server" };
  } catch (e: any) { return { error: e.message || "Unable to load share link. Try again or import its JSON export." }; }
}
export function clearShareFromUrl() { const u = new URL(location.href); u.hash = ""; u.searchParams.delete("share"); history.replaceState(null, "", u.toString()); }
