import { getJSON } from "./fetchy.js";
import type { Place } from "./weather.js";
import { getFood, type Food } from "./food.js";
import { countryInfo } from "./countries.js";

export interface Highlight { name: string; dayTrip?: boolean; distanceKm?: number; ski?: boolean; description: string; indoor: boolean; setting?: "indoor" | "outdoor" | "mixed"; type?: string; views30d?: number; source: string; url?: string; lat?: number; lon?: number }

const WV = "https://en.wikivoyage.org/w/api.php";
async function wikitext(title: string): Promise<{ title: string; text: string } | null> {
  try {
    const d = await getJSON<any>(`${WV}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&redirects=1&format=json&formatversion=2`);
    if (!d.parse) return null;
    return { title: d.parse.title, text: d.parse.wikitext };
  } catch { return null; }
}

function clean(s: string): string {
  return s
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "").replace(/<[^>]+>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, "$1").replace(/\[https?:\/\/\S+\]/g, "")
    .replace(/'''?/g, "").replace(/\s+/g, " ").trim();
}
function firstSentences(s: string, max = 220): string {
  const c = clean(s); if (c.length <= max) return c;
  const cut = c.slice(0, max); const i = cut.lastIndexOf(". ");
  return (i > 60 ? cut.slice(0, i + 1) : cut + "…");
}
function section(text: string, name: string): string {
  const re = new RegExp(`^==\\s*${name}\\s*==\\s*$`, "mi");
  const m = re.exec(text); if (!m) return "";
  const rest = text.slice(m.index + m[0].length);
  const n = /^==[^=].*==\s*$/m.exec(rest);
  return n ? rest.slice(0, n.index) : rest;
}
// Parse {{see|name=..|content=..}} style listings, handling nested templates.
function listings(text: string, kinds: string[]): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const re = new RegExp(`\\{\\{\\s*(${kinds.join("|")})\\s*\\|`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 0, i = m.index;
    for (; i < text.length - 1; i++) {
      if (text[i] === "{" && text[i + 1] === "{") { depth++; i++; }
      else if (text[i] === "}" && text[i + 1] === "}") { depth--; i++; if (depth === 0) break; }
    }
    const body = text.slice(m.index + 2, i - 1);
    const fields: Record<string, string> = {};
    // split on top-level pipes
    let d = 0, cur = "", parts: string[] = [];
    for (let k = 0; k < body.length; k++) {
      const c = body[k];
      if ((c === "{" || c === "[") ) d++; else if (c === "}" || c === "]") d--;
      if (c === "|" && d === 0) { parts.push(cur); cur = ""; } else cur += c;
    }
    parts.push(cur);
    for (const p of parts.slice(1)) { const e = p.indexOf("="); if (e > 0) fields[p.slice(0, e).trim().toLowerCase()] = p.slice(e + 1).trim(); }
    fields._kind = m[1].toLowerCase();
    out.push(fields);
  }
  return out;
}
const INDOOR = /museum|gallery|palace|church|cathedral|basilica|monastery|aquarium|theat|cinema|market hall|library|mall|temple hall|indoor|exhibit|oceanarium|hall\b|tower|shrine museum|castle interior/i;
const isIndoor = (s: string) => INDOOR.test(s);

const FOOD_STOP = /vegetarian|vegan|tipping|chopstick|etiquette|breakfast|lunch|dinner|restaurant|caf[eé]s?$|supermarket|convenience|vending|directory|tabelog|guide|app\b|budget|splurge|mid-range|halal|kosher|allerg|warning|note/i;
function boldTerms(sec: string): Food[] {
  const out: Food[] = [] as any; const seen = new Set<string>();
  for (const line of sec.split("\n")) {
    const re = /'''([^']{3,40})'''(?:\s*\(([^)]{0,60})\))?/g; let m;
    while ((m = re.exec(line))) {
      const name = clean(m[1]); const key = name.toLowerCase();
      if (seen.has(key) || /\d|http|open|price|€|\$/i.test(name) || FOOD_STOP.test(name)) continue;
      seen.add(key);
      const after = clean(line.slice(m.index + m[0].length)).replace(/^[,\s–—-]+/, "");
      const desc = (m[2] ? clean(m[2]) + ". " : "") + after;
      out.push({ name, gloss: "", description: firstSentences(desc || "Local speciality mentioned by Wikivoyage.", 160), source: "Wikivoyage" });
    }
  }
  return out;
}


