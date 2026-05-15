/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: [
          "'Instrument Serif'",
          "'Iowan Old Style'",
          "'Palatino Linotype'",
          "Palatino",
          "Georgia",
          "serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "'Fira Code'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        ink: {
          950: "#0c0a09",
          900: "#13110f",
          850: "#1a1715",
          800: "#1f1c19",
          700: "#2a2622",
          600: "#3d3733",
          500: "#5a544e",
          400: "#7a746c",
          300: "#a8a29a",
          200: "#d4cfc7",
          100: "#ece8e1",
          50: "#f7f4ee",
        },
        ember: {
          50: "#fbf2ec",
          100: "#f4dccd",
          200: "#ecbfa4",
          300: "#e3a17b",
          400: "#dc8a6c",
          500: "#d97757",
          600: "#c25e3f",
          700: "#9c4830",
          800: "#6f3322",
        },
      },
      boxShadow: {
        "soft": "0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -28px rgba(0,0,0,0.7)",
        "ember": "0 18px 60px -28px rgba(217,119,87,0.45)",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease-out both",
        "fade-in": "fadeIn 0.4s ease-out both",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
