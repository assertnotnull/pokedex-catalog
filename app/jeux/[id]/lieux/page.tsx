import Link from "next/link";
import { Suspense } from "react";
import { CatalogueUnavailable } from "../../../components/catalogue-unavailable";
import { GameFrame } from "../../../components/game-frame";
import { Pagination } from "../../../components/pagination";
import { parsePage } from "../../../parse-page";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import { LIST_PAGE_SIZE, type LocationListPage } from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownGameError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Lieux du jeu — Pokédex",
};

export default function GameLocationsPage({
  params,
  searchParams,
}: PageProps<"/jeux/[id]/lieux">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du jeu…</p>}>
      <GameFrame params={params}>
        <GameLocationList params={params} searchParams={searchParams} />
      </GameFrame>
    </Suspense>
  );
}

async function GameLocationList({
  params,
  searchParams,
}: {
  params: PageProps<"/jeux/[id]/lieux">["params"];
  searchParams: PageProps<"/jeux/[id]/lieux">["searchParams"];
}) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) {
    return null;
  }
  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const list = await loadList(Number(id), page);
  if (list === "missing") {
    return null;
  }
  if (list === "unavailable") {
    return <CatalogueUnavailable />;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl">Lieux</h2>
      {list.entries.length === 0 ? (
        <p>Cette page ne contient aucun lieu.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/lieux/${entry.regionId}/${entry.id}`}
                className="catalogue-panel block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex flex-col gap-2 px-4 py-6 text-center">
                  <span className="font-display text-2xl leading-none">{entry.frenchName}</span>
                  <span className="badge badge-outline">{entry.regionName}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        total={list.total}
        pageSize={LIST_PAGE_SIZE}
        pathname={`/jeux/${id}/lieux`}
      />
    </section>
  );
}

async function loadList(
  gameId: number,
  page: number,
): Promise<LocationListPage | "missing" | "unavailable"> {
  try {
    return await getCatalogueGateway().listLocationsForGame(gameId, page);
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
