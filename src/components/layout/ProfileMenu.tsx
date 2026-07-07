"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/supabase/auth-actions";

/**
 * Small profile/account menu shown next to the notification bell in AppShell's header row.
 * Reads the current user the same way the dashboard and /settings do (createClient() +
 * supabase.auth.getUser()), and signs out via the same signOut() server action /settings uses —
 * no separate auth-reading or sign-out mechanism invented here.
 */
export function ProfileMenu() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        const user = data.user;
        if (!user) return;
        const metaName =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null;
        const emailLocalPart = user.email ? user.email.split("@")[0] ?? null : null;
        setDisplayName(metaName || emailLocalPart);
        setEmail(user.email ?? null);
      });
    } catch {
      // Supabase not configured yet (local dev) — nothing to show.
    }
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const initial = (displayName ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="תפריט משתמש"
        className="flex h-9 items-center gap-2 rounded-full border border-base-border bg-base-panel2 ps-2 pe-3 text-base-muted transition-colors hover:bg-base-panel2/70 hover:text-base-text"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="max-w-[8rem] truncate text-xs">{displayName ?? "החשבון שלי"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-50 mt-2 w-64 max-w-[90vw]">
            <Panel className="overflow-hidden">
              <PanelBody className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-base-text">{displayName ?? "משתמש/ת"}</p>
                  {email && <p className="text-xs text-base-muted">{email}</p>}
                </div>
                <div className="space-y-2 border-t border-base-border pt-3">
                  <Link href="/settings" onClick={() => setOpen(false)} className="block">
                    <Button variant="secondary" size="sm" className="w-full">
                      הגדרות
                    </Button>
                  </Link>
                  <Button variant="danger" size="sm" className="w-full" onClick={handleSignOut} disabled={signingOut}>
                    {signingOut ? "מתנתק/ת…" : "התנתקות"}
                  </Button>
                </div>
              </PanelBody>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
