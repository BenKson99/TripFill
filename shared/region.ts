/** Whole ranges, massifs and country-scale areas are not visitable sights or day-trip destinations. */
export function isBroadRegion(h: { name?: string; type?: string; description?: string; classes?: string | string[] }): boolean {
  const name = (h.name || "").trim();
  if (!name) return false;
  const type = [h.type, Array.isArray(h.classes) ? h.classes.join(", ") : h.classes].filter(Boolean).join(" ");
  const desc = h.description || "";
  const typeL = type.toLowerCase();
  const nameL = name.toLowerCase().replace(/^the\s+/, "");
  const placeLike = /\b(museum|gallery|hotel|pass|hut|peak|horn|restaurant|park|trail|village|town|church|chapel|railway|bahn|glacier|gondola|lift|spa|bridge|castle|zoo|garden|market|square|plaza|station|viewpoint|waterfall|lake|resort|arena)\b/i;
  if (/mountain range|massif|mountain chain|cordillera|mountain system|physiographic (region|province)|geographic region/.test(typeL) && !placeLike.test(name) && !placeLike.test(typeL.replace(/mountain range|massif|mountain chain|cordillera|mountain system|physiographic (region|province)|geographic region/g, ""))) return true;
  if (/^(mountain range|massif|mountain chain|cordillera|mountain system)\b/.test(typeL)) return !placeLike.test(name);
  if (/(^|,\s*)(country|sovereign state|republic|kingdom|constituent country)(,|$)/i.test(typeL) && !placeLike.test(name)) return true;
  if (/^(switzerland|france|italy|austria|germany|spain|portugal|united kingdom|great britain|england|europe|asia|africa)$/i.test(nameL)) return true;
  const rangeName = /^(the\s+)?((swiss|french|italian|austrian|bavarian|julian|dinaric|maritime|pennine|bernese|lepontine|rhaetian|graian|cottian|kamnik|dolomites?|tyrolean)\s+)?(alps|pyrenees|pyrenees mountains|rockies|rocky mountains|himalayas|himalaya|andes|carpathians|apennines|caucasus|urals|appalachians)$/i;
  if (rangeName.test(name)) return true;
  if (/\b(alps|pyrenees|rockies|rocky mountains|himalayas|andes|carpathians|apennines)\b/i.test(name) && !placeLike.test(name)) return true;
  if (/\b(mountain range|massif)\b/i.test(desc) && /^(the\s+)?[A-Z][\w' -]+$/.test(name) && !placeLike.test(name) && !placeLike.test(desc.slice(0, 80))) return /range|massif|chain of mountains|mountain system/i.test(desc.slice(0, 120));
  return false;
}
