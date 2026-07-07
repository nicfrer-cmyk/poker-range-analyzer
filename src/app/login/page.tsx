import Link from "next/link";
import { signInWithEmail, signInWithOAuth } from "@/lib/supabase/auth-actions";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const result = await signInWithEmail(email, password);
    if (result.error) {
      const { redirect } = await import("next/navigation");
      redirect(`/login?error=${encodeURIComponent(result.error)}`);
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
            <h1 className="mt-2 text-lg font-semibold">Sign in to Poker Range Analyzer</h1>
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
              placeholder="Password"
              className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
          <form action={googleAction}>
            <Button type="submit" variant="secondary" className="w-full">
              Continue with Google
            </Button>
          </form>
          <p className="text-center text-xs text-base-muted">
            No account?{" "}
            <Link href="/signup" className="text-accent-soft">
              Sign up
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
