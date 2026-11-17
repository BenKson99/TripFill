/** Country-aware health, money, language, beach and family-travel notes. Static, free data. */
import { plugType, plugsMatchHome, SAME_PLUGS_LINE } from "./plugs.js";
import { hasChildUnder, tripHasKids } from "./family.js";

/** Currency code and main language by country — kept here so shared stays client-safe. */
const COUNTRY: Record<string, { cur: string; lang: string }> = {
  US: { cur: "USD", lang: "en" }, CA: { cur: "CAD", lang: "en" }, MX: { cur: "MXN", lang: "es" }, GB: { cur: "GBP", lang: "en" }, IE: { cur: "EUR", lang: "en" },
  FR: { cur: "EUR", lang: "fr" }, DE: { cur: "EUR", lang: "de" }, NL: { cur: "EUR", lang: "nl" }, BE: { cur: "EUR", lang: "nl" }, LU: { cur: "EUR", lang: "fr" },
  AT: { cur: "EUR", lang: "de" }, CH: { cur: "CHF", lang: "de" }, IT: { cur: "EUR", lang: "it" }, ES: { cur: "EUR", lang: "es" }, PT: { cur: "EUR", lang: "pt" },
  GR: { cur: "EUR", lang: "el" }, DK: { cur: "DKK", lang: "da" }, SE: { cur: "SEK", lang: "sv" }, NO: { cur: "NOK", lang: "nb" }, FI: { cur: "EUR", lang: "fi" },
  IS: { cur: "ISK", lang: "is" }, PL: { cur: "PLN", lang: "pl" }, CZ: { cur: "CZK", lang: "cs" }, SK: { cur: "EUR", lang: "sk" }, HU: { cur: "HUF", lang: "hu" },
  RO: { cur: "RON", lang: "ro" }, BG: { cur: "BGN", lang: "bg" }, HR: { cur: "EUR", lang: "hr" }, SI: { cur: "EUR", lang: "sl" }, RS: { cur: "RSD", lang: "sr" },
  EE: { cur: "EUR", lang: "et" }, LV: { cur: "EUR", lang: "lv" }, LT: { cur: "EUR", lang: "lt" }, MT: { cur: "EUR", lang: "mt" }, CY: { cur: "EUR", lang: "el" },
  TR: { cur: "TRY", lang: "tr" }, RU: { cur: "RUB", lang: "ru" }, UA: { cur: "UAH", lang: "uk" }, GE: { cur: "GEL", lang: "ka" }, AM: { cur: "AMD", lang: "hy" },
  MA: { cur: "MAD", lang: "ar" }, EG: { cur: "EGP", lang: "ar" }, TN: { cur: "TND", lang: "ar" }, ZA: { cur: "ZAR", lang: "en" }, KE: { cur: "KES", lang: "sw" },
  TZ: { cur: "TZS", lang: "sw" }, NG: { cur: "NGN", lang: "en" }, GH: { cur: "GHS", lang: "en" }, ET: { cur: "ETB", lang: "am" }, AE: { cur: "AED", lang: "ar" },
  SA: { cur: "SAR", lang: "ar" }, IL: { cur: "ILS", lang: "he" }, JO: { cur: "JOD", lang: "ar" }, QA: { cur: "QAR", lang: "ar" }, IN: { cur: "INR", lang: "hi" },
  PK: { cur: "PKR", lang: "ur" }, LK: { cur: "LKR", lang: "si" }, NP: { cur: "NPR", lang: "ne" }, BD: { cur: "BDT", lang: "bn" }, CN: { cur: "CNY", lang: "zh" },
  HK: { cur: "HKD", lang: "zh" }, TW: { cur: "TWD", lang: "zh" }, JP: { cur: "JPY", lang: "ja" }, KR: { cur: "KRW", lang: "ko" }, TH: { cur: "THB", lang: "th" },
  VN: { cur: "VND", lang: "vi" }, KH: { cur: "KHR", lang: "km" }, LA: { cur: "LAK", lang: "lo" }, MY: { cur: "MYR", lang: "ms" }, SG: { cur: "SGD", lang: "en" },
  ID: { cur: "IDR", lang: "id" }, PH: { cur: "PHP", lang: "tl" }, AU: { cur: "AUD", lang: "en" }, NZ: { cur: "NZD", lang: "en" }, FJ: { cur: "FJD", lang: "en" },
  BR: { cur: "BRL", lang: "pt" }, AR: { cur: "ARS", lang: "es" }, CL: { cur: "CLP", lang: "es" }, CO: { cur: "COP", lang: "es" }, PE: { cur: "PEN", lang: "es" },
  EC: { cur: "USD", lang: "es" }, BO: { cur: "BOB", lang: "es" }, UY: { cur: "UYU", lang: "es" }, CR: { cur: "CRC", lang: "es" }, PA: { cur: "USD", lang: "es" },
  GT: { cur: "GTQ", lang: "es" }, DO: { cur: "DOP", lang: "es" }, CU: { cur: "CUP", lang: "es" }, JM: { cur: "JMD", lang: "en" }, PR: { cur: "USD", lang: "es" },
  BZ: { cur: "BZD", lang: "en" }, HN: { cur: "HNL", lang: "es" }, NI: { cur: "NIO", lang: "es" }, SV: { cur: "USD", lang: "es" },
  BS: { cur: "BSD", lang: "en" }, BB: { cur: "BBD", lang: "en" }, TT: { cur: "TTD", lang: "en" }, AW: { cur: "AWG", lang: "nl" },
};
function countryMeta(cc?: string): { cur: string; lang: string; known: boolean } {
  const r = COUNTRY[(cc || "").toUpperCase()];
  return r ? { ...r, known: true } : { cur: "USD", lang: "en", known: false };
}

