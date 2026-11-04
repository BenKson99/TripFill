import { getJSON } from "./fetchy.js";

export interface Food { name: string; localName?: string; gloss: string; description: string; source: string; url?: string }
const WP = "https://en.wikipedia.org/w/api.php";
const FOODY = /\b(dish|food|soup|pastry|pastries|sausage|dessert|cake|bread|cheese|noodle|sauce|snack|stew|confection|sweet|tart|dumpling|rice|porridge|pancake|salad|skewer|sandwich|cookie|biscuit|pie|custard|pudding|curry|meat|fish|seafood|beverage|drink|liqueur|spirit|wine|beer|tea|coffee|condiment|seasoning|pickle|omelette|egg|chicken|pork|beef|tofu|sushi|candy|delicacy|specialt)/i;
// Generic ingredients / non-dish concepts we never want to list as "food to try"
const GENERIC = /^(organic|biológico|chicken|frango|galinha|rice|white rice|tea|coffee|soup|bread|meat|fish|seafood|pork|beef|wine|beer|water|milk|cheese|salt|sugar|soy sauce|soybean|pickles?|noodles?|noodle bars?|vegetables?|fruit|spices?|vinegar|olive oil|butter|egg|eggs|chopsticks|cuisine|breakfast|lunch|dinner)$/i;
const NOT_DISH = /cuisine of|cuisine$|list of|culture|etiquette|restaurant|chef|cookbook|cookware|utensil|kitchen|company|brand|chain|grape|cultivar|cattle|breed|moth|variety of|plant|species|genus|ingredient|technique|method|cooking|festival|market|region|city|country|person|people|film|magazine|tableware|style of|term|beverage company|museum|class of|type of restaurant|ware\b|\b1[0-9]{3}\s*[–-]\s*(1[0-9]{3}|20[0-9]{2})\b|politician|official|writer|viticulturist|explorer|businessm[ae]n|businesswoman|statesman|missionary/i;

