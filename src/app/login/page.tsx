import Link from "next/link";
import { signInWithEmail, signInWithOAuth } from "@/lib/supabase/auth-actions";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";

/** Only ever follow a same-origin relative path from `?next=` — never redirect to an
 *  absolute/external URL supplied by the query string (open-redirect protection). */
function safeNextPath(next: string | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/"; // protocol-relative URL guard
  if (next.includes("://")) return "/";
  return next;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; message?: string };
}) {
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const next = safeNextPath(String(formData.get("next") ?? ""));
    // One-shot flag so AppShell can show a brief "welcome back" toast right after login.
    const redirectTo = `${next}${next.includes("?") ? "&" : "?"}justLoggedIn=1`;
    const result = await signInWithEmail(email, password, redirectTo);
    if (result.error) {
      const { redirect } = await import("next/navigation");
      const params = new URLSearchParams({ error: result.error });
      if (next !== "/") params.set("next", next);
      redirect(`/login?${params.toString()}`);
    }
  }

  async function googleAction() {
    "use server";
    await signInWithOAuth("google");
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
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-base-muted">
                {/* Supabase JS (@supabase/ssr 0.4.0, the version installed here) always persists
                    the session and always writes a 1-year session cookie regardless of what
                    `auth.persistSession` / `cookieOptions.maxAge` is passed at sign-in time —
                    both are hardcoded internally (see createBrowserClient.js / cookies.js).
                    There is no version-correct way to make an individual sign-in session-only
                    without hand-rolling a custom cookie storage adapter, which is a bigger
                    change than Phase 1 warrants. This checkbox is left default-checked and
                    currently does not change behavior either way — revisit if/when the
                    @supabase/ssr version changes. */}
                <input type="checkbox" name="rememberMe" defaultChecked className="h-3.5 w-3.5" />
                זכור אותי
              </label>
              <Link href="/forgot-password" className="text-accent-soft">
                שכחתי סיסמה
              </Link>
            </div>
            <Button type="submit" className="w-full">
              התחבר
            </Button>
          </form>
          <form action={googleAction}>
            <Button type="submit" variant="secondary" className="w-full">
              המשך עם גוגל
            </Button>
          </form>
          <p className="text-center text-xs text-base-muted">
            אין לך חשבון?{" "}
            <Link href="/signup" className="text-accent-soft">
              הרשמה
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