export const BEACH_SAFETY_NOTE = "Swim only where lifeguards are; check the beach flag colors; hold little hands in the waves";
export const NAP_BREAK_NOTE = "Plan a nap break back at the hotel";
export const SENIOR_PACE_NOTE = "Take the day at a comfortable pace — plan shade and a place to sit";
export const SENIOR_MEDS_NOTE = "Bring your usual medicines (grown-up reminder)";
export const INFANT_PASSPORT_TASK = "Infants need their own passport (grown-up task)";
export const CONSENT_LETTER_TASK = "If a child is travelling without both parents, a grown-up should carry a consent letter";
export const CHICHEN_BABY_NOTE = "Long day with a baby — go early, or pick closer El Rey ruins in the Hotel Zone";
export const BIG_DAY_TRIP = "big day trip (ask a grown-up)";
export const DIAPERS_FLYING_ABROAD = "Pack ~2 days of diapers in your carry-on; buy the rest there";

export const CURRENCY_NAMES: Record<string, string> = {
  MXN: "Mexican pesos", USD: "US dollars", CAD: "Canadian dollars", EUR: "euros", GBP: "pounds sterling",
  JPY: "Japanese yen", CNY: "Chinese yuan", AUD: "Australian dollars", NZD: "New Zealand dollars",
  CHF: "Swiss francs", INR: "Indian rupees", THB: "Thai baht", VND: "Vietnamese dong", IDR: "Indonesian rupiah",
  PHP: "Philippine pesos", MYR: "Malaysian ringgit", SGD: "Singapore dollars", KRW: "South Korean won",
  BRL: "Brazilian reais", ARS: "Argentine pesos", CLP: "Chilean pesos", COP: "Colombian pesos", PEN: "Peruvian soles",
  CRC: "Costa Rican colones", DOP: "Dominican pesos", JMD: "Jamaican dollars", CUP: "Cuban pesos",
  GTQ: "Guatemalan quetzales", HKD: "Hong Kong dollars", TWD: "New Taiwan dollars", AED: "UAE dirhams",
  SAR: "Saudi riyals", ILS: "Israeli shekels", TRY: "Turkish lira", ZAR: "South African rand",
  EGP: "Egyptian pounds", MAD: "Moroccan dirhams", KES: "Kenyan shillings", PLN: "Polish zloty",
  CZK: "Czech koruna", HUF: "Hungarian forints", SEK: "Swedish kronor", NOK: "Norwegian kroner",
  DKK: "Danish kroner", ISK: "Icelandic krónur",
};

