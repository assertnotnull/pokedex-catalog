import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogueUnavailable } from "../../../components/catalogue-unavailable";
import { Pagination } from "../../../components/pagination";
import { Sprite } from "../../../components/sprite";
import { parsePage } from "../../../parse-page";
import { parseGameId } from "../parse-game-id";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import {
  LIST_PAGE_SIZE,
  type PokemonListEntry,
  type PokemonListPage,
} from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownGameError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Pokémon du jeu — Pokédex",
};

export default function GamePokemonPage({
  params,
  searchParams,
}: PageProps<"/jeux/[id]/pokemon">) {
  return (
    <Suspense fallback={<p>Chargement des Pokémon…</p>}>
      <GamePokemonList params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function GamePokemonList({
  params,
  searchParams,
}: {
  params: PageProps<"/jeux/[id]/pokemon">["params"];
  searchParams: PageProps<"/jeux/[id]/pokemon">["searchParams"];
}) {
  const { id: rawId } = await params;
  const id = parseGameId(rawId);
  if (id === null) {
    notFound();
  }
  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const list = await loadList(id, page);
  if (list === "missing") {
    notFound();
  }
  if (list === "unavailable") {
    return <CatalogueUnavailable />;
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-display text-2xl leading-tight">Pokémon</h2>
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
      <Pagination
        page={page}
        total={list.total}
        pageSize={LIST_PAGE_SIZE}
        pathname={`/jeux/${id}/pokemon`}
      />
    </section>
  );
}

async function loadList(
  gameId: number,
  page: number,
): Promise<PokemonListPage | "missing" | "unavailable"> {
  try {
    return await getCatalogueGateway().listPokemonForGame(gameId, page);
  } catch (error) {
    if (error instanceof UnknownGameError) {
      return "missing";
    }
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
      className="catalogue-panel block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex flex-col items-center gap-3 px-4 pb-6 pt-7 text-center">
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
