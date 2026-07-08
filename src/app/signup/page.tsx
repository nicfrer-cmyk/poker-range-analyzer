import Link from "next/link";
import { signUpWithEmail, signInWithOAuth } from "@/lib/supabase/auth-actions";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { PasswordField } from "@/components/auth/PasswordField";
import { track } from "@/lib/analytics";

export default async function SignupPage(
  props: {
    searchParams: Promise<{ error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  async function action(formData: FormData) {
    "use server";
    // Fires once per real submit attempt (this only runs on an actual form POST, never on
    // render). `signup_completed` isn't tracked here — `signUpWithEmail` redirects internally on
    // success, so this function never regains control in that case; see AuthSync.tsx instead.
    track("signup_started");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const consent = formData.get("consent");
    if (!consent) {
      const { redirect } = await import("next/navigation");
      redirect(`/signup?error=${encodeURIComponent("יש לאשר את תנאי השימוש ומדיניות הפרטיות.")}`);
    }
    const result = await signUpWithEmail(email, password);
    if (result.error) {
      const { redirect } = await import("next/navigation");
      redirect(`/signup?error=${encodeURIComponent(result.error)}`);
    }
  }

  async function googleAction() {
    "use server";
    await signInWithOAuth("google");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-sm">
        <PanelBody className="space-y-5">
          <div className="text-center">
            <span className="text-2xl">♠</span>
            <h1 className="mt-2 text-lg font-semibold">יצירת חשבון</h1>
            <p className="mt-1 text-xs text-base-muted">
              כולל מסלול חינמי — לא נדרש כרטיס אשראי.
            </p>
          </div>
          {searchParams.error && (
            <p className="rounded-lg border border-status-behind/40 bg-status-behind/10 px-3 py-2 text-xs text-status-behind">
              {searchParams.error}
            </p>
          )}
          <form action={action} className="space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="אימייל"
              className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <PasswordField minLength={8} placeholder="סיסמה (לפחות 8 תווים)" />
            <label className="flex items-start gap-2 text-xs text-base-muted">
              <input type="checkbox" name="consent" required className="mt-0.5" />
              אני מאשר/ת את תנאי השימוש ומדיניות הפרטיות.
            </label>
            <Button type="submit" className="w-full">
              צור חשבון
            </Button>
          </form>
          <form action={googleAction}>
            <Button type="submit" variant="secondary" className="w-full">
              המשך עם גוגל
            </Button>
          </form>
          <p className="text-center text-xs text-base-muted">
            כבר יש לך חשבון?{" "}
            <Link href="/login" className="text-accent-soft">
              התחברות
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
