/** Plug types by ISO country code. Shared by packing and prep. */
export const PLUGS: Record<string, string> = {
  US: "A/B", CA: "A/B", MX: "A/B", JP: "A/B", BR: "C/N", AR: "C/I", CL: "C/L", CO: "A/B", PE: "A/B/C", UY: "C/F/I/L", CR: "A/B", DO: "A/B",
  GB: "G", IE: "G", MT: "G", CY: "G", HK: "G", SG: "G", MY: "G", AE: "G", QA: "G", SA: "G", KE: "G", NG: "D/G",
  FR: "C/E", BE: "C/E", PL: "C/E", CZ: "C/E", SK: "C/E", DE: "C/F", AT: "C/F", NL: "C/F", ES: "C/F", PT: "C/F", GR: "C/F", SE: "C/F", NO: "C/F", FI: "C/F",
  DK: "C/F/K", IS: "C/F", HU: "C/F", RO: "C/F", BG: "C/F", HR: "C/F", SI: "C/F", EE: "C/F", LV: "C/F", LT: "C/F", RU: "C/F", UA: "C/F", TR: "C/F", GE: "C/F",
  IT: "C/F/L", CH: "C/J", IL: "C/H", MA: "C/E", EG: "C/F", ZA: "C/D/M/N", IN: "C/D/M", CN: "A/C/I", TW: "A/B", KR: "C/F", TH: "A/B/C/O", VN: "A/C",
  ID: "C/F", PH: "A/B/C", AU: "I", NZ: "I", FJ: "I",
  PA: "A/B", GT: "A/B", HN: "A/B", NI: "A/B", SV: "A/B", BZ: "A/B", CU: "A/B/C", JM: "A/B", PR: "A/B", BS: "A/B", BB: "A/B", TT: "A/B",
  AW: "A/B/F", CW: "A/B", VI: "A/B", KY: "A/B", AG: "A/B", LC: "G", GD: "G",
};

export function plugType(cc?: string): string | undefined {
  if (!cc) return undefined;
  return PLUGS[cc.toUpperCase()];
}

export function plugsMatchHome(homeCC?: string, destCCs: (string | undefined)[] = []): boolean {
  const home = plugType(homeCC);
  const dest = destCCs.map(c => plugType(c)).filter(Boolean) as string[];
  return !!home && dest.length > 0 && dest.every(p => p === home);
}

export const SAME_PLUGS_LINE = "Same plugs as home — no adapter needed";
