import { Suspense } from "react";
import { CatalogueUnavailable } from "../components/catalogue-unavailable";
import { Pagination } from "../components/pagination";
import { Sprite } from "../components/sprite";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import {
  POKEMON_PAGE_SIZE,
  type PokemonListEntry,
  type PokemonListPage,
} from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError } from "@/src/catalogue/errors";
import Link from "next/link";

export const metadata = {
  title: "Pokémon — Pokédex",
};

export default function PokemonIndexPage({ searchParams }: PageProps<"/pokemon">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement des Pokémon…</p>}>
      <PokemonList searchParams={searchParams} />
    </Suspense>
  );
}

async function PokemonList({
  searchParams,
}: {
  searchParams: PageProps<"/pokemon">["searchParams"];
}) {
  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const list = await loadList(page);
  if (list === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-4xl">Pokémon</h1>
      {list.entries.length === 0 ? (
        <p>Cette page ne contient aucun Pokémon.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.entries.map((entry) => (
            <li key={entry.nationalNumber}>
              <PokemonTile entry={entry} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} total={list.total} pageSize={POKEMON_PAGE_SIZE} />
    </div>
  );
}

async function loadList(page: number): Promise<PokemonListPage | "unavailable"> {
  try {
    return await getCatalogueGateway().listPokemon(page);
  } catch (error) {
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function PokemonTile({ entry }: { entry: PokemonListEntry }) {
  return (
    <Link
      href={`/pokemon/${entry.nationalNumber}`}
      className="card h-full border border-base-300 bg-base-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="card-body items-center gap-3 text-center">
        <Sprite src={entry.spriteUrl} />
        <span className="text-sm text-base-content/60">N° {entry.nationalNumber}</span>
        <span className="font-display text-2xl leading-none">{entry.frenchName}</span>
        <span className="flex flex-wrap justify-center gap-1">
          {entry.types.map((type) => (
            <span key={type} className="badge badge-outline">
              {type}
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    return 1;
  }
  return Number(raw);
}
