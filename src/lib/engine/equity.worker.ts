// ---------------------------------------------------------------------------
// Equity calculation Web Worker — source file.
//
// Not consumed directly by Next.js/Turbopack: `new Worker(new URL("./equity.worker.ts", ...))`
// was tried first, but this Next.js/Turbopack version treats that pattern as a generic static
// asset reference (like importing an image) and just copies the raw, un-transpiled file to
// `_next/static/media/`, imports and all — it does not bundle it into a runnable script (see
// https://github.com/vercel/next.js/discussions/59729). Instead, scripts/build-equity-worker.mjs
// bundles this file with esbuild into public/equity-worker.js (a real, dependency-free IIFE
// script — see that script's own comment) as a `predev`/`prebuild` step; equityWorkerClient.ts
// loads that generated public file via a plain `new Worker("/equity-worker.js")` URL, which
// isn't part of Turbopack's module graph at all.
//
// `calculateEquity` (equity.ts) is pure, allocation-heavy Monte Carlo work with no DOM/React
// dependency, which is exactly what a Web Worker is for — the heavy range-vs-range aggregate +
// distribution sampling, and the range-explorer single-combo lookup, were both running
// synchronously on the main thread and could visibly block the UI for a moment.
// ---------------------------------------------------------------------------

import { calculateEquity } from "./equity";
import type { EquityWorkerRequest, EquityWorkerResponse } from "./equityWorkerClient";

const ctx = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<EquityWorkerRequest>) => {
  const { id, inputs } = event.data;
  try {
    const results = inputs.map((input) => calculateEquity(input));
    const response: EquityWorkerResponse = { id, results };
    ctx.postMessage(response);
  } catch (err) {
    const response: EquityWorkerResponse = {
      id,
      error: err instanceof Error ? err.message : "Unknown equity worker error",
    };
    ctx.postMessage(response);
  }
};
