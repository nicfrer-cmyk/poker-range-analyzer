import type { Card } from './types';
import { classifyHand } from './classify';

export type DecisionStreet = 'preflop' | 'flop' | 'turn' | 'river';
export type ActionTaken = 'fold' | 'check' | 'call' | 'bet' | 'raise';

/** A single previously-analyzed/saved hand, as produced by the app's "save this spot" feature. */
export interface SavedHandRecord {
  id?: string;
  heroCards: Card[];
  board: Card[];
  /** Free-form label for the villain range used at decision time (range string, or a note). */
  villainRange?: string;
  position?: string;
  potSize: number;
  street: DecisionStreet;
  /** Hero's equity at the moment of the decision, in [0,1]. */
  equityAtDecision: number;
  /** Pot odds hero was facing, in [0,1] (equity needed to break even), if applicable. */
  potOddsRequired?: number;
  actionTaken: ActionTaken;
  /** Estimated EV lost by the action taken vs. the engine's best action, in big blinds or $ (>= 0). */
  evLossEstimate: number;
  timestamp: number | string;
  handCategory?: string;
}

export interface SessionStats {
  handCount: number;
  avgEquity: number;
  avgEvLoss: number;
  goodDecisions: number;
  badDecisions: number;
  goodDecisionRate: number;
  trend: TrendPoint[];
}

export interface TrendPoint {
  bucket: string;
  handCount: number;
  avgEvLoss: number;
  avgEquity: number;
  badDecisionRate: number;
}

export interface LeakGroup {
  dimension: 'position' | 'handCategory' | 'street' | 'potSizeBucket';
  key: string;
  count: number;
  avgEvLoss: number;
  badDecisionRate: number;
  records: SavedHandRecord[];
}

export interface TopLeak extends LeakGroup {
  examples: SavedHandRecord[];
}

/** A decision counts as "good" if it lost (near) zero EV relative to the engine's best action. */
const GOOD_DECISION_EV_LOSS_THRESHOLD = 0.001;

export function isGoodDecision(record: SavedHandRecord): boolean {
  return record.evLossEstimate <= GOOD_DECISION_EV_LOSS_THRESHOLD;
}

