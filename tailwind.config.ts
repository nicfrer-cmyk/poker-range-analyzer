import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#0A0C10",
          panel: "#12151C",
          panel2: "#181C25",
          border: "#242936",
          text: "#E8EAED",
          muted: "#8A93A3",
        },
        status: {
          crushing: "#0F6B3F", // dark green = crushing
          ahead: "#2FBE6B", // green = ahead
          close: "#E8C547", // yellow = close
          risky: "#F0913B", // orange = risky
          behind: "#E5484D", // red = behind
        },
        accent: {
          DEFAULT: "#6C6CF2",
          soft: "#8F8FF7",
        },
        card: {
          red: "#D6303C",
          black: "#1A1D24",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-heebo)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        panel: "14px",
      },
      boxShadow: {
        soft: "0 8px 30px -8px rgba(0,0,0,0.45)",
        glow: "0 0 24px -4px rgba(108,108,242,0.35)",
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
