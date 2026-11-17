import type { Highlight } from "./places.js";
import type { ItinDay } from "./plan.js";
import { isAdminOrReligiousOrg, isSeriousPeak, isSkiSector } from "../shared/activities.js";

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Highlight names, longest first, so "Matterhorn Museum" wins over "Matterhorn". */
export function itineraryPlaceNames(hl: { name: string }[]) {
  const names = hl.map(h => h.name).filter(n => n && n.length >= 3);
  return [...new Set(names)].sort((a, b) => b.length - a.length);
}

/** Names mentioned in text, skipping shorter names that sit inside a longer match. */
export function namesInText(text: string, names: string[]) {
  const t = text || "", lower = t.toLowerCase();
  const found: string[] = [];
  const covered: [number, number][] = [];
  for (const n of names) {
    let from = 0;
    while (from <= lower.length) {
      const i = lower.indexOf(n.toLowerCase(), from);
      if (i < 0) break;
      if (!covered.some(([a, b]) => i < b && i + n.length > a)) {
        found.push(n);
        covered.push([i, i + n.length]);
        break;
      }
      from = i + 1;
    }
  }
  return found;
}

/** Every highlight name mentioned in text, including shorter names inside a longer title (e.g. Mather Point in a Rim Trail walk). For scheduling uniqueness only — do not use this to hole-punch titles. */
export function mentionedPlaceNames(text: string, names: string[]) {
  const t = (text || "").toLowerCase();
  return names.filter(n => n && n.length >= 3 && t.includes(n.toLowerCase()));
}

export function placesUsedInDays(days: ItinDay[], hl: { name: string }[], placeName?: string) {
  const names = itineraryPlaceNames(hl);
  const used = new Set<string>();
  for (const d of days) {
    for (const n of mentionedPlaceNames(`${d.morning} ${d.afternoon} ${d.evening} ${d.rainyBackup || ""}`, names)) {
      if (placeName && n.toLowerCase() === placeName.toLowerCase()) continue;
      used.add(n);
    }
  }
  return used;
}

const SLOTS = ["morning", "afternoon", "evening", "rainyBackup"] as const;
type Slot = typeof SLOTS[number];

function isSkiMorningSlot(text: string) {
  return /^⛷/.test(text || "") && /ski/i.test(text || "");
}

function mentionKind(text: string, name: string): "then" | "rest" | "backup" | "ski" | "activity" | "plain" {
  if (isSkiMorningSlot(text) && isSkiSector({ name })) return "ski";
  if (new RegExp(`;\\s*then\\s+${escapeRe(name)}`, "i").test(text)) return "then";
  if (new RegExp(`;\\s*or a rest day:\\s*${escapeRe(name)}`, "i").test(text)) return "rest";
  const weight = { then: 1, rest: 2, backup: 3, plain: 5, activity: 10, ski: 15 } as const;
  void weight;
  return "plain";
}

function mentionScore(text: string, name: string, slot: Slot, hl?: Highlight) {
  if (slot === "rainyBackup") return 3;
  if (isSkiMorningSlot(text) && isSkiSector({ name })) return 15;
  if (new RegExp(`;\\s*then\\s+${escapeRe(name)}`, "i").test(text)) return 1;
  if (new RegExp(`;\\s*or a rest day:\\s*${escapeRe(name)}`, "i").test(text)) return 2;
  const act = (hl as any)?.activity as string | undefined;
  const emoji = /[🏖🖼🍷🍸🥾🚶🍽🤿🏄⛷🏙]/.test(text);
  if (emoji && act) {
    if (act === "nightlife" && slot === "evening") return 12;
    if ((act === "tasting" || act === "beach" || act === "surf") && slot === "afternoon") return 12;
    if ((act === "hiking" || act === "museums" || act === "dive") && slot === "morning") return 12;
    return 10;
  }
  if (emoji) return 8;
  return 5;
}

function swapNamedPlace(text: string, name: string, replacement: string | undefined, slot: Slot) {
  if (replacement) {
    if (new RegExp(`;\\s*then\\s+${escapeRe(name)}`, "i").test(text)) {
      return text.replace(new RegExp(`(;\\s*then\\s+)${escapeRe(name)}`, "ig"), `$1${replacement}`);
    }
    if (new RegExp(`;\\s*or a rest day:\\s*${escapeRe(name)}`, "i").test(text)) {
      return text.replace(new RegExp(`(;\\s*or a rest day:\\s*)${escapeRe(name)}`, "ig"), `$1${replacement}`);
    }
    return text.replace(new RegExp(escapeRe(name), "ig"), replacement);
  }
  const thenRe = new RegExp(`(;\\s*then\\s+)${escapeRe(name)}`, "ig");
  if (thenRe.test(text)) return text.replace(thenRe, "").replace(/\s{2,}/g, " ").replace(/[;\s]+$/, "").trim();
  const restRe = new RegExp(`;\\s*or a rest day:\\s*${escapeRe(name)}.*$`, "i");
  if (restRe.test(text)) return text.replace(restRe, "").trim();
  if (slot === "rainyBackup") return "";
  return text;
}

function slotFallback(slot: Slot) {
  if (slot === "morning") return "Free morning — wander a new neighbourhood";
  if (slot === "afternoon") return "Explore a market or local street";
  return "";
}