async function q(params: Record<string, string>) {
  const u = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  return getJSON<any>(`${WP}?${u}`);
}
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Same-country legs of a multi-city trip share one lookup (consistent picks, fewer Wikipedia calls);
// a failed or thin lookup is retried once and not cached.
const foodCache = new Map<string, Promise<Food[]>>();
export function getFood(country: string, lang: string, wvTerms: string[]): Promise<Food[]> {
  const key = `${country}|${lang}`;
  const hit = foodCache.get(key); if (hit) return hit;
  const p = getFood1(country, lang, wvTerms).then(r => r.length >= 5 ? r : getFood1(country, lang, wvTerms), () => getFood1(country, lang, wvTerms));
  foodCache.set(key, p);
  p.then(r => { if (r.length < 5) foodCache.delete(key); }, () => foodCache.delete(key));
  if (foodCache.size > 200) foodCache.delete(foodCache.keys().next().value!);
  return p;
}
async function getFood1(country: string, lang: string, wvTerms: string[]): Promise<Food[]> {
  // 1. Find the "<X> cuisine" article for this country
  const sr = await q({ action: "query", list: "search", srsearch: `${country} cuisine intitle:cuisine`, srlimit: "3" });
  const hits: string[] = (sr.query?.search || []).map((x: any) => x.title as string).filter((t: string) => /cuisine$/i.test(t) && !/^list/i.test(t));
  // Prefer the article that names this country ("South African cuisine" over the broader "African cuisine")
  const art = hits.find(t => norm(t).includes(norm(country))) || hits[0];
  // 2. Candidate dishes = pages linked from the cuisine article, plus Wikivoyage terms that have a Wikipedia article
  const titles = new Set<string>();
  if (art) {
    let cont: any = {};
    for (let i = 0; i < 3; i++) {
      const d = await q({ action: "query", titles: art, prop: "links", plnamespace: "0", pllimit: "500", ...cont });
      for (const l of d.query?.pages?.[0]?.links || []) titles.add(l.title);
      if (!d.continue) break; cont = d.continue;
    }
  }
  const wvSet = new Set(wvTerms.map(norm));
  for (const t of wvTerms) titles.add(t.charAt(0).toUpperCase() + t.slice(1));
  // 3. Short descriptions (Wikidata) → keep things that are clearly a named dish/drink
  const all = [...titles].filter(t => !GENERIC.test(t) && !/cuisine|^list of/i.test(t));
  const info = new Map<string, { title: string; desc: string; from: string }>();
  for (let i = 0; i < all.length; i += 50) {
    const d = await q({ action: "query", titles: all.slice(i, i + 50).join("|"), prop: "description|pageprops", ppprop: "disambiguation", redirects: "1" }).catch(() => null);
    const redir = new Map<string, string>((d?.query?.redirects || []).map((r: any) => [r.to, r.from]));
    for (const pg of d?.query?.pages || []) {
      if (pg.missing || pg.pageprops?.disambiguation !== undefined || !pg.description) continue;
      info.set(pg.title, { title: pg.title, desc: pg.description, from: redir.get(pg.title) || pg.title });
    }
  }
  // debug
  if (process.env.FOOD_DEBUG) console.log("titles", all.length, "info", info.size, info.get("Ramen"), info.get("Soba"));
  let cands = [...info.values()].filter(c => FOODY.test(c.desc) && !NOT_DISH.test(c.desc) && !GENERIC.test(c.title) && !GENERIC.test(c.from) && !/^(cuisine|food)/i.test(c.desc)
    // generic ingredient descriptions ("domesticated bird", "beverage made from…") are excluded by requiring a dish-ish word that is not just the ingredient itself
    && !/^(edible|domesticated|species|plant|beverage$|drink$)/i.test(c.desc));
  // prefer things whose description ties them to this country or is clearly a prepared dish
  // 4. Rank by Wikipedia pageviews, boosting items the Wikivoyage guide mentions
  const pv = new Map<string, number>();
  for (let i = 0; i < cands.length; i += 50) {
    let cont: any = {};
    for (let k = 0; k < 10; k++) {
      const d = await q({ action: "query", titles: cands.slice(i, i + 50).map(c => c.title).join("|"), prop: "pageviews", pvipdays: "30", ...cont }).catch(() => null);
      for (const pg of d?.query?.pages || []) if (pg.pageviews) pv.set(pg.title, Object.values(pg.pageviews).reduce((s: number, x: any) => s + (x || 0), 0) as number);
      if (!d?.continue) break; cont = d.continue;
    }
  }
  const demonymish = norm(art || country).split(" ")[0];
  const score = (c: { title: string; desc: string; from: string }) => Math.log10((pv.get(c.title) || 0) + 10) + (wvSet.has(norm(c.from)) || wvSet.has(norm(c.title)) ? 1.5 : 0) + (norm(c.desc).includes(demonymish) || norm(c.desc).includes(norm(country)) ? 1 : -1.5) + (/dish|pastry|dessert|soup|stew|sausage|noodle|dumpling|tart|cake|snack|sweet|confection|skewer|sushi|curry/i.test(c.desc) ? 0.5 : 0);
  cands.sort((a, b) => score(b) - score(a));
  const top = cands.slice(0, 8);
  // 5. Local-language name + a 1-sentence intro
  const [ll, ex] = await Promise.all([
    lang !== "en" ? q({ action: "query", titles: top.map(t => t.title).join("|"), prop: "langlinks", lllang: lang, lllimit: "50" }).catch(() => null) : null,
    q({ action: "query", titles: top.map(t => t.title).join("|"), prop: "extracts", exintro: "1", explaintext: "1", exsentences: "1", exlimit: "20" }).catch(() => null),
  ]);
  const local = new Map<string, string>(); for (const pg of ll?.query?.pages || []) if (pg.langlinks?.[0]) local.set(pg.title, pg.langlinks[0].title.replace(/\s*[（(][^)）]*[)）]\s*$/, ""));
  const intro = new Map<string, string>(); for (const pg of ex?.query?.pages || []) intro.set(pg.title, (pg.extract || "").replace(/\s*\([^()]*(\([^()]*\)[^()]*)*\)/g, "").replace(/\s+([,.])/g, "$1"));
  return top.map(c => {
    const loc = local.get(c.title);
    return { name: c.title.replace(/\s*\((?:food|dish|drink|beverage|dessert|biscuit|cake|cookie|bread|sauce|soup|confectionery|sandwich|pastry)\)$/i, ""), localName: loc && norm(loc) !== norm(c.title) ? loc : undefined, gloss: c.desc.charAt(0).toUpperCase() + c.desc.slice(1), description: (intro.get(c.title) || "").slice(0, 220), source: wvSet.has(norm(c.from)) || wvSet.has(norm(c.title)) ? "Wikivoyage + Wikipedia" : `Wikipedia (${art})`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}` };
  });
}
