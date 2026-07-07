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
  air: "אוויר",
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
