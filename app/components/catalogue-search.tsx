"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

type SearchHit = {
  id: number;
  frenchName: string;
  href: string;
};

type SearchResponse = {
  games: SearchHit[];
  pokemon: SearchHit[];
  items: SearchHit[];
  locations: SearchHit[];
};

const groups = [
  { key: "games", label: "Jeux" },
  { key: "pokemon", label: "Pokémon" },
  { key: "items", label: "Objets" },
  { key: "locations", label: "Lieux" },
] as const satisfies readonly { key: keyof SearchResponse; label: string }[];

export function CatalogueSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const listId = useId();
  const trimmed = query.trim();
  const open = trimmed.length > 0 && status !== "idle";

  useEffect(() => {
    if (!trimmed) {
      return;
    }
    let ignore = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void fetch(`/recherche?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("search failed");
          }
          return (await response.json()) as SearchResponse;
        })
        .then((body) => {
          if (ignore) {
            return;
          }
          setResults(body);
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (ignore || (error instanceof DOMException && error.name === "AbortError")) {
            return;
          }
          setResults(null);
          setStatus("error");
        });
    }, 200);
    return () => {
      ignore = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [trimmed]);

  const visibleGroups = groups.filter((group) => (results?.[group.key]?.length ?? 0) > 0);

  return (
    <form
      role="search"
      className={`dropdown dropdown-end ${open ? "dropdown-open" : ""}`}
      onSubmit={(event) => event.preventDefault()}
    >
      <input
        type="search"
        name="q"
        className="input w-44 md:w-56"
        placeholder="Rechercher"
        aria-label="Recherche"
        autoComplete="off"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setResults(null);
          setStatus(next.trim() ? "loading" : "idle");
        }}
      />
      {open ? (
        <div
          id={listId}
          aria-live="polite"
          className="dropdown-content top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-box bg-base-100 shadow-md ring-1 ring-base-300"
        >
          {status === "loading" ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm">
              <span className="loading loading-spinner loading-xs" />
              Recherche…
            </p>
          ) : null}
          {status === "error" ? (
            <p className="px-4 py-3 text-sm">La recherche est indisponible.</p>
          ) : null}
          {status === "ready" && visibleGroups.length === 0 ? (
            <p className="px-4 py-3 text-sm">Aucun résultat</p>
          ) : null}
          {status === "ready" && visibleGroups.length > 0 && results ? (
            <ul className="menu w-full">
              {visibleGroups.map((group) => (
                <li key={group.key}>
                  <span className="menu-title">{group.label}</span>
                  <ul>
                    {results[group.key].map((hit) => (
                      <li key={`${group.key}-${hit.id}`}>
                        <Link href={hit.href}>{hit.frenchName}</Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