function isStandalonePlaceSlot(text: string, name: string) {
  const t = (text || "").trim();
  if (!t || !name) return false;
  if (new RegExp(`^[^A-Za-z0-9"]*${escapeRe(name)}\s*$`, "i").test(t)) return true;
  if (new RegExp(`;\s*then\s+${escapeRe(name)}\s*$`, "i").test(t)) return true;
  if (new RegExp(`;\s*or a rest day:\s*${escapeRe(name)}`, "i").test(t)) return true;
  if (new RegExp(`^(?:If it rains:|Rain likely — try |Mixed rain and snow — waterproof layers; indoor option: )${escapeRe(name)}$`, "i").test(t)) return true;
  return false;
}

/** Remove a place from a slot, using a generic fallback when the slot was just that name. */
export function clearPlaceFromSlot(text: string, name: string, slot: "morning" | "afternoon" | "evening" | "rainyBackup") {
  if (!text) return text;
  // Never punch a hole in a longer title such as "Sunset at Mather Point" or
  // "Walk the Rim Trail between Mather Point and Yavapai Point".
  if (!isStandalonePlaceSlot(text, name)) return text;
  const swapped = swapNamedPlace(text, name, undefined, slot);
  if (!namesInText(swapped, [name]).length) {
    if (slot === "rainyBackup" && /^If it rains:\s*$/i.test(swapped)) return "If it rains: café, museum or covered market";
    return swapped;
  }
  const stripped = swapped
    .replace(new RegExp(escapeRe(name), "ig"), "")
    .replace(/[🏖🖼🍷🍸🥾🚶🍽🤿🏄🏙]/g, "")
    .replace(/^[;·,\s]+|[;·,\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!stripped || stripped.length < 4) return slotFallback(slot);
  return stripped;
}

/**
 * After an activity slot claims a named venue, drop weaker mentions of it
 * (other days, rain backups, hike follow-ups, or the same day's leftover highlight).
 * Ski-sector mornings are left alone so rotation can repeat.
 */
export function releasePlaceFromOtherSlots(days: ItinDay[], name: string, keep?: { day?: ItinDay; slot?: string }) {
  if (!name) return;
  for (const d of days) {
    for (const slot of SLOTS) {
      if (keep?.day === d && keep.slot === slot) continue;
      const text = (d[slot] || "") as string;
      if (!text || !namesInText(text, [name]).length) continue;
      if (isSkiMorningSlot(text) && isSkiSector({ name })) continue;
      (d as any)[slot] = clearPlaceFromSlot(text, name, slot);
    }
  }
}

/**
 * A named highlight should not appear on more than one day (including hike
 * follow-ups, rest-day options and rain backups). Repeats are kept only for
 * the user's base area, ski-sector rotation, or when nothing else is left.
 * When a name collides, the more specific activity slot wins; secondary
 * mentions are rewritten or dropped (never replaced with a random venue of
 * a different kind).
 */
export function dedupeItineraryPlaces(days: ItinDay[], hl: Highlight[], placeName?: string) {
  const names = itineraryPlaceNames(hl);
  const byName = new Map(hl.map(h => [h.name.toLowerCase(), h]));
  type Hit = { day: ItinDay; slot: Slot; name: string; score: number; i: number };
  const hits: Hit[] = [];
  days.forEach((day, i) => {
    for (const slot of SLOTS) {
      const text = (day[slot] || "") as string;
      if (!text) continue;
      for (const n of namesInText(text, names)) {
        if (placeName && n.toLowerCase() === placeName.toLowerCase()) continue;
        hits.push({ day, slot, name: n, score: mentionScore(text, n, slot, byName.get(n.toLowerCase())), i });
      }
    }
  });
  const keep = new Set<Hit>();
  const drop = new Set<Hit>();
  const groups = new Map<string, Hit[]>();
  for (const h of hits) {
    const k = h.name.toLowerCase();
    const g = groups.get(k) || [];
    g.push(h);
    groups.set(k, g);
  }
  const used = new Set<string>();
  for (const [key, g] of groups) {
    g.sort((a, b) => b.score - a.score || a.i - b.i);
    const winner = g[0];
    keep.add(winner);
    used.add(key);
    for (const h of g.slice(1)) {
      const skiKeep = mentionScore((h.day[h.slot] || "") as string, h.name, h.slot) >= 15;
      if (skiKeep) keep.add(h);
      else drop.add(h);
    }
  }
  for (const h of drop) {
    const text = (h.day[h.slot] || "") as string;
    const kind = mentionKind(text, h.name);
    const canSwap = kind === "then" || kind === "rest" || h.slot === "rainyBackup";
    const indoorBackupOk = (x: Highlight) => {
      if (x.setting === "outdoor" || x.indoor === false) return false;
      const blob = `${x.name || ""} ${x.type || ""} ${x.description || ""}`;
      if (/\b(palace|castle|bridge|abbey|cathedral|square|tower of london|buckingham)\b/i.test(x.name || "")) return false;
      if (/wildlife from a distance|stargazing|phantom ranch|hike-?in|day hike|rim trail|easy walk/i.test(blob)) return false;
      return !!(x.indoor || x.setting === "indoor" || /visitor (?:centre|center)|museum|gallery|library|studio|junior ranger|hopi house/i.test(blob));
    };
    const alt = canSwap ? hl.find(x => x.name && !used.has(x.name.toLowerCase()) && !(placeName && x.name.toLowerCase() === placeName.toLowerCase()) && !isAdminOrReligiousOrg(x) && !isSeriousPeak(x) && !isSkiSector(x) && (h.slot !== "rainyBackup" || indoorBackupOk(x))) : undefined;
    const next = alt ? swapNamedPlace(text, h.name, alt.name, h.slot) : clearPlaceFromSlot(text, h.name, h.slot);
    (h.day as any)[h.slot] = next;
    if (alt) used.add(alt.name.toLowerCase());
  }
}

