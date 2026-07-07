import { Panel, PanelBody } from "@/components/ui/Panel";

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-sm text-center">
        <PanelBody className="space-y-2 py-8">
          <span className="text-2xl">✉️</span>
          <h1 className="text-lg font-semibold">Check your email</h1>
          <p className="text-sm text-base-muted">
            We sent a confirmation link — click it to finish creating your account.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
