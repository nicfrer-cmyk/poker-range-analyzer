"use client";

import { useState } from "react";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

/** A password `<input>` (submits via native FormData like any other field — the surrounding
 *  form's server action doesn't need to change) plus a live strength indicator below it. */
export function PasswordField({
  name = "password",
  minLength,
  placeholder,
}: {
  name?: string;
  minLength?: number;
  placeholder: string;
}) {
  const [password, setPassword] = useState("");
  return (
    <div className="space-y-1.5">
      <input
        name={name}
        type="password"
        required
        minLength={minLength}
        placeholder={placeholder}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-base-border bg-base-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <PasswordStrengthMeter password={password} />
    </div>
  );
}
