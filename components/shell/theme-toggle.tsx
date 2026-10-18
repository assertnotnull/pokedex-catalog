"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "catalogue-theme";
type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function serverSnapshot(): Theme {
  return "light";
}

function emit() {
  for (const listener of listeners) listener();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const nextLabel = theme === "light" ? "sombre" : "clair";

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    emit();
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={toggle} aria-pressed={theme === "dark"}>
      Thème {nextLabel}
    </button>
  );
}
