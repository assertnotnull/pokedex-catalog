import Link from "next/link";
import { Suspense } from "react";
import { CatalogueUnavailable } from "../components/catalogue-unavailable";
import { Pagination } from "../components/pagination";
import { Sprite } from "../components/sprite";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import {
  GAME_PAGE_SIZE,
  type GameListEntry,
  type GameListPage,
} from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Jeux — Pokédex",
};

export default function GamesIndexPage({ searchParams }: PageProps<"/jeux">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement des jeux…</p>}>
      <GameList searchParams={searchParams} />
    </Suspense>
  );
}

async function GameList({
  searchParams,
}: {
  searchParams: PageProps<"/jeux">["searchParams"];
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
    <div className="catalogue-page">
      <h1 className="font-display text-4xl leading-tight">Jeux</h1>
      {list.entries.length === 0 ? (
        <p>Cette page ne contient aucun jeu.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.entries.map((entry) => (
            <li key={entry.id}>
              <GameTile entry={entry} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} total={list.total} pageSize={GAME_PAGE_SIZE} basePath="/jeux" />
    </div>
  );
}

async function loadList(page: number): Promise<GameListPage | "unavailable"> {
  try {
    return await getCatalogueGateway().listGames(page);
  } catch (error) {
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function GameTile({ entry }: { entry: GameListEntry }) {
  return (
    <Link
      href={`/jeux/${entry.id}`}
      className="catalogue-panel block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex flex-col items-center gap-3 px-4 pb-6 pt-7 text-center">
        <Sprite src={entry.artworkUrl} />
        <span className="font-display text-2xl leading-none">{entry.frenchName}</span>
        <span className="badge badge-outline">{entry.label}</span>
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
