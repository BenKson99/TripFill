// "Before you leave" checklist — built on the client so older saved/shared plans get one too.
import { resolveTravelMode } from "../shared/travel.js";
import { dedupePrepAgainstTimeline } from "../shared/activityPrep.js";
const PLUGS: Record<string, string> = {
  US: "A/B", CA: "A/B", MX: "A/B", JP: "A/B", BR: "C/N", AR: "C/I", CL: "C/L", CO: "A/B", PE: "A/B/C", UY: "C/F/I/L", CR: "A/B", DO: "A/B",
  GB: "G", IE: "G", MT: "G", CY: "G", HK: "G", SG: "G", MY: "G", AE: "G", QA: "G", SA: "G", KE: "G", NG: "D/G",
  FR: "C/E", BE: "C/E", PL: "C/E", CZ: "C/E", SK: "C/E", DE: "C/F", AT: "C/F", NL: "C/F", ES: "C/F", PT: "C/F", GR: "C/F", SE: "C/F", NO: "C/F", FI: "C/F",
  DK: "C/F/K", IS: "C/F", HU: "C/F", RO: "C/F", BG: "C/F", HR: "C/F", SI: "C/F", EE: "C/F", LV: "C/F", LT: "C/F", RU: "C/F", UA: "C/F", TR: "C/F", GE: "C/F",
  IT: "C/F/L", CH: "C/J", IL: "C/H", MA: "C/E", EG: "C/F", ZA: "C/D/M/N", IN: "C/D/M", CN: "A/C/I", TW: "A/B", KR: "C/F", TH: "A/B/C/O", VN: "A/C",
  ID: "C/F", PH: "A/B/C", AU: "I", NZ: "I", FJ: "I",
};
export interface PrepItem { id: string; task: string; why?: string; done: boolean }
export function defaultPrep(plan: any): PrepItem[] {
  const ccs: string[] = [...new Set<string>((plan.legs?.length > 1 ? plan.legs.map((l: any) => l.place) : [plan.place]).map((p: any) => p?.countryCode).filter(Boolean))];
  const names: string[] = [...new Set<string>((plan.legs?.length > 1 ? plan.legs.map((l: any) => l.place) : [plan.place]).map((p: any) => p?.country).filter(Boolean))];
  const homeCC = plan.trip?.home?.countryCode;
  const intl = plan.trip?.domestic === false || (!!homeCC && ccs.some(c => c !== homeCC)) || (!homeCC && plan.trip?.domestic !== true);
  const out: [string, string?][] = [];
  if (intl) {
    out.push(["Check that everyone's passport is good for 6+ months after you come home (grown-up task)", "many countries require it"]);
    out.push([`Check visa and entry rules for ${names.join(", ") || "your destination"} (grown-up task)`, "official government travel site"]);
    out.push(["Buy travel insurance (medical + cancellation) (grown-up task)"]);
    out.push(["Tell your bank & card issuer you're travelling (grown-up task)", "so they don't freeze the card; check foreign-transaction fees"]);
    out.push(["Set up a phone roaming plan or eSIM (grown-up task)"]);
  } else {
    out.push(["Photo ID packed", "domestic trip"]);
    out.push(["Consider travel insurance (cancellation)"]);
  }
  const plugs = ccs.map(c => PLUGS[c] && `${c} type ${PLUGS[c]}`).filter(Boolean);
  const homePlug = homeCC && PLUGS[homeCC];
  if (plugs.length && !(homePlug && ccs.every(c => PLUGS[c] === homePlug))) {
    const gb = ccs.includes("GB") || ccs.includes("UK");
    const task = gb
      ? "UK plugs have 3 big prongs — bring a UK plug adapter (grown-up: check voltage)"
      : `Bring a plug adapter for ${names.join(", ") || "your destination"} (grown-up: check voltage)`;
    out.push([task, plugs.join(", ") + (homePlug ? `; home sockets are type ${homePlug}` : "")]);
  }
  out.push(["Chargers, power bank & cables packed"]);
  out.push([`Download offline maps for ${(plan.legs?.length > 1 ? plan.legs.map((l: any) => l.place.name) : [plan.place?.name]).join(", ")}`]);
  out.push(["Save tickets, bookings & insurance docs offline"]);
  out.push(["Share itinerary & emergency contacts with someone at home"]);
  if (resolveTravelMode(plan.input, plan.trip?.distanceKm) === "driving") {
    out.push(["Check the car: tyres, lights, fluids and papers", "also insurance and breakdown cover"]);
    out.push(["Plan the route, fuel or charging stops, parking and tolls"]);
    out.push(["Confirm parking at your stay and any city driving or toll rules"]);
  } else {
    out.push(["Do the online check-in and plan how you'll get to the airport (grown-up task)"]);
  }
  out.push(["Hold mail / packages or ask a neighbour (grown-up task)"]);
  out.push(["Arrange plant & pet care"]);
  out.push(["Empty the fridge, take out trash"]);
  out.push(["Set thermostat, unplug appliances, lock up"]);
  const base: PrepItem[] = out.map(([task, why], i) => ({ id: "prep" + i, task, why, done: false }));
  return dedupePrepAgainstTimeline(base, plan.timeline);
}

/** Add any missing mode-specific tasks; never delete or uncheck existing ones. */
export function mergePrepForMode(plan: any): PrepItem[] {
  const cur = [...(plan.prep || defaultPrep(plan))];
  const fresh = defaultPrep({ ...plan, prep: undefined });
  for (const t of fresh) if (!cur.some(x => x.task === t.task)) cur.push({ ...t, id: "prep-" + t.task.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) });
  return cur;
}
