import type { Card } from './types';

/**
 * Hand-history parser.
 *
 * Precisely targets the PokerStars hand-history text format (the de-facto standard that most
 * trackers/converters — including GGPoker's and ClubGG's exports — mirror closely enough that
 * this same line-based parser handles all three in practice):
 *
 *   PokerStars Hand #123456789:  Hold'em No Limit ($0.05/$0.10 USD) - 2024/01/01 12:00:00 ET
 *   Table 'Atlanta' 6-max Seat #1 is the button
 *   Seat 1: Player1 ($10.00 in chips)
 *   Seat 2: Hero ($10.50 in chips)
 *   Player1: posts small blind $0.05
 *   Hero: posts big blind $0.10
 *   *** HOLE CARDS ***
 *   Dealt to Hero [Ah Kd]
 *   Player1: raises $0.20 to $0.30
 *   Hero: calls $0.20
 *   *** FLOP *** [7h 8d 2c]
 *   Player1: bets $0.40
 *   Hero: calls $0.40
 *   *** TURN *** [7h 8d 2c] [9s]
 *   Player1: checks
 *   Hero: bets $0.60
 *   Player1: folds
 *   *** SUMMARY ***
 *   Total pot $1.70 | Rake $0.08
 *   Board [7h 8d 2c 9s]
 *   Seat 2: Hero (big blind) collected ($1.62)
 *
 * `detectFormat` is a lightweight heuristic based on the header line only; `parseHandHistory`
 * itself is format-agnostic beyond that (it just looks for the PokerStars-style section
 * markers/line shapes above), which is what lets it also cover GGPoker/ClubGG exports.
 */

export type HandHistoryFormat = 'pokerstars' | 'ggpoker' | 'clubgg' | 'unknown';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type ActionType =
  | 'post-sb'
  | 'post-bb'
  | 'post'
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'show'
  | 'muck'
  | 'collect'
  | 'unknown';

export interface SeatInfo {
  seat: number;
  player: string;
  chips: number;
}

export interface ActionEntry {
  street: Street;
  player: string;
  action: ActionType;
  amount?: number;
  raiseTo?: number;
  raw: string;
}

export interface ParsedHand {
  format: HandHistoryFormat;
  handId?: string;
  gameType?: string;
  stakes?: string;
  dateTime?: string;
  tableName?: string;
  maxSeats?: number;
  buttonSeat?: number;
  seats: SeatInfo[];
  heroName?: string;
  heroCards?: Card[];
  heroPosition?: string;
  board: { flop?: Card[]; turn?: Card; river?: Card };
  actions: ActionEntry[];
  potSize?: number;
  rake?: number;
  heroResult?: { won: boolean; amount?: number };
  raw: string;
}

export function detectFormat(text: string): HandHistoryFormat {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  if (/PokerStars/i.test(firstLine)) return 'pokerstars';
  if (/GG\s?Poker/i.test(firstLine)) return 'ggpoker';
  if (/Club\s?GG/i.test(firstLine)) return 'clubgg';
  return 'unknown';
}

function normalizeCardToken(tok: string): Card {
  const t = tok.trim();
  const rank = t.charAt(0).toUpperCase();
  const suit = t.charAt(t.length - 1).toLowerCase();
  return `${rank}${suit}` as Card;
}

function parseAmount(str: string | undefined): number | undefined {
  if (!str) return undefined;
  const m = str.match(/\$?([\d,]+\.?\d*)/);
  if (!m) return undefined;
  return parseFloat((m[1] as string).replace(/,/g, ''));
}

function parseActionLine(street: Street, player: string, verbRaw: string, rest: string, raw: string): ActionEntry {
  const verb = verbRaw.toLowerCase();
  if (verb === 'posts small blind') return { street, player, action: 'post-sb', amount: parseAmount(rest), raw };
  if (verb === 'posts big blind') return { street, player, action: 'post-bb', amount: parseAmount(rest), raw };
  if (verb === 'posts') return { street, player, action: 'post', amount: parseAmount(rest), raw };
  if (verb === 'folds') return { street, player, action: 'fold', raw };
  if (verb === 'checks') return { street, player, action: 'check', raw };
  if (verb === 'calls') return { street, player, action: 'call', amount: parseAmount(rest), raw };
  if (verb === 'bets') return { street, player, action: 'bet', amount: parseAmount(rest), raw };
  if (verb === 'raises') {
    const m = rest.match(/\$?([\d,.]+)\s*to\s*\$?([\d,.]+)/i);
    if (m) {
      return {
        street,
        player,
        action: 'raise',
        amount: parseFloat((m[1] as string).replace(/,/g, '')),
        raiseTo: parseFloat((m[2] as string).replace(/,/g, '')),
        raw,
      };
    }
    return { street, player, action: 'raise', amount: parseAmount(rest), raw };
  }
  if (verb === 'shows') return { street, player, action: 'show', raw };
  if (verb === 'mucks') return { street, player, action: 'muck', raw };
  if (verb === 'collected') return { street, player, action: 'collect', amount: parseAmount(rest), raw };
  return { street, player, action: 'unknown', raw };
}