export type HealthAdvice = { tapWater?: string; mosquitoes?: boolean; foodSafety?: string };

const TAP_MX = "Drink bottled or filtered water in Mexico — even for brushing teeth";
const FOOD_STALL = "Eat at busy sit-down places; skip ice from street stalls";
const TAP_GENERIC = (place: string) => `Drink bottled or filtered water in ${place} — even for brushing teeth`;

/** Small static table for common family destinations. */
export const HEALTH_BY_COUNTRY: Record<string, HealthAdvice> = {
  MX: { tapWater: TAP_MX, mosquitoes: true, foodSafety: FOOD_STALL },
  GT: { tapWater: TAP_GENERIC("Guatemala"), mosquitoes: true, foodSafety: FOOD_STALL },
  BZ: { tapWater: TAP_GENERIC("Belize"), mosquitoes: true, foodSafety: FOOD_STALL },
  HN: { mosquitoes: true, foodSafety: FOOD_STALL },
  CR: { mosquitoes: true, foodSafety: FOOD_STALL },
  PA: { mosquitoes: true, foodSafety: FOOD_STALL },
  CU: { tapWater: TAP_GENERIC("Cuba"), mosquitoes: true, foodSafety: FOOD_STALL },
  DO: { tapWater: TAP_GENERIC("the Dominican Republic"), mosquitoes: true, foodSafety: FOOD_STALL },
  JM: { mosquitoes: true, foodSafety: FOOD_STALL },
  HT: { tapWater: TAP_GENERIC("Haiti"), mosquitoes: true, foodSafety: FOOD_STALL },
  BS: { mosquitoes: true },
  BB: { mosquitoes: true },
  TT: { mosquitoes: true, foodSafety: FOOD_STALL },
  PR: { mosquitoes: true },
  PE: { tapWater: TAP_GENERIC("Peru"), mosquitoes: true, foodSafety: FOOD_STALL },
  CO: { tapWater: TAP_GENERIC("Colombia"), mosquitoes: true, foodSafety: FOOD_STALL },
  BR: { mosquitoes: true, foodSafety: FOOD_STALL },
  EC: { mosquitoes: true, foodSafety: FOOD_STALL },
  TH: { tapWater: TAP_GENERIC("Thailand"), mosquitoes: true, foodSafety: FOOD_STALL },
  VN: { tapWater: TAP_GENERIC("Vietnam"), mosquitoes: true, foodSafety: FOOD_STALL },
  KH: { tapWater: TAP_GENERIC("Cambodia"), mosquitoes: true, foodSafety: FOOD_STALL },
  LA: { tapWater: TAP_GENERIC("Laos"), mosquitoes: true, foodSafety: FOOD_STALL },
  ID: { tapWater: TAP_GENERIC("Indonesia"), mosquitoes: true, foodSafety: FOOD_STALL },
  PH: { tapWater: TAP_GENERIC("the Philippines"), mosquitoes: true, foodSafety: FOOD_STALL },
  IN: { tapWater: TAP_GENERIC("India"), mosquitoes: true, foodSafety: FOOD_STALL },
  LK: { tapWater: TAP_GENERIC("Sri Lanka"), mosquitoes: true, foodSafety: FOOD_STALL },
  NP: { tapWater: TAP_GENERIC("Nepal"), mosquitoes: true, foodSafety: FOOD_STALL },
  EG: { tapWater: TAP_GENERIC("Egypt"), mosquitoes: true, foodSafety: FOOD_STALL },
  MA: { foodSafety: FOOD_STALL },
  KE: { mosquitoes: true, foodSafety: FOOD_STALL },
  TZ: { mosquitoes: true, foodSafety: FOOD_STALL },
  ZA: { mosquitoes: true },
  FJ: { mosquitoes: true },
};

