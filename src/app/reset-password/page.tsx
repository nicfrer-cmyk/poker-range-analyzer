"use client";

// ---------------------------------------------------------------------------
// This page is reached by clicking the emailed reset link (from
// `requestPasswordReset` in auth-actions.ts, which sets
// `redirectTo: <origin>/reset-password`). Supabase encodes a one-time
// recovery session in the URL (as a `#access_token=...` hash or a `?code=...`
// query param depending on flow type) — that only exists in the browser, so
// this has to be a Client Component: constructing the Supabase browser client
// (`createClient()`) triggers `detectSessionInUrl`, which parses the link and
// persists the resulting session via cookies *before* the form below submits
// its Server Action (which reads the session from those same cookies).
// ---------------------------------------------------------------------------

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { updatePassword } from "@/lib/supabase/auth-actions";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

type LinkStatus = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setStatus("invalid");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStatus(data.session ? "ready" : "invalid");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setStatus("ready");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePassword(password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-sm">
        <PanelBody className="space-y-5">
          <div className="text-center">
            <span className="text-2xl">♠</span>
            <h1 className="mt-2 text-lg font-semibold">קביעת סיסמה חדשה</h1>
          </div>

          {status === "checking" && (
            <p className="text-center text-sm text-base-muted">בודק את הקישור…</p>
          )}

          {status === "invalid" && (
            <div className="space-y-3 text-center">
              <p className="rounded-lg border border-status-behind/40 bg-status-behind/10 px-3 py-2 text-sm text-status-behind">
                הקישור אינו תקף או שפג תוקפו.
              </p>
              <Link href="/forgot-password" className="text-xs text-accent-soft">
                בקשת קישור חדש
              </Link>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <p className="rounded-lg border border-status-behind/40 bg-status-behind/10 px-3 py-2 text-xs text-status-behind">
                  {error}
                </p>
              )}
              <div className="space-y-1.5">
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="סיסמה חדשה (לפחות 8 תווים)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <PasswordStrengthMeter password={password} />
              </div>
              <input
                type="password"
                required
                minLength={8}
                placeholder="אימות סיסמה חדשה"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "מעדכן…" : "עדכון סיסמה"}
              </Button>
            </form>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
