import { compressToEncodedURIComponent as enc, decompressFromEncodedURIComponent as dec } from "lz-string";
type Any = any;
/** Links up to this length carry the whole plan in the URL #fragment (never sent to any server). */
export const MAX_URL_CHARS = 16000;

export function sharePayload(plan: Any) { const { matches, ...rest } = plan; return rest; }

export async function makeShareLink(plan: Any): Promise<{ url: string; mode: "url" | "server" }> {
  const base = location.origin + location.pathname;
  const hash = enc(JSON.stringify(sharePayload(plan)));
  const url = `${base}#plan=${hash}`;
  const max = import.meta.env.DEV && new URLSearchParams(location.search).get("shareMax") ? Number(new URLSearchParams(location.search).get("shareMax")) : MAX_URL_CHARS; // dev-only test hook
  if (url.length <= max) return { url, mode: "url" };
  const r = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: sharePayload(plan) }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Share failed");
  return { url: `${base}?share=${(await r.json()).id}`, mode: "server" };
}

/** Reads a shared plan from the current URL, if any. */
export async function readSharedPlan(): Promise<{ plan: Any; via: string } | { error: string } | null> {
  const m = location.hash.match(/#plan=(.+)$/);
  if (m) { try { const p = JSON.parse(dec(m[1]) || ""); if (p?.place) return { plan: p, via: "link" }; } catch { /* fallthrough */ } return { error: "This share link is damaged or truncated." }; }
  const id = new URLSearchParams(location.search).get("share");
  if (id) { const r = await fetch(`/api/share/${encodeURIComponent(id)}`); const j = await r.json(); return r.ok ? { plan: j.plan, via: "server" } : { error: j.error }; }
  return null;
}
export function clearShareFromUrl() { const u = new URL(location.href); u.hash = ""; u.searchParams.delete("share"); history.replaceState(null, "", u.toString()); }
