import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { Pagination } from "@/components/list/pagination";
import { TileGrid } from "@/components/list/tile-grid";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Jeux",
};

export default function GamesListRoute({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Jeux</h1>
        <p className="text-base-content/70">Titres du catalogue, 24 par page.</p>
      </header>
      <Suspense fallback={<ListSkeleton />}>
        <GamesList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function GamesList({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const result = await loadGamesList(parsePage(params.page));
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;

  const { list } = result;
  const tiles = list.items.map((item) => ({
    href: `/jeux/${item.id}`,
    imageUrl: item.artworkUrl,
    imageAlt: item.name,
    kicker: item.generationLabel,
    title: item.name,
    tags: null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-base-content/70">{gamesLabel(list.total)}</p>
      <TileGrid
        tiles={tiles}
        emptyLabel={list.total === 0 ? "Aucun jeu dans le catalogue." : "Aucun jeu sur cette page."}
      />
      {list.total > list.pageSize ? (
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hrefForPage={gamesPageHref}
        />
      ) : null}
    </div>
  );
}

async function loadGamesList(page: number) {
  try {
    const list = await getCatalogueGateway().listGames(page);
    return { status: "ok" as const, list };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  if (!raw || !Number.isInteger(page) || page < 1) return 1;
  return page;
}

function gamesPageHref(page: number): string {
  return page <= 1 ? "/jeux" : `/jeux?page=${page}`;
}

function gamesLabel(total: number): string {
  const formatted = new Intl.NumberFormat("fr-FR").format(total);
  return total === 1 ? "1 jeu" : `${formatted} jeux`;
}

function ListSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index} className="card bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <div className="skeleton mx-auto h-24 w-24" />
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-5 w-28" />
          </div>
        </li>
      ))}
    </ul>
  );
}
