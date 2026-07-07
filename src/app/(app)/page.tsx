"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { Badge, equityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { listHands, type StoredHand } from "@/lib/localHandStore";
import { computeSessionStats, topLeaks } from "@/lib/engine/leakFinder";

export default function DashboardPage() {
  const [hands, setHands] = useState<StoredHand[]>([]);

  useEffect(() => {
    setHands(listHands());
  }, []);

  const stats = useMemo(() => computeSessionStats(hands), [hands]);
  const leaks = useMemo(() => topLeaks(hands, 3), [hands]);
  const recent = hands.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-base-muted">
          Post-game analysis only — pick a hand, see where you stood, and learn what to do
          differently next time.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/analyze">
          <Button>New Analysis</Button>
        </Link>
        <Link href="/hands/import">
          <Button variant="secondary">Import Hand History</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">Hands analyzed</p>
            <p className="text-2xl font-bold">{stats.handCount}</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">Avg equity</p>
            <p className="text-2xl font-bold">
              {stats.handCount ? `${(stats.avgEquity * 100).toFixed(1)}%` : "—"}
            </p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">Good decisions</p>
            <p className="text-2xl font-bold text-status-ahead">
              {stats.handCount ? `${(stats.goodDecisionRate * 100).toFixed(0)}%` : "—"}
            </p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <p className="text-xs text-base-muted">Top leaks found</p>
            <p className="text-2xl font-bold text-status-behind">{leaks.length}</p>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Recent Analyses</PanelTitle>
            <Link href="/hands" className="text-xs text-accent-soft">
              View all
            </Link>
          </PanelHeader>
          <PanelBody className="space-y-3">
            {recent.length === 0 ? (
              <p className="text-sm text-base-muted">No hands yet — run your first analysis.</p>
            ) : (
              recent.map((h) => (
                <div key={h.id} className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {h.heroCards.map((c, i) => (
                      <PlayingCard key={i} card={c} size="xs" />
                    ))}
                  </div>
                  <Badge tone={equityTone(h.equityAtDecision * 100)}>
                    {(h.equityAtDecision * 100).toFixed(0)}%
                  </Badge>
                  <span className="text-xs text-base-muted">
                    {h.handCategory?.replace(/-/g, " ")} · {h.street}
                  </span>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Top Leaks</PanelTitle>
            <Link href="/session" className="text-xs text-accent-soft">
              Full report
            </Link>
          </PanelHeader>
          <PanelBody className="space-y-2">
            {leaks.length === 0 ? (
              <p className="text-sm text-base-muted">
                Save a few more hands to unlock leak detection.
              </p>
            ) : (
              leaks.map((leak) => (
                <div
                  key={`${leak.dimension}-${leak.key}`}
                  className="flex items-center justify-between rounded-lg border border-base-border px-3 py-2"
                >
                  <span className="text-sm">
                    {leak.dimension}: <b>{leak.key}</b>
                  </span>
                  <span className="text-xs text-base-muted">{leak.count} hands</span>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>More Tools</PanelTitle>
        </PanelHeader>
        <PanelBody className="flex flex-wrap gap-2">
          {[
            { href: "/range-vs-range", label: "Range vs Range" },
            { href: "/icm", label: "ICM Calculator" },
            { href: "/ai-review", label: "AI Hand Review" },
            { href: "/bankroll", label: "Bankroll Tracker" },
          ].map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <Button variant="secondary" size="sm">
                {tool.label}
              </Button>
            </Link>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
