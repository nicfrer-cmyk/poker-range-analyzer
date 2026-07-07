"use client";

import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useMockPlan } from "@/lib/useMockPlan";

export default function SettingsPage() {
  const [plan, setPlan] = useMockPlan();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Panel>
        <PanelHeader>
          <PanelTitle>Plan</PanelTitle>
          <Badge tone={plan === "PRO" ? "ahead" : "neutral"}>{plan}</Badge>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <p className="text-sm text-base-muted">
            Until real billing is connected, use this switch to preview Free vs Pro gating
            locally.
          </p>
          <div className="flex gap-2">
            <Button variant={plan === "FREE" ? "primary" : "secondary"} size="sm" onClick={() => setPlan("FREE")}>
              Free
            </Button>
            <Button variant={plan === "PRO" ? "primary" : "secondary"} size="sm" onClick={() => setPlan("PRO")}>
              Pro
            </Button>
            <Link href="/billing">
              <Button variant="ghost" size="sm">
                Manage subscription →
              </Button>
            </Link>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>About this product</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2 text-sm text-base-muted">
          <p>Post-game analysis only — there is no live-play assistance in this product, by design.</p>
          <p>
            All hand data you save is stored locally in this browser until you connect a
            Supabase project (see the project ROADMAP for setup steps).
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
