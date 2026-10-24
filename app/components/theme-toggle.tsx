"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "catalogue-theme";
const THEME_EVENT = "catalogue-theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as const);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
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
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function currentTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
