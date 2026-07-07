import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";

export function WhatChanged({ items }: { items: string[] }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>What Changed?</PanelTitle>
      </PanelHeader>
      <PanelBody>
        {items.length === 0 ? (
          <p className="text-sm text-base-muted">No street change yet — this is the flop or preflop.</p>
        ) : (
          <ul className="space-y-2 text-sm text-base-text/90">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent-soft">›</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
