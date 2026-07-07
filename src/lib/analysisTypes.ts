import type { StatusTone } from "@/lib/statusTone";
import type { MadeTier, DrawType } from "@/lib/engine/classify";

export type HandCategoryLabel = MadeTier;

export type DrawLabel = DrawType | "none";

export type Insight = {
  id: string;
  text: string;
  tone: StatusTone;
};

export type ComboBucket = {
  category: HandCategoryLabel | DrawLabel;
  weight: number; // fraction (0-1) of villain's range in this bucket
  combosCount: number;
};

export type NextCardOutlook = {
  card: string;
  heroEquityDelta: number; // percentage point change if this card comes
  note: string;
};

export type BlockerInfo = {
  card: string;
  valueCombosBlocked: number;
  drawCombosBlocked: number;
  bluffCombosBlocked: number;
};

export type AnalysisResult = {
  street: "preflop" | "flop" | "turn" | "river";
  heroEquityPct: number;
  tieEquityPct: number;
  villainEquityPct: number;
  exact: boolean;
  iterations: number;

  heroCategory: HandCategoryLabel;
  heroDraw: DrawLabel;
  verdictText: string;
  verdictTone: StatusTone;
  starScore: number; // 0-100
  boardTexture: string;
  dangerLevel: StatusTone;

  keyInsights: Insight[];

  potOdds: {
    pot: number;
    toCall: number;
    requiredEquityPct: number;
    ev: number;
    callProfitable: boolean;
    multiwayAdjustedEquityPct: number;
  };

  spr: {
    value: number;
    interpretation: string;
    outs: number;
    outsRuleOf2And4Pct: number;
  };

  rangeComposition: ComboBucket[];

  whatChanged: string[];
  nextCardOutlook: {
    best: NextCardOutlook[];
    worst: NextCardOutlook[];
  };
  blockers: BlockerInfo[];
  coachMessages: string[];
};
