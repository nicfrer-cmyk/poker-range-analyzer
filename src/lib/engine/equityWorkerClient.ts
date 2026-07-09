// ---------------------------------------------------------------------------
// Browser-side client for equity.worker.ts — call `calculateEquityInWorker` /
// `calculateEquityBatchInWorker` from Client Components instead of importing
// `calculateEquity` directly, for any computation that isn't clearly instant (a single
// exact-enumeration turn/river lookup is fine on the main thread; a Monte Carlo aggregate or a
// multi-combo distribution sample is not).
//
// One lazily-created worker per tab, reused across calls; requests are matched to responses by
// an incrementing id so several in-flight calls (e.g. a user clicking "Calculate" again before
// the previous run finished) don't cross-resolve.
// ---------------------------------------------------------------------------

import type { EquityInput, EquityResult } from "./equity";

export interface EquityWorkerRequest {
  id: number;
  inputs: EquityInput[];
}

export interface EquityWorkerResponse {
  id: number;
  results?: EquityResult[];
  error?: string;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (results: EquityResult[]) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    // Loaded as a plain public URL, not `new URL("./equity.worker.ts", import.meta.url)` — see
    // equity.worker.ts's header comment for why that pattern doesn't work under this
    // Next.js/Turbopack version. public/equity-worker.js is generated from equity.worker.ts by
    // scripts/build-equity-worker.mjs (a predev/prebuild step), not written by hand.
    worker = new Worker("/equity-worker.js");
    worker.onmessage = (event: MessageEvent<EquityWorkerResponse>) => {
      const { id, results, error } = event.data;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (error) entry.reject(new Error(error));
      else entry.resolve(results ?? []);
    };
  }
  return worker;
}

/**
 * Runs a batch of `calculateEquity` calls off the main thread in a single worker round trip —
 * prefer this over N separate `calculateEquityInWorker` calls when computing several equities
 * at once (e.g. a range's per-combo distribution sample), since each call is a postMessage.
 * Falls back to running inline if Web Workers aren't available (should never happen from a
 * Client Component in a browser, but keeps this safe to call defensively).
 */
export function calculateEquityBatchInWorker(inputs: EquityInput[]): Promise<EquityResult[]> {
  if (inputs.length === 0) return Promise.resolve([]);
  if (typeof Worker === "undefined") {
    return import("./equity").then(({ calculateEquity }) => inputs.map((input) => calculateEquity(input)));
  }

  const id = nextId++;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: EquityWorkerRequest = { id, inputs };
    w.postMessage(request);
  });
}

/** Single-input convenience wrapper around `calculateEquityBatchInWorker`. */
export async function calculateEquityInWorker(input: EquityInput): Promise<EquityResult> {
  const [result] = await calculateEquityBatchInWorker([input]);
  return result as EquityResult;
}
