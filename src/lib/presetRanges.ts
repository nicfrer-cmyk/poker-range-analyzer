export type PresetRangeKey =
  | "UTG"
  | "CO"
  | "BTN"
  | "SB"
  | "BB_DEFENSE"
  | "3BET"
  | "4BET";

export const PRESET_RANGES: Record<PresetRangeKey, { label: string; range: string; description: string }> = {
  UTG: {
    label: "UTG Open",
    range: "77+,ATs+,KQs,AJo+,KQo",
    description: "טווח פתיחה הדוק מהפוזיציה המוקדמת ביותר — הכי הרבה שחקנים עדיין מאחורייך.",
  },
  CO: {
    label: "CO Open",
    range: "55+,A8s+,KTs+,QTs+,JTs,A9o+,KJo+",
    description: "טווח פתיחה בינוני מה-Cutoff, פוזיציה מאוחרת יחסית עם פחות שחקנים מאחורייך.",
  },
  BTN: {
    label: "BTN Open",
    range: "22+,A2s+,K5s+,Q7s+,J8s+,T8s+,97s+,86s+,75s+,A5o+,K9o+,QTo+,JTo",
    description: "טווח פתיחה רחב מהכפתור — הפוזיציה הכי טובה בשולחן.",
  },
  SB: {
    label: "SB Open",
    range: "22+,A2s+,K7s+,Q9s+,J9s+,T8s+,98s,A7o+,KTo+,QJo",
    description: "טווח פתיחה מה-Small Blind, כשכל שאר השחקנים כבר פסלו.",
  },
  BB_DEFENSE: {
    label: "BB Defense",
    range: "22+,A2s+,K2s+,Q4s+,J6s+,T6s+,96s+,86s+,75s+,64s+,A2o+,K9o+,Q9o+,J9o+,T9o",
    description: "טווח הגנה מה-Big Blind מול ריבייז — רחב יותר בזכות פוט אודס טובים.",
  },
  "3BET": {
    label: "3Bet Range",
    range: "TT+,AQs+,KQs,AKo",
    description: "טווח מומלץ לריבייז (3-bet) מול פתיחה — ידיים חזקות מספיק להעלאה חוזרת.",
  },
  "4BET": {
    label: "4Bet Range",
    range: "QQ+,AKs,AKo",
    description: "טווח מומלץ לריי-ריבייז (4-bet) — ידיים פרימיום בלבד.",
  },
};
