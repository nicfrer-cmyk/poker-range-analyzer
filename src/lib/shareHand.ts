import type { StoredHand } from "@/lib/localHandStore";
import type { DecisionStreet, ActionTaken } from "@/lib/engine/leakFinder";

/**
 * Minimal, self-contained snapshot of a hand embedded directly into a share URL. Trimmed down
 * from the full `StoredHand` — no id/timestamp/tags/source/opponentId/sessionId/userId or
 * street-by-street action log, none of which are meaningful (or, for the action log, small
 * enough) to carry in a URL. There is no backend for hand data today (it's all localStorage),
 * so the shared link must be fully self-contained rather than a lookup by id.
 */
export interface SharedHandPayload {
  heroCards: string[];
  board: string[];
  position?: string;
  potSize: number;
  street: DecisionStreet;
  equityAtDecision: number;
  actionTaken: ActionTaken;
  evLossEstimate: number;
  handCategory?: string;
  villainRange?: string;
  note?: string;
}

export function toSharedPayload(hand: StoredHand): SharedHandPayload {
  return {
    heroCards: hand.heroCards,
    board: hand.board,
    position: hand.position,
    potSize: hand.potSize,
    street: hand.street,
    equityAtDecision: hand.equityAtDecision,
    actionTaken: hand.actionTaken,
    evLossEstimate: hand.evLossEstimate,
    handCategory: hand.handCategory,
    villainRange: hand.villainRange,
    note: hand.note,
  };
}

/** Rehydrates a trimmed shared payload into a `StoredHand`-shaped object so the read-only shared
 *  page can reuse the same components (HandReplayPlayer, mistake-tag badges, ...) as the app. */
export function sharedPayloadToStoredHand(payload: SharedHandPayload): StoredHand {
  return {
    id: "shared",
    heroCards: payload.heroCards as StoredHand["heroCards"],
    board: payload.board as StoredHand["board"],
    villainRange: payload.villainRange,
    villainRangeTextRaw: payload.villainRange ?? "",
    position: payload.position,
    potSize: payload.potSize,
    street: payload.street,
    equityAtDecision: payload.equityAtDecision,
    potOddsRequired: 0,
    actionTaken: payload.actionTaken,
    evLossEstimate: payload.evLossEstimate,
    timestamp: Date.now(),
    handCategory: payload.handCategory,
    tags: [],
    source: "manual",
    note: payload.note,
  };
}

/** UTF-8 safe base64url encode — plain `btoa(json)` throws on non-Latin1 chars (Hebrew notes),
 *  and base64url (`-`/`_`, no padding) avoids `/` and `+` showing up inside a URL path segment. */
function encodeUtf8Base64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeUtf8Base64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSharedHand(hand: StoredHand): string {
  return encodeUtf8Base64Url(JSON.stringify(toSharedPayload(hand)));
}

/** Returns `null` (rather than throwing) on any malformed/tampered link, so the shared page can
 *  show a friendly "invalid link" state instead of crashing. */
export function decodeSharedHand(encoded: string): StoredHand | null {
  try {
    const payload = JSON.parse(decodeUtf8Base64Url(encoded)) as SharedHandPayload;
    if (!Array.isArray(payload.heroCards) || !Array.isArray(payload.board)) return null;
    return sharedPayloadToStoredHand(payload);
  } catch {
    return null;
  }
}

export function buildShareUrl(hand: StoredHand): string {
  const encoded = encodeSharedHand(hand);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/shared/${encoded}`;
}
