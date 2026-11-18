"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

type SearchHit = {
  id: number;
  frenchName: string;
  href: string;
};

type SearchBody = {
  query: string;
  results: {
    games: SearchHit[];
    pokemon: SearchHit[];
    items: SearchHit[];
    locations: SearchHit[];
  };
};

const groups = [
  ["games", "Jeux"],
  ["pokemon", "Pokémon"],
  ["items", "Objets"],
  ["locations", "Lieux"],
] as const;

export function SiteSearch() {
  const [query, setQuery] = useState("");
  const [body, setBody] = useState<SearchBody | null>(null);
  const listId = useId();
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed === "") {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/recherche?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((next: SearchBody | null) => {
          if (next) {
            setBody(next);
          }
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed]);

  const shown = body && body.query === trimmed ? body : null;
  const groupsWithHits = shown
    ? groups.filter(([key]) => shown.results[key].length > 0)
    : [];

  return (
    <div className="relative" role="search">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher"
        aria-label="Recherche"
        aria-controls={listId}
        className="input input-sm w-36 sm:w-52"
      />
      {shown && groupsWithHits.length === 0 ? (
        <p
          id={listId}
          className="absolute right-0 z-20 mt-2 w-64 rounded-box border border-base-300 bg-base-100 px-3 py-2 text-sm"
        >
          Aucun résultat
        </p>
      ) : null}
      {shown && groupsWithHits.length > 0 ? (
        <div
          id={listId}
          className="absolute right-0 z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-box border border-base-300 bg-base-100"
        >
          {groupsWithHits.map(([key, label]) => (
            <ul key={key} className="menu menu-sm w-full">
              <li className="menu-title">{label}</li>
              {shown.results[key].map((hit) => (
                <li key={hit.id}>
                  <Link href={hit.href} onClick={() => setQuery("")}>
                    {hit.frenchName}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      ) : null}
    </div>
  );
}