async function nearbyQids(p: Place): Promise<string[]> {
  const d = await getJSON<any>(`https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${p.lat}|${p.lon}&ggsradius=10000&ggslimit=300&prop=pageprops&ppprop=wikibase_item&format=json&formatversion=2`);
  return (d.query?.pages || []).map((pg: any) => pg.pageprops?.wikibase_item).filter(Boolean);
}
// Wider-radius search (CirrusSearch nearcoord) for day trips and activity-specific places like ski fields
async function searchQids(p: Place, query: string, km: number, limit = 25): Promise<string[]> {
  const d = await getJSON<any>(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`${query} nearcoord:${km}km,${p.lat},${p.lon}`)}&gsrlimit=${limit}&prop=pageprops&ppprop=wikibase_item&format=json&formatversion=2`).catch(() => null);
  return (d?.query?.pages || []).sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0)).map((pg: any) => pg.pageprops?.wikibase_item).filter(Boolean);
}
// Places people live in, not things to visit
const SETTLEMENT_C = /suburb|locality|town\b|village|hamlet|populated place|settlement|census|urban area|city\b|municipality|county|district|statistical area|unincorporated|barrio|neighbo|ward|census tract/i;
const SETTLEMENT_D = /^(suburb|locality|town|village|hamlet|small town|neighbourhood|neighborhood|residential|census|populated|city|municipality|district|area)\b|\b(suburb|locality|census-designated|populated place)\b/i;
const SKI_C = /ski (resort|area|field)|skiing area|ski station|winter sports resort/i;
const SIGHT = /museum|palace|castle|cathedral|church|temple|shrine|park|garden|monument|tower|square|plaza|market|monastery|basilica|gallery|fort|viewpoint|aquarium|zoo|landmark|tourist|historic|memorial|bridge|statue|neighbo|quarter|district|street|avenue|abbey|mosque|synagogue|ruins|beach|lake|observ|theatre|opera|stadium|arch|gate|fountain|sanctuary|pagoda|cemetery/i;
const NOT_SIGHT = /railway station|metro station|subway station|school|university|hospital|company|business|bank|ministry|embassy|hotel|office|stock exchange|university|college|diocese|archdiocese|stadium|sports venue|skyscraper|office building|human settlement|parish|ward of|municipality|civil parish|administrative|electoral|road\b|highway|line\b|airport|organization|enterprise|newspaper|television|football club|family name|given name|disambiguation/i;

export type Setting = "indoor" | "outdoor" | "mixed";
// Classes (Wikidata instance-of labels) that are not visitor attractions
const BAD_CLASS = /stock exchange|skyscraper|office building|office|headquarters|bank|ministry|government|embassy|consulate|company|business|enterprise|corporation|university|college|school|hospital|hotel|railway station|metro station|train station|station|stadium|sports venue|arena|diocese|archdiocese|courthouse|prison|police|parliament building|legislative|city hall|residential|apartment|shopping|department store|organization|broadcaster|research|military|port|airport|interchange|road|street|highway|line|human settlement|administrative|ward|district of|neighborhood|quarter|commercial building|high-rise|tower block|destroyed|demolished|former|trade fair|convention center/i;
const NAME_BAD = /stock exchange|headquarters|\bHQ\b|ministry|embassy|bank\b|office|university|station|stadium|hotel/i;
const INDOOR_C = /museum|gallery|theatre|theater|opera house|concert hall|aquarium|oceanarium|library|cinema|planetarium|exhibition|church|cathedral|basilica|chapel|mosque|synagogue|indoor|market hall|arcade/i;
const MIXED_C = /winery|vineyard|wine estate|palace|castle|monastery|abbey|temple|shrine|fortress|fort\b|citadel|zoo|botanical garden|tower|observation|complex|market|historic site|world heritage|ruins|mausoleum|imperial|royal residence|lift|elevator/i;
const OUTDOOR_C = /park|garden|square|plaza|bridge|monument|statue|memorial|viewpoint|street|avenue|beach|lake|river|mountain|hill|fountain|gate|arch|cemetery|neighbo|promenade|pier|waterfront|landmark/i;
function setting(text: string): Setting {
  if (MIXED_C.test(text)) return "mixed";
  if (INDOOR_C.test(text)) return "indoor";
  if (OUTDOOR_C.test(text)) return "outdoor";
  return "mixed";
}
async function pageviews(titles: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < titles.length; i += 50) {
    let cont = "";
    for (let k = 0; k < 10; k++) {
      const d = await getJSON<any>(`https://en.wikipedia.org/w/api.php?action=query&prop=pageviews&pvipdays=30&redirects=1&titles=${titles.slice(i, i + 50).map(encodeURIComponent).join("|")}&format=json&formatversion=2${cont}`).catch(() => null);
      const redir = new Map<string, string>((d?.query?.redirects || []).map((r: any) => [r.to, r.from]));
      for (const pg of d?.query?.pages || []) if (pg.pageviews) { const v = Object.values(pg.pageviews).reduce((s: number, x: any) => s + (x || 0), 0) as number; out.set(pg.title, v); if (redir.has(pg.title)) out.set(redir.get(pg.title)!, v); }
      if (!d?.continue) break; cont = "&" + new URLSearchParams(d.continue).toString();
    }
  }
  return out;
}