/** Standard clockwise position labels starting at the button, for a table of `n` seated players. */
function positionsForCount(n: number): string[] {
  if (n <= 1) return ['BTN'];
  if (n === 2) return ['BTN', 'BB']; // heads-up: the button also posts the small blind
  if (n === 3) return ['BTN', 'SB', 'BB'];

  const remaining = n - 3;
  const lateLabels: string[] = [];
  if (remaining >= 1) lateLabels.push('CO');
  if (remaining >= 2) lateLabels.unshift('HJ');
  const earlyCount = remaining - lateLabels.length;
  const earlyLabels: string[] = [];
  for (let i = 0; i < earlyCount; i++) earlyLabels.push(i === 0 ? 'UTG' : `UTG+${i}`);
  return ['BTN', 'SB', 'BB', ...earlyLabels, ...lateLabels];
}

function computePosition(seats: SeatInfo[], buttonSeat: number, heroName: string): string | undefined {
  const sorted = seats.slice().sort((a, b) => a.seat - b.seat);
  const n = sorted.length;
  const buttonIdx = sorted.findIndex((s) => s.seat === buttonSeat);
  const heroIdx = sorted.findIndex((s) => s.player === heroName);
  if (buttonIdx === -1 || heroIdx === -1 || n === 0) return undefined;
  const order = positionsForCount(n);
  const offset = (heroIdx - buttonIdx + n) % n;
  return order[offset];
}

const SEAT_RE = /^Seat (\d+): (.+?) \(\$?([\d,.]+) in chips\)/;
const DEALT_RE = /^Dealt to (.+?) \[([^\]]+)\]/;
const FLOP_RE = /^\*\*\*\s*FLOP\s*\*\*\*\s*\[([^\]]+)\]/i;
const TURN_RE = /^\*\*\*\s*TURN\s*\*\*\*\s*\[[^\]]*\]\s*\[([^\]]+)\]/i;
const RIVER_RE = /^\*\*\*\s*RIVER\s*\*\*\*\s*\[[^\]]*\]\s*\[([^\]]+)\]/i;
const STREET_MARKER_RE = /^\*\*\*\s*(HOLE CARDS|FLOP|TURN|RIVER|SHOW ?DOWN|SUMMARY)\s*\*\*\*/i;
const ACTION_RE = /^(.+?): (posts small blind|posts big blind|posts|folds|checks|calls|bets|raises|shows|mucks|collected)\s*(.*)$/i;