function toTimestampMs(t: number | string): number {
  return typeof t === 'number' ? t : new Date(t).getTime();
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function handCategoryOf(record: SavedHandRecord): string {
  if (record.handCategory) return record.handCategory;
  if (record.heroCards.length !== 2) return 'unknown';
  try {
    return classifyHand({ c1: record.heroCards[0] as Card, c2: record.heroCards[1] as Card }, record.board).madeTier;
  } catch {
    return 'unknown';
  }
}

export function potSizeBucket(potSize: number, thresholds: [number, number] = [20, 75]): string {
  const [small, medium] = thresholds;
  if (potSize < small) return `small (<${small})`;
  if (potSize < medium) return `medium (${small}-${medium})`;
  return `large (>=${medium})`;
}

/** Groups records by an arbitrary key function and computes aggregate stats per group. */
function groupAndAggregate(records: SavedHandRecord[], keyFn: (r: SavedHandRecord) => string): Map<string, SavedHandRecord[]> {
  const groups = new Map<string, SavedHandRecord[]>();
  for (const r of records) {
    const key = keyFn(r);
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }
  return groups;
}

function statsForGroup(dimension: LeakGroup['dimension'], key: string, records: SavedHandRecord[]): LeakGroup {
  const evLosses = records.map((r) => r.evLossEstimate);
  const badCount = records.filter((r) => !isGoodDecision(r)).length;
  return {
    dimension,
    key,
    count: records.length,
    avgEvLoss: average(evLosses),
    badDecisionRate: records.length > 0 ? badCount / records.length : 0,
    records,
  };
}

/** Session-level aggregate stats: overall performance plus a chronological trend. */
export function computeSessionStats(records: SavedHandRecord[], trendBucket: 'day' | 'week' = 'day'): SessionStats {
  if (records.length === 0) {
    return { handCount: 0, avgEquity: 0, avgEvLoss: 0, goodDecisions: 0, badDecisions: 0, goodDecisionRate: 0, trend: [] };
  }
  const goodDecisions = records.filter(isGoodDecision).length;
  const badDecisions = records.length - goodDecisions;
  return {
    handCount: records.length,
    avgEquity: average(records.map((r) => r.equityAtDecision)),
    avgEvLoss: average(records.map((r) => r.evLossEstimate)),
    goodDecisions,
    badDecisions,
    goodDecisionRate: goodDecisions / records.length,
    trend: progressSeries(records, trendBucket),
  };
}

export function leaksByPosition(records: SavedHandRecord[]): LeakGroup[] {
  const groups = groupAndAggregate(records, (r) => r.position ?? 'unknown');
  return [...groups.entries()].map(([key, recs]) => statsForGroup('position', key, recs));
}

export function leaksByHandCategory(records: SavedHandRecord[]): LeakGroup[] {
  const groups = groupAndAggregate(records, handCategoryOf);
  return [...groups.entries()].map(([key, recs]) => statsForGroup('handCategory', key, recs));
}

export function leaksByStreet(records: SavedHandRecord[]): LeakGroup[] {
  const groups = groupAndAggregate(records, (r) => r.street);
  return [...groups.entries()].map(([key, recs]) => statsForGroup('street', key, recs));
}

export function leaksByPotSizeBucket(records: SavedHandRecord[], thresholds?: [number, number]): LeakGroup[] {
  const groups = groupAndAggregate(records, (r) => potSizeBucket(r.potSize, thresholds));
  return [...groups.entries()].map(([key, recs]) => statsForGroup('potSizeBucket', key, recs));
}

export interface DetectLeaksOptions {
  /** A group must have at least this many hands to be considered statistically meaningful. */
  minSampleSize?: number;
  /** A group's avgEvLoss must exceed the overall average by this multiplier to count as a leak. */
  severityMultiplier?: number;
  potSizeThresholds?: [number, number];
}

/** Finds every group (across position/hand-category/street/pot-size) that under-performs the overall average. */
export function detectLeaks(records: SavedHandRecord[], options: DetectLeaksOptions = {}): LeakGroup[] {
  const { minSampleSize = 3, severityMultiplier = 1.5, potSizeThresholds } = options;
  if (records.length === 0) return [];

  const overallAvgEvLoss = average(records.map((r) => r.evLossEstimate));
  const allGroups = [
    ...leaksByPosition(records),
    ...leaksByHandCategory(records),
    ...leaksByStreet(records),
    ...leaksByPotSizeBucket(records, potSizeThresholds),
  ];

  const threshold = overallAvgEvLoss * severityMultiplier;
  return allGroups
    .filter((g) => g.count >= minSampleSize && (overallAvgEvLoss <= 0 ? g.avgEvLoss > 0 : g.avgEvLoss > threshold))
    .sort((a, b) => b.avgEvLoss - a.avgEvLoss);
}

/** The n worst-performing categories, each with its worst example hands attached. */
export function topLeaks(records: SavedHandRecord[], n = 3, options: DetectLeaksOptions = {}): TopLeak[] {
  const leaks = detectLeaks(records, options);
  return leaks.slice(0, n).map((leak) => ({
    ...leak,
    examples: leak.records
      .slice()
      .sort((a, b) => b.evLossEstimate - a.evLossEstimate)
      .slice(0, 3),
  }));
}

function bucketKey(timestampMs: number, bucket: 'day' | 'week'): string {
  const d = new Date(timestampMs);
  if (bucket === 'day') {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  // ISO week bucket: Monday-start week, labeled by that Monday's date.
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

/**
 * Buckets records over time (day or week) and reports avg EV loss / equity / bad-decision-rate
 * per bucket, in chronological order — used to show whether a leak is improving over time.
 */
export function progressSeries(
  records: SavedHandRecord[],
  bucket: 'day' | 'week' = 'day',
  filter?: (r: SavedHandRecord) => boolean,
): TrendPoint[] {
  const filtered = filter ? records.filter(filter) : records;
  const groups = groupAndAggregate(filtered, (r) => bucketKey(toTimestampMs(r.timestamp), bucket));
  const points: TrendPoint[] = [...groups.entries()].map(([key, recs]) => ({
    bucket: key,
    handCount: recs.length,
    avgEvLoss: average(recs.map((r) => r.evLossEstimate)),
    avgEquity: average(recs.map((r) => r.equityAtDecision)),
    badDecisionRate: recs.filter((r) => !isGoodDecision(r)).length / recs.length,
  }));
  return points.sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

/** Progress-over-time series filtered down to a single leak category (e.g. "position=BB"). */
export function progressForLeak(
  records: SavedHandRecord[],
  leak: Pick<LeakGroup, 'dimension' | 'key'>,
  bucket: 'day' | 'week' = 'day',
): TrendPoint[] {
  const keyFn: (r: SavedHandRecord) => string =
    leak.dimension === 'position'
      ? (r) => r.position ?? 'unknown'
      : leak.dimension === 'handCategory'
        ? handCategoryOf
        : leak.dimension === 'street'
          ? (r) => r.street
          : (r) => potSizeBucket(r.potSize);
  return progressSeries(records, bucket, (r) => keyFn(r) === leak.key);
}
