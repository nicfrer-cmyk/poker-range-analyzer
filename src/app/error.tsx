"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";

export default function ErrorPage({
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-sm">
        <PanelBody className="space-y-4 text-center">
          <span className="text-2xl">⚠️</span>
          <h1 className="text-lg font-semibold">משהו השתבש</h1>
          <p className="text-sm text-base-muted">
            אירעה שגיאה בלתי צפויה. אפשר לנסות שוב, ואם זה חוזר — לפנות אלינו לתמיכה.
          </p>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => reset()}>
              נסה שוב
            </Button>
            <Link href="/">
              <Button variant="secondary" className="w-full">
                חזרה לעמוד הראשי
              </Button>
            </Link>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
