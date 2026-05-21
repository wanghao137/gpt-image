/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./admin.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // System-first sans stack. We dropped Inter as a webfont (see
        // index.html font-strategy comment) — these are all preinstalled
        // on every consumer device and render zh-CN glyphs cleanly. The
        // English-script fallback chain still produces a polished result
        // on Windows / Linux desktops where PingFang isn't present.
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "HarmonyOS Sans SC",
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
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "'Liberation Mono'",
          "monospace",
        ],
      },
      colors: {
        ink: {
          950: "rgb(var(--color-ink-950) / <alpha-value>)",
          900: "rgb(var(--color-ink-900) / <alpha-value>)",
          850: "rgb(var(--color-ink-850) / <alpha-value>)",
          800: "rgb(var(--color-ink-800) / <alpha-value>)",
          700: "rgb(var(--color-ink-700) / <alpha-value>)",
          600: "rgb(var(--color-ink-600) / <alpha-value>)",
          500: "rgb(var(--color-ink-500) / <alpha-value>)",
          400: "rgb(var(--color-ink-400) / <alpha-value>)",
          300: "rgb(var(--color-ink-300) / <alpha-value>)",
          200: "rgb(var(--color-ink-200) / <alpha-value>)",
          100: "rgb(var(--color-ink-100) / <alpha-value>)",
          50: "rgb(var(--color-ink-50) / <alpha-value>)",
        },
        ember: {
          50: "rgb(var(--color-ember-50) / <alpha-value>)",
          100: "rgb(var(--color-ember-100) / <alpha-value>)",
          200: "rgb(var(--color-ember-200) / <alpha-value>)",
          300: "rgb(var(--color-ember-300) / <alpha-value>)",
          400: "rgb(var(--color-ember-400) / <alpha-value>)",
          500: "rgb(var(--color-ember-500) / <alpha-value>)",
          600: "rgb(var(--color-ember-600) / <alpha-value>)",
          700: "rgb(var(--color-ember-700) / <alpha-value>)",
          800: "rgb(var(--color-ember-800) / <alpha-value>)",
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
