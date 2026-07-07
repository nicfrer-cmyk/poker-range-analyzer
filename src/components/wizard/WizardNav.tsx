import { Button } from "@/components/ui/Button";

export function WizardNav({
  step,
  totalSteps,
  canGoNext,
  onBack,
  onNext,
  nextLabel,
}: {
  step: number;
  totalSteps: number;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between border-t border-base-border pt-4">
      <Button variant="ghost" onClick={onBack} disabled={step === 1}>
        חזרה
      </Button>
      {step < totalSteps && (
        <Button onClick={onNext} disabled={!canGoNext}>
          {nextLabel ?? "המשך"}
        </Button>
      )}
    </div>
  );
}