/** Destinations in English-speaking countries that still have tropical mosquitoes. */
const MOSQUITO_PLACES = /hawaii|maui|oahu|oʻahu|honolulu|kauai|kona|hilo|florida|miami|key west|keys\b|orlando|tampa|clearwater|caribbean|bahamas|jamaica|aruba|barbados|canc[uú]n|cancun|riviera maya|playa del carmen|tulum|cozumel|puerto rico|usvi|st\.?\s*thomas|st\.?\s*john|punta cana|nassau/i;

export function healthAdvice(cc?: string, destName?: string): HealthAdvice {
  const row = HEALTH_BY_COUNTRY[(cc || "").toUpperCase()] || {};
  const mosquitoes = !!row.mosquitoes || MOSQUITO_PLACES.test(destName || "");
  return { ...row, mosquitoes };
}

export function needsMosquitoAdvice(cc?: string, destName?: string): boolean {
  return !!healthAdvice(cc, destName).mosquitoes;
}

export function needsReefSafeSunscreen(interests = "", destName = "", cc = ""): boolean {
  if (/snorkel|reef|diving|scuba/i.test(interests)) return true;
  return /canc[uú]n|riviera maya|cozumel|hawaii|maui|oahu|florida|key west|caribbean|aruba|bahamas|belize|great barrier|isla mujeres|puerto morelos|tulum|playa del carmen|punta cana/i.test(`${destName} ${cc}`);
}

type Phrase = { hello: string; please: string; thanks: string; iceCream: string; bathroom: string };

const PHRASES: Record<string, Phrase> = {
  es: { hello: "Hola", please: "Por favor", thanks: "Gracias", iceCream: "Un helado, por favor", bathroom: "¿Dónde está el baño?" },
  fr: { hello: "Bonjour", please: "S'il vous plaît", thanks: "Merci", iceCream: "Une glace, s'il vous plaît", bathroom: "Où sont les toilettes ?" },
  de: { hello: "Hallo", please: "Bitte", thanks: "Danke", iceCream: "Ein Eis, bitte", bathroom: "Wo ist die Toilette?" },
  it: { hello: "Ciao", please: "Per favore", thanks: "Grazie", iceCream: "Un gelato, per favore", bathroom: "Dov'è il bagno?" },
  pt: { hello: "Olá", please: "Por favor", thanks: "Obrigado", iceCream: "Um sorvete, por favor", bathroom: "Onde fica o banheiro?" },
  el: { hello: "Yia sou", please: "Parakaló", thanks: "Efcharistó", iceCream: "Ena pagotó, parakaló", bathroom: "Pou eínai i toualéta?" },
  ja: { hello: "Konnichiwa", please: "Onegai shimasu", thanks: "Arigatō", iceCream: "Aisukurīmu o kudasai", bathroom: "Toire wa doko desu ka?" },
  zh: { hello: "Nǐ hǎo", please: "Qǐng", thanks: "Xièxie", iceCream: "Qǐng gěi wǒ yígè bīngqílín", bathroom: "Cèsuǒ zài nǎlǐ?" },
  th: { hello: "Sawasdee", please: "Karuna", thanks: "Khop khun", iceCream: "Ao aitim noi, khrap/kha", bathroom: "Hong nam yu thi nai?" },
  vi: { hello: "Xin chào", please: "Làm ơn", thanks: "Cảm ơn", iceCream: "Cho tôi một kem, làm ơn", bathroom: "Nhà vệ sinh ở đâu?" },
  id: { hello: "Halo", please: "Tolong", thanks: "Terima kasih", iceCream: "Minta es krim, tolong", bathroom: "Di mana kamar kecil?" },
  hi: { hello: "Namaste", please: "Kripaya", thanks: "Dhanyavaad", iceCream: "Ek ice cream, kripaya", bathroom: "Bathroom kahan hai?" },
  ar: { hello: "Marhaba", please: "Min fadlak", thanks: "Shukran", iceCream: "Boosa min fadlak", bathroom: "Ayna al-hammam?" },
  tr: { hello: "Merhaba", please: "Lütfen", thanks: "Teşekkürler", iceCream: "Bir dondurma, lütfen", bathroom: "Tuvalet nerede?" },
  ko: { hello: "Annyeonghaseyo", please: "Juseyo", thanks: "Gamsahamnida", iceCream: "Aiseukeurim juseyo", bathroom: "Hwajangsil-i eodie yo?" },
  nl: { hello: "Hallo", please: "Alsjeblieft", thanks: "Dank je", iceCream: "Een ijsje, alsjeblieft", bathroom: "Waar is het toilet?" },
  pl: { hello: "Cześć", please: "Proszę", thanks: "Dziękuję", iceCream: "Lody, proszę", bathroom: "Gdzie jest toaleta?" },
  cs: { hello: "Ahoj", please: "Prosím", thanks: "Děkuji", iceCream: "Zmrzlinu, prosím", bathroom: "Kde je toaleta?" },
  sv: { hello: "Hej", please: "Tack", thanks: "Tack", iceCream: "En glass, tack", bathroom: "Var är toaletten?" },
};

