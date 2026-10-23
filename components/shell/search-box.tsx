"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { SearchResults } from "@/lib/catalogue/dto";

const EMPTY: SearchResults = { games: [], pokemon: [], items: [], locations: [] };

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSearch(next: string) {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = next.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      return;
    }
    timer.current = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      if (!response.ok) return;
      setResults((await response.json()) as SearchResults);
      setOpen(true);
    }, 250);
  }

  const hasHits =
    results.games.length > 0 ||
    results.pokemon.length > 0 ||
    results.items.length > 0 ||
    results.locations.length > 0;

  return (
    <div className="relative w-full max-w-xs">
      <label className="input input-bordered input-sm flex items-center gap-2">
        <span className="sr-only">Rechercher</span>
        <input
          type="search"
          className="grow"
          placeholder="Rechercher…"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            scheduleSearch(value);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
      </label>
      {open && query.trim().length >= 2 ? (
        <div className="absolute top-full z-30 mt-2 w-full rounded-box bg-base-100 p-3 shadow-lg">
          {!hasHits ? <p className="text-sm text-base-content/70">Aucun résultat.</p> : null}
          <SearchGroup title="Jeux" hits={results.games} href={(id) => `/jeux/${id}`} />
          <SearchGroup title="Pokémon" hits={results.pokemon} href={(id) => `/pokemon/${id}`} />
          <SearchGroup title="Objets" hits={results.items} href={(id) => `/objets/${id}`} />
          <SearchGroup title="Lieux" hits={results.locations} href={(id) => `/lieux/1/${id}`} />
        </div>
      ) : null}
    </div>
  );
}

function SearchGroup({
  title,
  hits,
  href,
}: {
  title: string;
  hits: { id: number; name: string }[];
  href: (id: number) => string;
}) {
  if (hits.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase text-base-content/60">{title}</p>
      <ul className="menu menu-sm p-0">
        {hits.map((hit) => (
          <li key={hit.id}>
            <Link href={href(hit.id)}>{hit.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
