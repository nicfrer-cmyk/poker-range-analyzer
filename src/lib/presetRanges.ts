export type PresetRangeKey =
  | "UTG"
  | "CO"
  | "BTN"
  | "SB"
  | "BB_DEFENSE"
  | "3BET"
  | "4BET";

export const PRESET_RANGES: Record<PresetRangeKey, { label: string; range: string }> = {
  UTG: { label: "UTG Open", range: "77+,ATs+,KQs,AJo+,KQo" },
  CO: { label: "CO Open", range: "55+,A8s+,KTs+,QTs+,JTs,A9o+,KJo+" },
  BTN: {
    label: "BTN Open",
    range: "22+,A2s+,K5s+,Q7s+,J8s+,T8s+,97s+,86s+,75s+,A5o+,K9o+,QTo+,JTo",
  },
  SB: {
    label: "SB Open",
    range: "22+,A2s+,K7s+,Q9s+,J9s+,T8s+,98s,A7o+,KTo+,QJo",
  },
  BB_DEFENSE: {
    label: "BB Defense",
    range:
      "22+,A2s+,K2s+,Q4s+,J6s+,T6s+,96s+,86s+,75s+,64s+,A2o+,K9o+,Q9o+,J9o+,T9o",
  },
  "3BET": { label: "3Bet Range", range: "TT+,AQs+,KQs,AKo" },
  "4BET": { label: "4Bet Range", range: "QQ+,AKs,AKo" },
};
