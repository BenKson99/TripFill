/** US English for non-UK homes; keep UK wording only for UK (GB) homes. Applied to user-facing strings, not stored ids. */
export type EnVariant = "us" | "uk";

export function englishVariant(home?: { countryCode?: string; country?: string } | string | null): EnVariant {
  const code = typeof home === "string" ? home : home?.countryCode || "";
  return /^(GB|UK)$/i.test(code.trim()) ? "uk" : "us";
}

/** Longer / more specific phrases first so "Driving licence" is not half-replaced. */
const TO_US: [RegExp, string][] = [
  [/\bDriving licence\b/g, "Driver's license"],
  [/\bdriving licence\b/g, "driver's license"],
  [/\blicence\b/g, "license"],
  [/Diapers \/ nappies/g, "Diapers"],
  [/diapers \/ nappies/g, "diapers"],
  [/\bNappies\b/g, "Diapers"],
  [/\bnappies\b/g, "diapers"],
  [/\bJumpers\b/g, "Sweaters"],
  [/\bjumpers\b/g, "sweaters"],
  [/\bJumper\b/g, "Sweater"],
  [/\bjumper\b/g, "sweater"],
  [/\bNeighbourhoods\b/g, "Neighborhoods"],
  [/\bneighbourhoods\b/g, "neighborhoods"],
  [/\bNeighbourhood\b/g, "Neighborhood"],
  [/\bneighbourhood\b/g, "neighborhood"],
  [/\bNeighbours\b/g, "Neighbors"],
  [/\bneighbours\b/g, "neighbors"],
  [/\bNeighbour\b/g, "Neighbor"],
  [/\bneighbour\b/g, "neighbor"],
  [/\bTyres\b/g, "Tires"],
  [/\btyres\b/g, "tires"],
  [/\bTyre\b/g, "Tire"],
  [/\btyre\b/g, "tire"],
  [/\btravelling\b/g, "traveling"],
  [/\bTravelling\b/g, "Traveling"],
  [/\borganising\b/g, "organizing"],
  [/\bOrganising\b/g, "Organizing"],
];

export function localizeEn(text: string, variant: EnVariant = "us"): string {
  if (!text || variant === "uk") return text;
  let s = text;
  for (const [re, to] of TO_US) s = s.replace(re, to);
  return s;
}
