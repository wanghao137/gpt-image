export type ThemeMode = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export const THEME_KEY: "taostudio.theme";
export function parseThemeMode(value: unknown): ThemeMode;
export function resolveEffectiveTheme(
  mode: ThemeMode,
  systemTheme: EffectiveTheme,
): EffectiveTheme;
export function getSystemTheme(): EffectiveTheme;
export function applyThemeToDocument(theme: EffectiveTheme): void;