export function kidPhrases(lang?: string): string | undefined {
  const p = PHRASES[(lang || "").toLowerCase()];
  if (!p) return undefined;
  return `A few phrases: ${p.hello} (hello) · ${p.please} (please) · ${p.thanks} (thank you) · ${p.iceCream} (ice cream please) · ${p.bathroom} (where's the bathroom)`;
}

export function currencyLine(cc?: string): string | undefined {
  const info = countryMeta(cc || "");
  if (!info.known && !cc) return undefined;
  const code = info.cur;
  const name = CURRENCY_NAMES[code] || code;
  const tips = code === "USD" || code === "EUR" || code === "GBP"
    ? `Cards work in most places; carry a little cash for tips (grown-up).`
    : `Cards work in most places; carry small ${name} for tips (grown-up).`;
  const pretty = name.charAt(0).toUpperCase() + name.slice(1);
  return `Money: ${pretty} (${code}). ${tips}`;
}

export function plugAdvice(homeCC?: string, destCCs: string[] = []): string | undefined {
  if (!homeCC || !destCCs.length) return undefined;
  if (plugsMatchHome(homeCC, destCCs)) return SAME_PLUGS_LINE;
  const types = [...new Set(destCCs.map(c => plugType(c)).filter(Boolean))];
  if (!types.length) return undefined;
  return undefined; // Prep already writes the adapter line when types differ.
}

const FAMILY_BEACHES: { place: RegExp; names: string[] }[] = [
  { place: /canc[uú]n|cancun|isla mujeres|riviera maya|hotel zone/i, names: ["Playa Langosta (calm)", "Playa Tortugas", "Playa Delfines"] },
  { place: /playa del carmen/i, names: ["Playa Mamitas", "Playa del Carmen beach"] },
  { place: /tulum(?!\s+archaeolog)/i, names: ["Playa Paraíso", "Playa Ruinas"] },
  { place: /honolulu|waikiki|oahu|oʻahu/i, names: ["Waikiki Beach", "Lanikai Beach", "Kailua Beach"] },
  { place: /\bmaui\b/i, names: ["Kaanapali Beach", "Wailea Beach", "Kapalua Bay"] },
  { place: /kauai|kauaʻi/i, names: ["Poipu Beach", "Lydgate Beach Park"] },
  { place: /big island|kailua-kona|hilo/i, names: ["Hapuna Beach", "Kahaluu Beach Park"] },
  { place: /miami/i, names: ["South Beach", "Crandon Park Beach"] },
  { place: /clearwater/i, names: ["Clearwater Beach"] },
  { place: /siesta key|sarasota/i, names: ["Siesta Key Beach"] },
  { place: /key west|florida keys/i, names: ["Smathers Beach", "Fort Zachary Taylor Beach"] },
  { place: /orlando/i, names: ["Discovery Cove", "Typhoon Lagoon"] },
  { place: /nassau|bahamas/i, names: ["Cabbage Beach", "Cable Beach"] },
  { place: /montego|negril|jamaica/i, names: ["Doctor's Cave Beach", "Seven Mile Beach"] },
  { place: /punta cana|bavaro/i, names: ["Bávaro Beach", "Arena Gorda"] },
  { place: /san juan|puerto rico/i, names: ["Condado Beach", "Isla Verde"] },
  { place: /aruba/i, names: ["Eagle Beach", "Palm Beach"] },
  { place: /barbados/i, names: ["Miami Beach (Harry Bayley Oval)", "Carlisle Bay"] },
  { place: /st\.?\s*thomas|charlotte amalie/i, names: ["Magens Bay", "Coki Beach"] },
];