async function wikidataRank(qids: string[], curated: Set<string>, p: Place, wide: Set<string> = new Set(), ski: Set<string> = new Set(), want = 14): Promise<Highlight[]> {
  const uniq = [...new Set(qids)];
  const ents: any[] = [];
  for (let i = 0; i < uniq.length; i += 50) {
    const d = await getJSON<any>(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${uniq.slice(i, i + 50).join("|")}&props=sitelinks|descriptions|labels|claims&languages=en&format=json`, 25000).catch(() => null);
    if (d?.entities) ents.push(...Object.values(d.entities));
  }
  // Resolve instance-of (P31) class labels
  const p31 = (e: any): string[] => (e.claims?.P31 || []).map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  const classIds = [...new Set(ents.flatMap(p31))];
  const classLabel = new Map<string, string>();
  for (let i = 0; i < classIds.length; i += 50) {
    const d = await getJSON<any>(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${classIds.slice(i, i + 50).join("|")}&props=labels&languages=en&format=json`).catch(() => null);
    for (const [k, v] of Object.entries<any>(d?.entities || {})) classLabel.set(k, v.labels?.en?.value || "");
  }
  let rows = ents.filter(e => e.labels?.en && e.sitelinks?.enwiki).map(e => {
    const classes = p31(e).map(c => classLabel.get(c) || "").filter(Boolean);
    const desc = e.descriptions?.en?.value || "";
    const coord = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    return { id: e.id, name: e.labels.en.value as string, desc, classes, title: e.sitelinks.enwiki.title as string, sl: Object.keys(e.sitelinks).length, lat: coord?.latitude, lon: coord?.longitude };
  });
  const isSight = (r: typeof rows[number]) => {
    const cls = r.classes.join("; ");
    const goodClass = INDOOR_C.test(cls) || MIXED_C.test(cls) || OUTDOOR_C.test(cls) || /tourist attraction|heritage|landmark|monument/i.test(cls);
    const badClass = r.classes.length > 0 && r.classes.every(c => BAD_CLASS.test(c) && !/tourist attraction|heritage|museum|palace|castle|temple|shrine|park|garden|square|tower|market/i.test(c));
    if (r.classes.some(c => /border (checkpoint|crossing)|customs/i.test(c))) return false;
    if (badClass || NAME_BAD.test(r.name) || /stock exchange|skyscraper|office|headquarters|company|bank\b|ministry|embassy/i.test(r.desc)) return false;
    const settlement = r.classes.length > 0 && r.classes.every(c => SETTLEMENT_C.test(c)) || SETTLEMENT_D.test(r.desc);
    if (settlement && !(curated.has(r.id) && /barrio|quarter|neighbo/i.test(r.classes.join(" ") + r.desc))) return false;
    if (SKI_C.test(r.classes.join("; ")) || /ski (area|resort|field)/i.test(r.desc)) return ski.size > 0;
    return goodClass || curated.has(r.id) || (SIGHT.test(r.desc) && !NOT_SIGHT.test(r.desc));
  };
  rows = rows.filter(isSight);
  rows.sort((a, b) => b.sl - a.sl);
  const km = (r: typeof rows[number]) => r.lat != null ? haversine(p, { lat: r.lat, lon: r.lon }) : 0;
  rows = rows.filter(r => km(r) <= 120); // beyond ~2 h each way is not a day trip (and river/region centroids can be far off)
  const pool = rows.slice(0, 50);
  const pv = await pageviews(pool.map(r => r.title));
  // Popularity: log pageviews + log sitelinks, small boost for guide-curated sights
  const score = (r: typeof rows[number]) => Math.log10((pv.get(r.title) || 0) + 10) * 2 + Math.log10(r.sl + 1) + (curated.has(r.id) ? 1 : 0) - (wide.has(r.id) && km(r) > 15 ? 1.5 : 0);
  const skiOrder = [...ski];
  // Ski fields: classed as ski resorts, or a top search hit for "ski area" that is a mountain/range (Coronet Peak, The Remarkables)
  const NOT_ALPINE = /cross-country|nordic|terrain park|snow ?park|snow ?farm|heli-?ski|snowfields?\b|tubing|hillclimb|road\b/i;
  const isSki = (r: typeof rows[number]) => ski.has(r.id) && !NOT_ALPINE.test(r.name + " " + r.desc + " " + r.classes.join(" ")) && (SKI_C.test(r.classes.join("; ")) || /ski/i.test(r.desc) || (skiOrder.indexOf(r.id) < 5 && /mountain|range|peak|snowfield/i.test(r.classes.join("; ") + r.desc)));
  pool.sort((a, b) => score(b) - score(a));
  // Ski areas first when skiing, then the rest; max 4 day trips so the city still leads
  const skis = rows.filter(isSki).sort((a, b) => (score(b) - skiOrder.indexOf(b.id) * 0.4) - (score(a) - skiOrder.indexOf(a.id) * 0.4)).slice(0, 4);
  let trips = 0;
  const rest = pool.filter(r => !skis.includes(r) && !isSki(r)).filter(r => !(km(r) > 15) || trips++ < 4);
  const top = [...skis, ...rest].slice(0, want);
  const ex = await getJSON<any>(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exsentences=2&exlimit=20&redirects=1&titles=${top.map(t => encodeURIComponent(t.title)).join("|")}&format=json&formatversion=2`).catch(() => null);
  const byTitle = new Map<string, string>();
  for (const pg of ex?.query?.pages || []) byTitle.set(pg.title, pg.extract || "");
  for (const r of ex?.query?.redirects || []) byTitle.set(r.from, byTitle.get(r.to) || "");
  return top.map(t => {
    const raw = (byTitle.get(t.title) || t.desc).replace(/\s*\([^()]*(\([^()]*\)[^()]*)*\)/g, "").replace(/\s+([,.])/g, "$1");
    const st = setting(t.classes.join("; ") || t.desc + " " + t.name);
    return { name: t.name, description: firstSentences(raw, 240) || t.desc, setting: st, indoor: st === "indoor", type: t.classes.slice(0, 2).join(", "), views30d: pv.get(t.title) || 0, source: "Wikipedia/Wikidata", url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t.title.replace(/ /g, "_"))}`, lat: t.lat, lon: t.lon, ...(km(t) > 15 ? { dayTrip: true, distanceKm: Math.round(km(t)) } : {}), ...(isSki(t) ? { ski: true } : {}) };
  });
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, r = (x: number) => x * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function getPlaces(p: Place, opts: { ski?: boolean; want?: number } = {}): Promise<{ highlights: Highlight[]; food: Food[]; sources: string[]; guideUrl?: string }> {
  const sources: string[] = [];
  const page = await wikitext(p.name) ;
  let highlights: Highlight[] = []; let food: Food[] = []; let cityFood: Food[] = []; let guideUrl: string | undefined;
  const curated = new Set<string>(); const extra = new Set<string>();
  if (page && !/^#REDIRECT/i.test(page.text) && !/\{\{disamb/i.test(page.text)) {
    guideUrl = `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
    sources.push(guideUrl);
    const see = section(page.text, "See");
    // Curated sights: wikilinks with Wikidata anchors ([[Page#Q123|Name]]) and {{see|wikidata=Q..}} listings
    for (const m of see.matchAll(/#(Q\d+)\|/g)) curated.add(m[1]);
    for (const f of listings(page.text, ["see"])) if (f.wikidata && /^Q\d+$/.test(f.wikidata)) curated.add(f.wikidata);
    const prefix = "[[" + page.title + "/";
    const subs = [...new Set(page.text.split(prefix).slice(1).map(x => page.title + "/" + x.split(/[|\]#]/)[0]))].slice(0, 12);
    const subTexts = await Promise.all(subs.map(t => wikitext(t)));
    for (const st of subTexts) if (st) for (const f of listings(st.text, ["see"])) if (f.wikidata && /^Q\d+$/.test(f.wikidata)) extra.add(f.wikidata);
    const districts = new Set([...page.text.matchAll(/\[\[[^|\]#]+\/[^|\]#]+\|([^\]]+)\]\]/g)].map(m => clean(m[1]).toLowerCase()));
    cityFood = boldTerms(section(page.text, "Eat")).filter(f => !districts.has(f.name.toLowerCase()) && !/district|neighbo|bairro|street|rua |area/i.test(f.name));
  }
  try {
    const [near, wideL, skiL] = await Promise.all([nearbyQids(p), Promise.all([searchQids(p, "tourist attraction", 70, 30), searchQids(p, "museum OR park OR plaza OR church OR winery OR monument OR beach", 40, 30), searchQids(p, "national park OR mountain OR lake OR waterfall OR glacier OR vineyard", 120, 15)]).then(a => [...new Set(a.flat())]), opts.ski ? searchQids(p, "ski area", 80, 15) : Promise.resolve([] as string[])]);
    const want = opts.want || 14;
    const qids = [...curated, ...extra, ...near, ...wideL, ...skiL];
    highlights = await wikidataRank(qids, curated, p, new Set(wideL.filter(q => !near.includes(q))), new Set(skiL), want);
    sources.push("Wikidata + Wikipedia (nearby, ranked by notability)");
  } catch (e) { console.warn("highlights failed", e); }
  const merge = (list: Food[], src: string) => { const have = new Set(food.map(f => f.name.toLowerCase())); for (const f of list) if (!have.has(f.name.toLowerCase()) && !/^[A-Z]/.test(f.name)) { have.add(f.name.toLowerCase()); food.push({ ...f, source: src }); } };
  merge(cityFood, "Wikivoyage");
  const c = await wikitext(p.country);
  if (c) { sources.push(`https://en.wikivoyage.org/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}`); merge(boldTerms(section(c.text, "Eat")), `Wikivoyage (${c.title})`); }
  if (food.length < 8) try {
    const sr = await getJSON<any>(`${WV}?action=query&list=search&srsearch=${encodeURIComponent(p.country + " cuisine")}&srlimit=1&format=json`);
    const t = sr.query?.search?.[0]?.title as string | undefined;
    if (t && /cuisine$/i.test(t)) {
      const cz = await wikitext(t);
      if (cz && cz.text.slice(0, 3000).includes(p.country)) {
        sources.push(`https://en.wikivoyage.org/wiki/${encodeURIComponent(cz.title.replace(/ /g, "_"))}`);
        const body = cz.text.split(/^(?===[^=])/m).filter(sec => !/^==\s*(understand|history|background|see also|learn)/i.test(sec)).join("\n");
        merge(boldTerms(body), `Wikivoyage (${cz.title})`);
      }
    }
  } catch { /* optional */ }
  if (food.length < 5) food.push(...cityFood.filter(f => /^[A-Z]/.test(f.name)).map(f => ({ ...f, source: "Wikivoyage" })));
  try {
    const smart = await getFood(p.country, countryInfo(p.countryCode).lang, [...cityFood, ...food].map(f => f.name));
    if (smart.length >= 5) food = smart;
  } catch (e) { console.warn("food lookup failed, using Wikivoyage terms", e); }
  // Bold lowercase phrases in guides are usually tips/warnings ("raw shellfish"), not dish names
  const named = food.filter(f => /^\p{Lu}/u.test(f.name));
  food = named;
  // Prefer items with real descriptions
  highlights.sort((a, b) => Number(!!b.ski) - Number(!!a.ski) || Number(b.description.length > 40) - Number(a.description.length > 40));
  return { highlights: highlights.slice(0, Math.max(12, opts.want || 0)), food: food.slice(0, 8), sources, guideUrl };
}
