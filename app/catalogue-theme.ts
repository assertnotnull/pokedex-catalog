/** DaisyUI theme names for this catalogue (Zubat / #41 palette). */
export const CATALOGUE_THEME_LIGHT = "zubat";
export const CATALOGUE_THEME_DARK = "zubat-dark";

export type CatalogueTheme = typeof CATALOGUE_THEME_LIGHT | typeof CATALOGUE_THEME_DARK;

export function catalogueThemeFromStorage(raw: string | null): CatalogueTheme {
  if (raw === CATALOGUE_THEME_DARK || raw === "dark") {
    return CATALOGUE_THEME_DARK;
  }
  if (raw === CATALOGUE_THEME_LIGHT || raw === "light" || raw === null) {
    return CATALOGUE_THEME_LIGHT;
  }
  return CATALOGUE_THEME_LIGHT;
}

export function isDarkCatalogueTheme(theme: CatalogueTheme): boolean {
  return theme === CATALOGUE_THEME_DARK;
}
