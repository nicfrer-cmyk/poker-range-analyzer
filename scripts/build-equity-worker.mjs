// ---------------------------------------------------------------------------
// Bundles src/lib/engine/equity.worker.ts into public/equity-worker.js — a self-contained IIFE
// with every import (calculateEquity + its own transitive deps: range parsing, hand evaluator,
// deck utilities, types) inlined into one flat script. Runs as a `predev`/`prebuild` step (see
// package.json) so the generated file is always in sync with the engine source; the output
// itself is gitignored, not committed.
//
// Why not let Next.js/Turbopack bundle the worker directly: see equity.worker.ts's header
// comment — Turbopack currently treats `new Worker(new URL("./file.ts", import.meta.url))` as a
// generic static-asset reference and copies the raw source verbatim instead of compiling it, so
// a worker built that way fails at runtime. `format: "iife"` here sidesteps that entirely: the
// output is loaded via a plain `new Worker("/equity-worker.js")` public URL, outside Turbopack's
// module graph, with no ES-module import resolution needed at runtime either.
// ---------------------------------------------------------------------------

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [path.join(rootDir, "src/lib/engine/equity.worker.ts")],
  outfile: path.join(rootDir, "public/equity-worker.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  logLevel: "info",
});
