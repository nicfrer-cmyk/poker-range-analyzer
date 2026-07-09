"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelHeader, PanelTitle, PanelBody } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { clearAppCaches } from "@/lib/clearAppCaches";

const CONFIRM_WORD = "מחק";

/**
 * Account-deletion flow: types the confirm word, POSTs /api/account/delete (deletes every DB
 * row + the Supabase Auth user server-side), then clears cached pages, signs out locally, and
 * lands on /login with a status message — same message-query convention login/page.tsx already
 * renders for password-reset success.
 */
export function DangerZone() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "מחיקת החשבון נכשלה. נסה/י שוב.");
        setDeleting(false);
        return;
      }

      await clearAppCaches();

      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // The Auth user is already deleted server-side at this point — a local signOut error
        // just means there's nothing left to sign out of. Safe to ignore either way.
      }

      router.push(`/login?message=${encodeURIComponent("החשבון נמחק בהצלחה.")}`);
    } catch {
      setError("אירעה שגיאה בלתי צפויה. נסה/י שוב.");
      setDeleting(false);
    }
  };

  return (
    <Panel className="border-status-behind/40">
      <PanelHeader>
        <PanelTitle className="text-status-behind">מחיקת חשבון</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <p className="text-sm text-base-muted">
          מוחק לצמיתות את החשבון שלך ואת כל הנתונים המשויכים אליו בענן — ידיים, טווחים, סשנים,
          פרופילי יריבים ומנוי. לא ניתן לבטל פעולה זו.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-base-muted">
            כדי לאשר, הקלד/י את המילה &quot;{CONFIRM_WORD}&quot;:
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-status-behind"
            placeholder={CONFIRM_WORD}
            disabled={deleting}
          />
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={confirmText !== CONFIRM_WORD || deleting}
        >
          {deleting ? "מוחק חשבון…" : "מחיקת החשבון לצמיתות"}
        </Button>
        {error && <p className="text-sm text-status-behind">{error}</p>}
      </PanelBody>
    </Panel>
  );
}
