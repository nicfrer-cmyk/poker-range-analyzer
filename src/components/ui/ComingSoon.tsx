import { Panel, PanelBody } from "./Panel";
import { Badge } from "./Badge";

export function ComingSoon({
  title,
  description,
  wave,
}: {
  title: string;
  description: string;
  wave: string;
}) {
  return (
    <Panel className="mx-auto mt-10 max-w-xl text-center">
      <PanelBody className="space-y-4 py-10">
        <Badge tone="neutral">{wave}</Badge>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm leading-relaxed text-base-muted">{description}</p>
      </PanelBody>
    </Panel>
  );
}
