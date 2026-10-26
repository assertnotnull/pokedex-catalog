"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "catalogue-theme";
const THEME_EVENT = "catalogue-theme";

type ThemeName = "cupcake" | "dark";

export function ThemeToggle() {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribe, effectiveTheme, () => "cupcake" as const);

  useLayoutEffect(() => {
    applyStoredTheme();
    window.dispatchEvent(new Event(THEME_EVENT));
  }, [pathname]);

  function toggle() {
    const next: ThemeName = effectiveTheme() === "dark" ? "cupcake" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <button
      type="button"
      className="btn btn-sm border-primary-content/30 bg-primary-content text-primary"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      suppressHydrationWarning
    >
      {theme === "dark" ? "Thème clair" : "Thème sombre"}
    </button>
  );
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

function storedTheme(): ThemeName | null {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === "dark") {
    return "dark";
  }
  if (value === "cupcake" || value === "emerald" || value === "light") {
    return "cupcake";
  }
  return null;
}

function applyStoredTheme() {
  const stored = storedTheme();
  if (stored) {
    document.documentElement.setAttribute("data-theme", stored);
    return;
  }
  document.documentElement.removeAttribute("data-theme");
}

function effectiveTheme(): ThemeName {
  const stored = storedTheme();
  if (stored) {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "cupcake";
}
