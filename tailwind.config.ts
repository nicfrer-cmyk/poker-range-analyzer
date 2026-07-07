import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#FFFFFF",
          panel: "#F8F9FB",
          panel2: "#EEF0F4",
          border: "#E2E5EB",
          text: "#161A20",
          muted: "#697080",
        },
        status: {
          crushing: "#0B7A3E", // dark green = crushing
          ahead: "#1FA858", // green = ahead
          close: "#C99A12", // yellow/gold = close
          risky: "#E07B22", // orange = risky
          behind: "#DC3D45", // red = behind
        },
        accent: {
          DEFAULT: "#5B5BE0",
          soft: "#4646C6",
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