/** Parses a single raw hand-history text block. Returns `{ error }` if it doesn't look parseable. */
export function parseHandHistory(text: string): ParsedHand | { error: string } {
  if (!text || !text.trim()) return { error: 'Empty hand history text' };

  const format = detectFormat(text);
  const lines = text.split(/\r?\n/);

  const headerLine = lines.find((l) => l.trim().length > 0) ?? '';
  if (!/Hand #/i.test(headerLine)) {
    return { error: 'No recognizable hand-history header line (expected "... Hand #...")' };
  }

  const handIdMatch = headerLine.match(/Hand #(\w+)/i);
  const gameTypeMatch = headerLine.match(/:\s*(.+?)\s*\(/);
  const stakesMatch = headerLine.match(/\(([^)]+)\)\s*-/);
  const dateTimeMatch = headerLine.match(/-\s*(\d{4}\/\d{2}\/\d{2}[^\r\n]*)/);

  const tableLine = lines.find((l) => /^Table /i.test(l.trim())) ?? '';
  const tableNameMatch = tableLine.match(/Table '([^']+)'/);
  const maxSeatsMatch = tableLine.match(/(\d+)-max/i);
  const buttonSeatMatch = tableLine.match(/Seat #(\d+) is the button/i);

  const seats: SeatInfo[] = [];
  for (const line of lines) {
    const m = line.trim().match(SEAT_RE);
    if (m) {
      seats.push({
        seat: parseInt(m[1] as string, 10),
        player: (m[2] as string).trim(),
        chips: parseFloat((m[3] as string).replace(/,/g, '')),
      });
    }
  }

  let heroName: string | undefined;
  let heroCards: Card[] | undefined;
  for (const line of lines) {
    const m = line.trim().match(DEALT_RE);
    if (m) {
      heroName = (m[1] as string).trim();
      heroCards = (m[2] as string).trim().split(/\s+/).map(normalizeCardToken);
      break;
    }
  }

  const board: { flop?: Card[]; turn?: Card; river?: Card } = {};
  for (const line of lines) {
    const t = line.trim();
    const flopMatch = t.match(FLOP_RE);
    const turnMatch = t.match(TURN_RE);
    const riverMatch = t.match(RIVER_RE);
    if (flopMatch) board.flop = (flopMatch[1] as string).trim().split(/\s+/).map(normalizeCardToken);
    else if (turnMatch) board.turn = normalizeCardToken((turnMatch[1] as string).trim());
    else if (riverMatch) board.river = normalizeCardToken((riverMatch[1] as string).trim());
  }

  const actions: ActionEntry[] = [];
  let currentStreet: Street = 'preflop';
  for (const rawLine of lines) {
    const t = rawLine.trim();
    if (!t) continue;
    const marker = t.match(STREET_MARKER_RE);
    if (marker) {
      const name = (marker[1] as string).toUpperCase().replace(/\s+/g, ' ');
      if (name === 'HOLE CARDS') currentStreet = 'preflop';
      else if (name === 'FLOP') currentStreet = 'flop';
      else if (name === 'TURN') currentStreet = 'turn';
      else if (name === 'RIVER') currentStreet = 'river';
      else if (name === 'SHOW DOWN' || name === 'SHOWDOWN') currentStreet = 'showdown';
      else if (name === 'SUMMARY') break;
      continue;
    }
    const actMatch = t.match(ACTION_RE);
    if (actMatch) {
      const player = actMatch[1] as string;
      const verbRaw = actMatch[2] as string;
      const rest = actMatch[3] as string;
      actions.push(parseActionLine(currentStreet, player.trim(), verbRaw, rest.trim(), t));
    }
  }

  const summaryIdx = lines.findIndex((l) => /\*\*\*\s*SUMMARY\s*\*\*\*/i.test(l));
  const summaryLines = summaryIdx >= 0 ? lines.slice(summaryIdx + 1) : [];
  const potLine = summaryLines.find((l) => /Total pot/i.test(l));
  const potMatch = potLine?.match(/Total pot \$?([\d,.]+)/i);
  const rakeMatch = potLine?.match(/Rake \$?([\d,.]+)/i);
  const potSize = potMatch ? parseFloat((potMatch[1] as string).replace(/,/g, '')) : undefined;
  const rake = rakeMatch ? parseFloat((rakeMatch[1] as string).replace(/,/g, '')) : undefined;

  let heroResult: { won: boolean; amount?: number } | undefined;
  if (heroName) {
    const heroSummaryLine = summaryLines.find((l) => l.includes(heroName as string));
    if (heroSummaryLine) {
      const collectedMatch = heroSummaryLine.match(/collected \(?\$?([\d,.]+)\)?/i);
      if (collectedMatch) {
        heroResult = { won: true, amount: parseFloat((collectedMatch[1] as string).replace(/,/g, '')) };
      } else if (/won/i.test(heroSummaryLine)) {
        heroResult = { won: true };
      } else {
        heroResult = { won: false };
      }
    }
  }

  const buttonSeat = buttonSeatMatch ? parseInt(buttonSeatMatch[1] as string, 10) : undefined;
  const heroPosition =
    heroName && buttonSeat !== undefined && seats.length > 0 ? computePosition(seats, buttonSeat, heroName) : undefined;

  return {
    format,
    handId: handIdMatch?.[1],
    gameType: gameTypeMatch?.[1]?.trim(),
    stakes: stakesMatch?.[1]?.trim(),
    dateTime: dateTimeMatch?.[1]?.trim(),
    tableName: tableNameMatch?.[1],
    maxSeats: maxSeatsMatch ? parseInt(maxSeatsMatch[1] as string, 10) : undefined,
    buttonSeat,
    seats,
    heroName,
    heroCards,
    heroPosition,
    board,
    actions,
    potSize,
    rake,
    heroResult,
    raw: text,
  };
}

/**
 * Splits a multi-hand paste into individual hands (blank-line separated, per the common export
 * format) and parses each. Hands that fail to parse are skipped rather than surfaced, since the
 * bulk entry point favors "extract everything parseable" over strict validation.
 */
export function parseBulkHandHistories(text: string): ParsedHand[] {
  const rawBlocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  // A blank line can also appear *inside* a single hand (e.g. right before the summary), so
  // merge any block that doesn't start with a new hand header back into the previous block.
  const merged: string[] = [];
  const newHandHeaderRe = /Hand #\d/i;
  for (const block of rawBlocks) {
    if (merged.length === 0 || newHandHeaderRe.test(block.split(/\r?\n/)[0] ?? '')) {
      merged.push(block);
    } else {
      const lastIndex = merged.length - 1;
      merged[lastIndex] = `${merged[lastIndex] ?? ''}\n\n${block}`;
    }
  }

  const hands: ParsedHand[] = [];
  for (const block of merged) {
    const result = parseHandHistory(block);
    if (!('error' in result)) hands.push(result);
  }
  return hands;
}
