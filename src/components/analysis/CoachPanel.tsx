import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/Panel";

export function CoachPanel({ messages }: { messages: string[] }) {
  return (
    <Panel className="border-accent/30 bg-gradient-to-br from-accent/10 to-transparent">
      <PanelHeader className="border-accent/20">
        <PanelTitle>The Coach</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-2">
        {messages.map((m, i) => (
          <p key={i} className="text-sm leading-relaxed text-base-text/90">
            {m}
          </p>
        ))}
      </PanelBody>
    </Panel>
  );
}
