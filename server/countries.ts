// Per-country price level + currency + main language.
// pli = approximate price level index (USA = 100), rounded to the nearest 5, based on the
// World Bank "Price level ratio of PPP conversion factor (GDP) to market exchange rate"
// (indicator PA.NUS.PPPC.RF, ICP 2021 round). Approximate tiers, NOT current prices.
export const COST_SOURCE = "World Bank ICP 2021 price-level ratios (PA.NUS.PPPC.RF), rounded to tiers";
export interface CountryInfo { pli: number; cur: string; lang: string }
const T: Record<string, [number, string, string]> = {
  US: [100, "USD", "en"], CA: [85, "CAD", "en"], MX: [55, "MXN", "es"], GB: [90, "GBP", "en"], IE: [100, "EUR", "en"],
  FR: [85, "EUR", "fr"], DE: [85, "EUR", "de"], NL: [90, "EUR", "nl"], BE: [90, "EUR", "nl"], LU: [100, "EUR", "fr"],
  AT: [90, "EUR", "de"], CH: [125, "CHF", "de"], IT: [75, "EUR", "it"], ES: [70, "EUR", "es"], PT: [60, "EUR", "pt"],
  GR: [60, "EUR", "el"], DK: [105, "DKK", "da"], SE: [90, "SEK", "sv"], NO: [110, "NOK", "nb"], FI: [95, "EUR", "fi"],
  IS: [120, "ISK", "is"], PL: [45, "PLN", "pl"], CZ: [55, "CZK", "cs"], SK: [55, "EUR", "sk"], HU: [45, "HUF", "hu"],
  RO: [40, "RON", "ro"], BG: [40, "BGN", "bg"], HR: [55, "EUR", "hr"], SI: [65, "EUR", "sl"], RS: [45, "RSD", "sr"],
  EE: [65, "EUR", "et"], LV: [60, "EUR", "lv"], LT: [55, "EUR", "lt"], MT: [70, "EUR", "mt"], CY: [70, "EUR", "el"],
  TR: [30, "TRY", "tr"], RU: [35, "RUB", "ru"], UA: [30, "UAH", "uk"], GE: [30, "GEL", "ka"], AM: [35, "AMD", "hy"],
  MA: [35, "MAD", "ar"], EG: [20, "EGP", "ar"], TN: [30, "TND", "ar"], ZA: [45, "ZAR", "en"], KE: [40, "KES", "sw"],
  TZ: [35, "TZS", "sw"], NG: [35, "NGN", "en"], GH: [35, "GHS", "en"], ET: [30, "ETB", "am"], AE: [65, "AED", "ar"],
  SA: [50, "SAR", "ar"], IL: [100, "ILS", "he"], JO: [50, "JOD", "ar"], QA: [65, "QAR", "ar"], IN: [25, "INR", "hi"],
  PK: [20, "PKR", "ur"], LK: [25, "LKR", "si"], NP: [30, "NPR", "ne"], BD: [30, "BDT", "bn"], CN: [60, "CNY", "zh"],
  HK: [80, "HKD", "zh"], TW: [50, "TWD", "zh"], JP: [65, "JPY", "ja"], KR: [65, "KRW", "ko"], TH: [35, "THB", "th"],
  VN: [30, "VND", "vi"], KH: [35, "KHR", "km"], LA: [30, "LAK", "lo"], MY: [35, "MYR", "ms"], SG: [75, "SGD", "en"],
  ID: [35, "IDR", "id"], PH: [40, "PHP", "tl"], AU: [95, "AUD", "en"], NZ: [90, "NZD", "en"], FJ: [50, "FJD", "en"],
  BR: [50, "BRL", "pt"], AR: [40, "ARS", "es"], CL: [55, "CLP", "es"], CO: [35, "COP", "es"], PE: [45, "PEN", "es"],
  EC: [50, "USD", "es"], BO: [35, "BOB", "es"], UY: [70, "UYU", "es"], CR: [60, "CRC", "es"], PA: [50, "USD", "es"],
  GT: [45, "GTQ", "es"], DO: [45, "DOP", "es"], CU: [40, "CUP", "es"], JM: [60, "JMD", "en"], PR: [85, "USD", "es"],
};
export function countryInfo(cc: string): CountryInfo & { known: boolean } {
  const r = T[(cc || "").toUpperCase()];
  return r ? { pli: r[0], cur: r[1], lang: r[2], known: true } : { pli: 60, cur: "USD", lang: "en", known: false };
}
