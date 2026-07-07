import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Every value is a CSS variable holding space-separated RGB channels (defined for
        // both :root and .dark in globals.css), wrapped in rgb(... / <alpha-value>) so
        // Tailwind's opacity modifiers (e.g. bg-base-panel/60) keep working. This is what
        // lets the light/dark toggle in Settings restyle the whole app without touching any
        // component file — only globals.css's two variable blocks need to change.
        base: {
          bg: "rgb(var(--color-base-bg) / <alpha-value>)",
          panel: "rgb(var(--color-base-panel) / <alpha-value>)",
          panel2: "rgb(var(--color-base-panel2) / <alpha-value>)",
          border: "rgb(var(--color-base-border) / <alpha-value>)",
          text: "rgb(var(--color-base-text) / <alpha-value>)",
          muted: "rgb(var(--color-base-muted) / <alpha-value>)",
        },
        status: {
          crushing: "rgb(var(--color-status-crushing) / <alpha-value>)",
          ahead: "rgb(var(--color-status-ahead) / <alpha-value>)",
          close: "rgb(var(--color-status-close) / <alpha-value>)",
          risky: "rgb(var(--color-status-risky) / <alpha-value>)",
          behind: "rgb(var(--color-status-behind) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          soft: "rgb(var(--color-accent-soft) / <alpha-value>)",
        },
        card: {
          red: "#D6303C",
          black: "#1A1D24",
        },
      },
      fontFamily: {
        sans: ["var(--font-heebo)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        panel: "14px",
      },
      boxShadow: {
        soft: "0 2px 12px -2px rgba(20,24,32,0.08), 0 1px 2px rgba(20,24,32,0.04)",
        glow: "0 0 20px -4px rgba(91,91,224,0.35)",
      },
      keyframes: {
        "count-glow": {
          "0%": { opacity: "0.4" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "count-glow": "count-glow 0.6s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
