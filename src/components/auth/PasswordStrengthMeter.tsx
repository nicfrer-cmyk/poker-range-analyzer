"use client";

export type PasswordStrength = "weak" | "medium" | "strong";

/** Small client-side heuristic — length + character variety. No external library, and this
 *  is purely a UX nudge, not a real security gate (the server still enforces `minLength`). */
export function computePasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

const LABEL: Record<PasswordStrength, string> = {
  weak: "חלשה",
  medium: "בינונית",
  strong: "חזקה",
};

const BAR_CLASS: Record<PasswordStrength, string> = {
  weak: "w-1/3 bg-status-behind",
  medium: "w-2/3 bg-status-risky",
  strong: "w-full bg-status-ahead",
};

const TEXT_CLASS: Record<PasswordStrength, string> = {
  weak: "text-status-behind",
  medium: "text-status-risky",
  strong: "text-status-ahead",
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = computePasswordStrength(password);
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-panel2">
        <div className={`h-full rounded-full transition-all duration-150 ${BAR_CLASS[strength]}`} />
      </div>
      <p className={`text-xs ${TEXT_CLASS[strength]}`}>חוזק סיסמה: {LABEL[strength]}</p>
    </div>
  );
}
