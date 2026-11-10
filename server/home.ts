import { geocode, type Place } from "./weather.js";
import { homeLookupQuery } from "../shared/homeCity.js";

/** Resolve the Home city from typed text (same idea as destination), or reuse a matching already-resolved place.
 *  A typed name that cannot be found is an error — never silently dropped. */
export async function resolveHomeCity(inp: any, lookup: (q: string) => Promise<Place[]> = geocode): Promise<Place | undefined> {
  const typed = typeof inp?.homeCity === "string" ? inp.homeCity : "";
  const given = inp?.home && typeof inp.home === "object" && typeof inp.home.name === "string" ? inp.home as Place : undefined;
  if (!typed.trim()) return given; // empty optional field, or an older client that only sent `home`
  const look = homeLookupQuery(typed, given);
  if (look.reuse) return look.reuse as unknown as Place;
  const matches = await lookup(look.query!);
  if (!matches.length) throw Object.assign(new Error(`Couldn't find home city "${typed.trim()}"`), { status: 404 });
  return matches[0];
}
