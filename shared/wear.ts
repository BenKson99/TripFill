/** Plain "what to wear" line from a day's temperatures (°C) and wetness. No medical or formal dress advice. */
export function whatToWear(d: { tmax?: number | null; tmin?: number | null; precipProb?: number | null; snowCm?: number | null; summary?: string } = {}): string {
  const hi = Number.isFinite(d.tmax) ? d.tmax as number : undefined;
  const lo = Number.isFinite(d.tmin) ? d.tmin as number : undefined;
  const wet = (d.precipProb ?? 0) >= 40 || /rain|shower|storm|drizzle/i.test(d.summary || "");
  const snow = (d.snowCm ?? 0) > 0 || /snow|sleet/i.test(d.summary || "");
  if (hi == null && lo == null) return "Dress in layers and check the temperature on the day.";
  if (snow || (hi != null && hi <= 2) || (lo != null && lo <= -2)) {
    return wet ? "Warm coat, hat and gloves, and waterproof shoes" : "Warm coat, hat and gloves";
  }
  if (hi != null && hi <= 10) {
    return wet ? "Warm jumper, coat and waterproof shoes" : "Warm jumper and a coat";
  }
  if (hi != null && hi >= 26 && (lo == null || lo >= 18)) {
    return wet ? "Shorts & t-shirt, and a light rain jacket" : "Shorts & t-shirt";
  }
  // Mild stretch (about 58–73°F / 14–23°C), e.g. a London July: hoodie, not shorts.
  if (hi != null && hi >= 14 && hi < 24 && (lo == null || lo <= 16)) {
    return "T-shirt plus a hoodie; pack a rain jacket";
  }
  if (hi != null && hi >= 20) {
    const night = lo != null && lo < 16 ? ", light jacket at night" : "";
    return wet ? `T-shirt and a light rain jacket${night}` : `Shorts & t-shirt${night}`;
  }
  if (hi != null && hi >= 15) {
    const night = lo != null && lo < 12 ? ", a warmer layer at night" : ", light jacket at night";
    return wet ? `Trousers and a light rain jacket${lo != null && lo < 12 ? ", a warmer layer at night" : ""}` : `T-shirt and a light jumper${night}`;
  }
  return wet ? "Long sleeves, a coat and waterproof shoes" : "Long sleeves and a jacket";
}