export function preferredFamilyBeaches(destName = "", cc = ""): string[] {
  const blob = `${destName} ${cc}`;
  const hit = FAMILY_BEACHES.find(e => e.place.test(blob));
  return hit ? [...hit.names] : [];
}

export function isOceanBeachDestination(destName = "", cc = ""): boolean {
  if (preferredFamilyBeaches(destName, cc).length) return true;
  return /beach|playa|coast|seaside|ocean|caribbean|gulf|riviera|isla |island|key west|hawaii|canc[uú]n|florida/i.test(`${destName} ${cc}`)
    && !/grand canyon|yellowstone|yosemite|zion|rocky mountain|national park/i.test(destName);
}

export function isRemoteForSupplies(destName = "", cc = ""): boolean {
  return /national park|wilderness|canyon|backcountry|remote|atoll|outback/i.test(`${destName} ${cc}`)
    && !/canc[uú]n|city|honolulu|miami|orlando|london|paris/i.test(destName);
}

export function hasSeniorTraveler(input?: any, members?: any[]): boolean {
  const list = members || input?.members || [];
  if (!Array.isArray(list)) return false;
  return list.some((m: any) => m?.profile === "grandparent" || (Number.isInteger(m?.age) && m.age >= 65));
}

export function hasInfantTraveler(input?: any, members?: any[]): boolean {
  return hasChildUnder(2, input, members);
}

export function tripAdviceNotes(opts: {
  input?: any;
  place?: { name?: string; country?: string; countryCode?: string };
  homeCC?: string;
  domestic?: boolean;
  members?: any[];
}): string[] {
  const place = opts.place || {};
  const cc = place.countryCode;
  const name = place.name || "";
  const input = opts.input;
  const members = opts.members || input?.members;
  const kids = tripHasKids(input, members);
  const infant = hasInfantTraveler(input, members);
  const senior = hasSeniorTraveler(input, members);
  const health = healthAdvice(cc, name);
  const out: string[] = [];
  const money = currencyLine(cc);
  if (money) out.push(money);
  if (health.tapWater) out.push(health.tapWater);
  if (health.foodSafety) out.push(health.foodSafety);
  if (health.mosquitoes) out.push("Bring insect repellent — mosquitoes can be active in tropical places");
  const plugs = plugAdvice(opts.homeCC, cc ? [cc] : []);
  if (plugs) out.push(plugs);
  const lang = countryMeta(cc || "").lang;
  if (lang && lang !== "en") {
    const phrases = kidPhrases(lang);
    if (phrases) out.push(phrases);
  }
  if (isOceanBeachDestination(name, cc) && (kids || /beach|swim|snorkel/i.test(input?.interests || ""))) out.push(BEACH_SAFETY_NOTE);
  if (infant) out.push(NAP_BREAK_NOTE);
  if (senior) {
    out.push(SENIOR_PACE_NOTE);
    out.push(SENIOR_MEDS_NOTE);
  }
  return out;
}
