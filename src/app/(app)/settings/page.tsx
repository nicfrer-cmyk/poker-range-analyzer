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
      <h1 className="text-2xl font-semibold">הגדרות</h1>

      <Panel>
        <PanelHeader>
          <PanelTitle>תוכנית</PanelTitle>
          <Badge tone={plan === "PRO" ? "ahead" : "neutral"}>{plan === "PRO" ? "פרו" : "חינמי"}</Badge>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <p className="text-sm text-base-muted">
            עד שהחיוב האמיתי יחובר, אפשר להשתמש במתג הזה כדי להדגים באופן מקומי את ההבדל בין
            חינמי לפרו.
          </p>
          <div className="flex gap-2">
            <Button variant={plan === "FREE" ? "primary" : "secondary"} size="sm" onClick={() => setPlan("FREE")}>
              חינמי
            </Button>
            <Button variant={plan === "PRO" ? "primary" : "secondary"} size="sm" onClick={() => setPlan("PRO")}>
              פרו
            </Button>
            <Link href="/billing">
              <Button variant="ghost" size="sm">
                ניהול המנוי ←
              </Button>
            </Link>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>על המוצר</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2 text-sm text-base-muted">
          <p>ניתוח לאחר המשחק בלבד — אין בכלי הזה סיוע בזמן אמת במשחק, בכוונה תחילה.</p>
          <p>
            כל נתוני הידיים שאתה שומר מאוחסנים מקומית בדפדפן הזה, עד שתחבר פרויקט Supabase (ראה
            את מסמך ה-ROADMAP של הפרויקט לשלבי ההתקנה).
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
