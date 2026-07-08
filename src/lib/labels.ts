import type { MadeTier, DrawType } from "@/lib/engine/classify";

export const MADE_TIER_LABEL: Record<MadeTier, string> = {
  "straight-flush": "סטרייט פלאש",
  quads: "קווערס",
  "full-house": "פול האוס",
  flush: "פלאש",
  straight: "סטרייט",
  set: "סט",
  trips: "שלישייה",
  "two-pair": "שני זוגות",
  overpair: "אוברפייר",
  "top-pair": "זוג עליון",
  "second-pair": "זוג שני",
  "bottom-pair": "זוג תחתון",
  underpair: "זוג נמוך",
  overcards: "קלפים גבוהים",
  air: "יד ריקה (בלי זוג או דרואו)",
};

export const DRAW_TYPE_LABEL: Record<DrawType, string> = {
  "flush-draw": "דרואו לפלאש",
  "backdoor-flush-draw": "דרואו לפלאש (דלת אחורית)",
  "open-ended-straight-draw": "דרואו פתוח לסטרייט",
  "gutshot-straight-draw": "דרואו גוטשוט",
};

export function drawsToHebrew(draws: DrawType[]): string {
  return draws.map((d) => DRAW_TYPE_LABEL[d]).join(", ");
}

export const STREET_LABEL: Record<string, string> = {
  preflop: "פרה-פלופ",
  flop: "פלופ",
  turn: "טרן",
  river: "ריבר",
};

export const LEAK_DIMENSION_LABEL: Record<string, string> = {
  position: "פוזיציה",
  handCategory: "קטגוריית יד",
  street: "רחוב",
  potSizeBucket: "גודל הפוט",
};

/** Formats a leak group's dimension+key (as produced by leakFinder.ts) into plain Hebrew, e.g.
 *  ("street", "river") -> "ריבר". Shared across the home/leaks/weekly-review surfaces so the
 *  same leak reads identically everywhere instead of each page inventing its own phrasing. */
export function formatLeakKey(dimension: string, key: string): string {
  if (dimension === "handCategory") {
    return MADE_TIER_LABEL[key as keyof typeof MADE_TIER_LABEL] ?? key;
  }
  if (dimension === "street") return STREET_LABEL[key] ?? key;
  if (dimension === "potSizeBucket") {
    return key.replace("small", "נמוך").replace("medium", "בינוני").replace("large", "גבוה");
  }
  return key;
}
