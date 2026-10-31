"use client";

import { useSyncExternalStore } from "react";
import {
  CATALOGUE_THEME_DARK,
  CATALOGUE_THEME_LIGHT,
  catalogueThemeFromStorage,
  isDarkCatalogueTheme,
  type CatalogueTheme,
} from "../catalogue-theme";

const STORAGE_KEY = "catalogue-theme";
const THEME_EVENT = "catalogue-theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => CATALOGUE_THEME_LIGHT);

  function toggle() {
    const next: CatalogueTheme = isDarkCatalogueTheme(readTheme())
      ? CATALOGUE_THEME_LIGHT
      : CATALOGUE_THEME_DARK;
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm border border-base-300"
      onClick={toggle}
      aria-pressed={isDarkCatalogueTheme(theme)}
      suppressHydrationWarning
    >
      {isDarkCatalogueTheme(theme) ? "Thème clair" : "Thème sombre"}
    </button>
  );
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function readTheme(): CatalogueTheme {
  const onRoot = document.documentElement.getAttribute("data-theme");
  if (onRoot === CATALOGUE_THEME_DARK || onRoot === CATALOGUE_THEME_LIGHT) {
    return onRoot;
  }
  try {
    return catalogueThemeFromStorage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return CATALOGUE_THEME_LIGHT;
  }
}
