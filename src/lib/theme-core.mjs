export const THEME_KEY = "taostudio.theme";

export function parseThemeMode(value) {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveEffectiveTheme(mode, systemTheme) {
  const parsedMode = parseThemeMode(mode);
  if (parsedMode === "light" || parsedMode === "dark") return parsedMode;
  return systemTheme === "light" ? "light" : "dark";
}

export function getSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyThemeToDocument(theme) {
  if (typeof document === "undefined") return;
  const effectiveTheme = resolveEffectiveTheme(theme, "dark");
  const root = document.documentElement;
  root.dataset.theme = effectiveTheme;
  root.style.colorScheme = effectiveTheme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", effectiveTheme === "light" ? "#fffaf2" : "#0c0a09");
  }

  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) {
    colorScheme.setAttribute("content", effectiveTheme);
  }
}
