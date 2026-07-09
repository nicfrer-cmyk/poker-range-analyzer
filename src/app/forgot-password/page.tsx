import Link from "next/link";
import { requestPasswordReset } from "@/lib/supabase/auth-actions";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";

export default async function ForgotPasswordPage(
  props: {
    searchParams: Promise<{ sent?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    await requestPasswordReset(email);
    const { redirect } = await import("next/navigation");
    redirect("/forgot-password?sent=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-sm">
        <PanelBody className="space-y-5">
          <div className="text-center">
            <span className="text-2xl">♠</span>
            <h1 className="mt-2 text-lg font-semibold">שחזור סיסמה</h1>
            <p className="mt-1 text-xs text-base-muted">
              הזן את כתובת המייל ונשלח לך קישור לאיפוס הסיסמה.
            </p>
          </div>

          {searchParams.sent ? (
            <p className="rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm text-base-text">
              אם קיים חשבון עם כתובת האימייל הזו, נשלח אליה קישור לאיפוס סיסמה. בדוק/י גם
              בתיקיית הספאם.
            </p>
          ) : (
            <form action={action} className="space-y-3">
              <input
                name="email"
                type="email"
                required
                placeholder="אימייל"
                className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <Button type="submit" className="w-full">
                שליחת קישור לאיפוס
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-base-muted">
            <Link href="/login" className="text-accent-soft">
              חזרה להתחברות
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
