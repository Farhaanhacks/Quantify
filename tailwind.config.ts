import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // The "ink" base. A soft charcoal rather than near-black: at #05070D
        // the canvas was darker than the panels sitting on it by so little that
        // the page read as one flat void, and every card edge had to do the work
        // of separating content. A lighter base gives the panels something to sit
        // ON, which is what makes a dense data page feel built rather than
        // printed on black.
        ink: {
          DEFAULT: "#16181D",
          900: "#1B1E24",
          800: "#22262E",
          700: "#2B303A",
          600: "#363C48",
        },
        // Signature accent — rich metallic gold on the deep-ink base, matching the
        // Quantifi mark. 400 is a light champagne (gradient top), 600 a deep
        // antique gold (gradient bottom), so `from-gold-400 to-gold-600` reads as
        // brushed metal rather than flat colour.
        gold: {
          DEFAULT: "#D4AF37",
          400: "#E7C873",
          500: "#D4AF37",
          600: "#A67F22",
        },
        // Alias for new code that shouldn't literally say "gold".
        brand: {
          DEFAULT: "#D4AF37",
          400: "#E7C873",
          500: "#D4AF37",
          600: "#A67F22",
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
        // Inter for everything — headings, body and figures. All three keys point
        // at the same family so any existing font-display / font-sans / font-mono
        // utility in the codebase renders in Inter without being rewritten.
        display: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(79,147,247,0.18), 0 18px 60px -18px rgba(79,147,247,0.30)",
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
        shimmer: "shimmer 1.6s ease-in-out infinite",
        floaty: "floaty 6s ease-in-out infinite",
        pulseDot: "pulseDot 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
