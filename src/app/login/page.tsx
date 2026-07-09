import Link from "next/link";
import { signInWithEmail, signInWithOAuth } from "@/lib/supabase/auth-actions";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { TurnstileField } from "@/components/auth/Turnstile";

/** Only ever follow a same-origin relative path from `?next=` — never redirect to an
 *  absolute/external URL supplied by the query string (open-redirect protection). */
function safeNextPath(next: string | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/"; // protocol-relative URL guard
  if (next.includes("://")) return "/";
  // A leading "/\" (or any backslash) is normalized to a forward slash by browsers' URL
  // parser, turning "/\evil.com" into a scheme-relative "//evil.com" redirect target after
  // this passes the checks above — reject backslashes outright rather than trying to keep
  // enumerating lookalike bypasses.
  if (next.includes("\\")) return "/";
  return next;
}

export default async function LoginPage(
  props: {
    searchParams: Promise<{ error?: string; next?: string; message?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const captchaToken = String(formData.get("captchaToken") ?? "");
    const next = safeNextPath(String(formData.get("next") ?? ""));
    // One-shot flag so AppShell can show a brief "welcome back" toast right after login.
    const redirectTo = `${next}${next.includes("?") ? "&" : "?"}justLoggedIn=1`;
    const result = await signInWithEmail(email, password, redirectTo, captchaToken || undefined);
    if (result.error) {
      const { redirect } = await import("next/navigation");
      const params = new URLSearchParams({ error: result.error });
      if (next !== "/") params.set("next", next);
      redirect(`/login?${params.toString()}`);
    }
  }

  async function googleAction(formData: FormData) {
    "use server";
    const next = safeNextPath(String(formData.get("next") ?? ""));
    await signInWithOAuth("google", next);
  }

  const next = safeNextPath(searchParams.next);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-sm">
        <PanelBody className="space-y-5">
          <div className="text-center">
            <span className="text-2xl">♠</span>
            <h1 className="mt-2 text-lg font-semibold">התחברות למנתח טווחי פוקר</h1>
          </div>
          {searchParams.message && (
            <p className="rounded-lg border border-status-ahead/40 bg-status-ahead/10 px-3 py-2 text-xs text-status-ahead">
              {searchParams.message}
            </p>
          )}
          {searchParams.error && (
            <p className="rounded-lg border border-status-behind/40 bg-status-behind/10 px-3 py-2 text-xs text-status-behind">
              {searchParams.error}
            </p>
          )}
          <form action={action} className="space-y-3">
            <input type="hidden" name="next" value={next} />
            <input
              name="email"
              type="email"
              required
              placeholder="אימייל"
              className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="סיסמה"
              className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex items-center justify-end text-xs">
              {/* No "remember me" control here on purpose: Supabase JS (@supabase/ssr 0.4.0,
                  the version installed here) always persists the session and always writes a
                  1-year session cookie regardless of any `persistSession`/`maxAge` option —
                  both are hardcoded internally. A checkbox that can't actually change that
                  behavior would just mislead users into thinking unchecking it logs them out
                  on browser close. Revisit if/when the @supabase/ssr version changes. */}
              <Link href="/forgot-password" className="text-accent-soft">
                שכחתי סיסמה
              </Link>
            </div>
            <TurnstileField />
            <Button type="submit" className="w-full">
              התחבר
            </Button>
          </form>
          <form action={googleAction}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="secondary" className="w-full">
              המשך עם גוגל
            </Button>
          </form>
          <p className="text-center text-xs text-base-muted">
            אין לך חשבון?{" "}
            <Link
              href={next !== "/" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
              className="text-accent-soft"
            >
              הרשמה
            </Link>
          </p>
          <p className="text-center text-xs text-base-muted">
            <Link href="/terms" className="text-accent-soft underline">
              תנאי שימוש
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="text-accent-soft underline">
              מדיניות פרטיות
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
