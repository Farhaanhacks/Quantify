import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Deep "ink" base — a blue-black, not pure black
        ink: {
          DEFAULT: "#05070D",
          900: "#070A12",
          800: "#0B0F1A",
          700: "#111726",
          600: "#1A2234",
        },
        // Signature warm gold accent (used sparingly)
        gold: {
          DEFAULT: "#E9B872",
          400: "#F2CD8E",
          500: "#E9B872",
          600: "#C9962F",
        },
        // Secondary "data" accent
        teal: {
          DEFAULT: "#4FD1C5",
          400: "#5EEAD4",
          500: "#4FD1C5",
        },
        // Market semantics
        up: "#34D399",
        down: "#FB7185",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(233,184,114,0.18), 0 18px 60px -18px rgba(233,184,114,0.30)",
        panel: "0 24px 80px -32px rgba(0,0,0,0.85)",
      },
      backgroundImage: {
        "grid-ink":
          "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.7)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        marquee: "marquee 38s linear infinite",
        floaty: "floaty 6s ease-in-out infinite",
        pulseDot: "pulseDot 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
