// RFC 5545 iCalendar export. All-day events use VALUE=DATE (floating dates): an itinerary day is the
// calendar date at the destination and a checklist due date is the date at home, which is exactly what
// a floating all-day date means — calendars show it on that date regardless of the viewer's zone.
type Any = any;
const esc = (s: string) => (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const d8 = (iso: string) => iso.replace(/-/g, "");
const next = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
/** Fold lines to ≤75 octets (UTF-8 aware), continuation lines start with a space. */
export function fold(line: string): string {
  const enc = new TextEncoder(); const out: string[] = []; let cur = ""; let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length; const limit = out.length ? 74 : 75;
    if (bytes + b > limit) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur); return out.join("\r\n ");
}
function event(uid: string, date: string, summary: string, desc: string, loc: string, stamp: string, cats: string) {
  return ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d8(date)}`, `DTEND;VALUE=DATE:${d8(next(date))}`, `SUMMARY:${esc(summary)}`,
    desc && `DESCRIPTION:${esc(desc)}`, loc && `LOCATION:${esc(loc)}`, `CATEGORIES:${cats}`, "TRANSP:TRANSPARENT", "END:VEVENT"].filter(Boolean) as string[];
}
export function buildIcs(plan: Any, T: (s: string) => string = s => s): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const key = `${plan.input.start}-${(plan.place?.name || "trip").replace(/[^A-Za-z0-9]+/g, "")}`;
  const L: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TripFill//Trip planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc("Trip: " + (plan.title || plan.place?.name || "TripFill"))}`];
  (plan.itinerary || []).forEach((d: Any, i: number) => {
    const where = d.leg || plan.place?.name || "";
    const desc = [d.weather && `Weather: ${T(d.weather)}`, d.morning && `Morning: ${d.morning}`, d.afternoon && `Afternoon: ${d.afternoon}`, d.evening && `Evening: ${d.evening}`, d.rainyBackup && T(d.rainyBackup), d.notes && `Notes: ${d.notes}`].filter(Boolean).join("\n");
    L.push(...event(`tripfill-${key}-day${i + 1}@tripfill.local`, d.date, `✈ ${d.label}${where && !d.label.includes(where) ? ` — ${where}` : ""}`, desc, where, stamp, "TRAVEL"));
  });
  (plan.timeline || []).filter((t: Any) => t.due && !t.done).forEach((t: Any, i: number) =>
    L.push(...event(`tripfill-${key}-todo${i + 1}@tripfill.local`, t.due, `☐ ${t.task}`, `Pre-trip checklist for ${plan.place?.name || "your trip"} (TripFill)`, "", stamp, "TODO")));
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
export function downloadIcs(plan: Any, T?: (s: string) => string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buildIcs(plan, T)], { type: "text/calendar;charset=utf-8" }));
  a.download = `tripfill-${plan.place?.name || "trip"}-${plan.input.start}.ics`.replace(/\s+/g, "_"); a.click();
}
