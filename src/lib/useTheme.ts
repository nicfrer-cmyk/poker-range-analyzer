"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "pra:theme";

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Light is the app's default and primary design — this toggle is an extra option for users
 *  who prefer dark, not a redesign of the default experience. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") setThemeState(stored);
  }, []);

  const setTheme = (t: Theme) => {
    window.localStorage.setItem(KEY, t);
    apply(t);
    setThemeState(t);
  };

  return [theme, setTheme];
}
