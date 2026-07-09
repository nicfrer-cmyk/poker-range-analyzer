"use client";

// Only fires when the root layout itself throws — a distinct, rarer case from error.tsx (which
// handles errors in a page/segment while the root layout is still intact). This file replaces
// the entire document, so it has to supply its own <html>/<body> instead of relying on
// src/app/layout.tsx.

import { useEffect } from "react";
import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen font-sans">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-4 rounded-panel border border-base-border bg-base-panel p-4 text-center shadow-soft">
            <span className="text-2xl">⚠️</span>
            <h1 className="text-lg font-semibold text-base-text">משהו השתבש</h1>
            <p className="text-sm text-base-muted">
              אירעה שגיאה בלתי צפויה באפליקציה. אפשר לנסות שוב.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-glow hover:bg-accent-soft"
              >
                נסה שוב
              </button>
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-base-border bg-base-panel2 px-4 py-2 text-sm font-medium text-base-text hover:border-accent/60"
              >
                חזרה לעמוד הראשי
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
