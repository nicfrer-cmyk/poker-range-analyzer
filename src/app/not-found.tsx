import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/ui/Panel";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Panel className="w-full max-w-sm">
        <PanelBody className="space-y-4 text-center">
          <span className="text-2xl">🔍</span>
          <h1 className="text-lg font-semibold">הדף לא נמצא</h1>
          <p className="text-sm text-base-muted">
            הכתובת שביקשת לא קיימת, או שהוסרה.
          </p>
          <Link href="/">
            <Button className="w-full">חזרה לעמוד הראשי</Button>
          </Link>
        </PanelBody>
      </Panel>
    </div>
  );
}
