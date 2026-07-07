import Link from "next/link";
import { signUpWithEmail, signInWithOAuth } from "@/lib/supabase/auth-actions";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const consent = formData.get("consent");
    if (!consent) {
      const { redirect } = await import("next/navigation");
      redirect(`/signup?error=${encodeURIComponent("Please accept the Terms and Privacy Policy.")}`);
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
            <h1 className="mt-2 text-lg font-semibold">Create your account</h1>
            <p className="mt-1 text-xs text-base-muted">
              Free plan included — no card required.
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
              placeholder="Email"
              className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Password (min 8 characters)"
              className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <label className="flex items-start gap-2 text-xs text-base-muted">
              <input type="checkbox" name="consent" required className="mt-0.5" />
              I agree to the Terms of Service and Privacy Policy.
            </label>
            <Button type="submit" className="w-full">
              Create Account
            </Button>
          </form>
          <form action={googleAction}>
            <Button type="submit" variant="secondary" className="w-full">
              Continue with Google
            </Button>
          </form>
          <p className="text-center text-xs text-base-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-accent-soft">
              Sign in
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
