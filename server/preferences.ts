import { normalizePreferences } from "../shared/portable.js";
import type { Eat, Eats } from "./eats.js";
import type { Highlight } from "./places.js";
import type { TripInput, ItinDay } from "./plan.js";
export { normalizePreferences };
export function dietaryEats(eats: Eats, input: TripInput): Eats {
  const need = normalizePreferences(input).dietaryNeeds;
  const hinted = (e: Eat) => need !== "none" && (need === "vegetarian" ? /vegan|vegetarian/i : new RegExp(need.replace("_", "[- ]?"), "i")).test(e.name);
  const match = (e: Eat) => ["yes", "only"].includes(e.dietary?.[need] || "") ? 2 : hinted(e) ? 1 : 0;
  const select = (list: Eat[], cap: number) => list.filter(e => need === "none" || e.dietary?.[need] !== "no")
    .map(e => ({ ...e, dietaryStatus: need === "none" ? "No dietary filter requested" : ["yes", "only"].includes(e.dietary?.[need] || "") ? `Source tags ${need.replace(/_/g, " ")} options — confirm directly` : hinted(e) ? `Name suggests ${need.replace(/_/g, " ")} options, unverified — ask venue` : `${need.replace(/_/g, " ")} information unknown — ask venue` }))
    .sort((a, b) => need === "none" ? 0 : match(b) - match(a)).slice(0, cap);
  return { ...eats, restaurants: select(eats.restaurants, 8), cafes: select(eats.cafes, 6) };
}
const strenuous = /hike|trek|mountain|summit|ski|climb|trail|peak/i;
export function preferredHighlights(hl: Highlight[], inp: TripInput): Highlight[] {
  const p = normalizePreferences(inp);
  const pool = p.walkingTolerance === "low" ? hl.filter(h => !h.ski && !strenuous.test(`${h.name} ${h.type || ""}`)) : [...hl];
  const terms = p.interests.toLowerCase().split(/[,; ]+/).filter(t => t.length >= 3);
  const score = (h: Highlight) => terms.reduce((s, t) => s + Number(`${h.name} ${h.type || ""} ${h.description}`.toLowerCase().includes(t.replace(/s$/, ""))), 0);
  return pool.sort((a, b) => score(b) - score(a));
}
export function walkingNotes(days: ItinDay[], inp: TripInput) {
  if (normalizePreferences(inp).walkingTolerance !== "low") return;
  days.forEach((d, i) => {
    if (i === 0) d.afternoon = "Check in; rest or take a short optional outing using local transport";
    else if (i < days.length - 1) { d.afternoon = "Long lunch & rest; use transport between stops"; if (/walk|hike|ski|climb/i.test(d.morning)) d.morning = "Optional short nearby stop — confirm access with the venue"; }
    d.notes = [d.notes?.includes("Limited walking:") ? "" : d.notes, "Limited walking: fewer stops; step-free access, gradients and distances not verified. Confirm access before booking."].filter(Boolean).join(" · ");
  });
}
