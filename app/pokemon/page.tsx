import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { Pagination } from "@/components/list/pagination";
import { TileGrid } from "@/components/list/tile-grid";
import { nationalNumber } from "@/components/pokemon/format";
import { TypeBadges } from "@/components/pokemon/type-badges";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Pokémon",
};

export default function PokemonListRoute({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Pokémon</h1>
        <p className="text-base-content/70">Espèces du catalogue, 24 par page.</p>
      </header>
      <Suspense fallback={<ListSkeleton />}>
        <PokemonList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PokemonList({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const result = await loadPokemonList(parsePage(params.page));
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;

  const { list } = result;
  const tiles = list.items.map((item) => ({
    href: `/pokemon/${item.id}`,
    imageUrl: item.spriteUrl,
    imageAlt: item.name,
    kicker: nationalNumber(item.id),
    title: item.name,
    tags: <TypeBadges types={item.types} />,
  }));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-base-content/70">{speciesLabel(list.total)}</p>
      <TileGrid
        tiles={tiles}
        emptyLabel={list.total === 0 ? "Aucun Pokémon dans le catalogue." : "Aucun Pokémon sur cette page."}
      />
      {list.total > 0 ? (
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hrefForPage={pokemonPageHref}
        />
      ) : null}
    </div>
  );
}

async function loadPokemonList(page: number) {
  try {
    const list = await getCatalogueGateway().listPokemon(page);
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

function pokemonPageHref(page: number): string {
  return page <= 1 ? "/pokemon" : `/pokemon?page=${page}`;
}

function speciesLabel(total: number): string {
  const formatted = new Intl.NumberFormat("fr-FR").format(total);
  return total === 1 ? "1 espèce" : `${formatted} espèces`;
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
