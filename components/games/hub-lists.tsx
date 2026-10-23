import { notFound } from "next/navigation";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { Pagination } from "@/components/list/pagination";
import { TileGrid } from "@/components/list/tile-grid";
import { nationalNumber } from "@/components/pokemon/format";
import { TypeBadges } from "@/components/pokemon/type-badges";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";

function parseGameId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  if (!raw || !Number.isInteger(page) || page < 1) return 1;
  return page;
}

export async function GameHubPokemonList({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const gameId = parseGameId((await params).id);
  if (gameId === null) notFound();
  const page = parsePage((await searchParams).page);
  const result = await loadGamePokemon(gameId, page);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;

  const list = result.data;
  const tiles = list.items.map((item) => ({
    href: `/pokemon/${item.id}`,
    imageUrl: item.spriteUrl,
    imageAlt: item.name,
    kicker: nationalNumber(item.id),
    title: item.name,
    tags: <TypeBadges types={item.types} />,
  }));

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Pokémon</h2>
      <TileGrid tiles={tiles} emptyLabel="Aucun Pokémon pour cette version." />
      {list.total > 0 ? (
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hrefForPage={(p) => hubHref(gameId, "pokemon", p)}
        />
      ) : null}
    </section>
  );
}

export async function GameHubItemList({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const gameId = parseGameId((await params).id);
  if (gameId === null) notFound();
  const page = parsePage((await searchParams).page);
  const result = await loadGameItems(gameId, page);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;

  const list = result.data;
  const tiles = list.items.map((item) => ({
    href: `/objets/${item.id}`,
    imageUrl: item.iconUrl,
    imageAlt: item.name,
    kicker: item.category,
    title: item.name,
  }));

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Objets</h2>
      <TileGrid tiles={tiles} emptyLabel="Aucun objet pour cette version." />
      {list.total > 0 ? (
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hrefForPage={(p) => hubHref(gameId, "objets", p)}
        />
      ) : null}
    </section>
  );
}

export async function GameHubLocationList({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const gameId = parseGameId((await params).id);
  if (gameId === null) notFound();
  const page = parsePage((await searchParams).page);
  const result = await loadGameLocations(gameId, page);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;

  const list = result.data;
  const tiles = list.items.map((item) => ({
    href: `/lieux/${list.region.id}/${item.id}`,
    imageUrl: null,
    imageAlt: item.name,
    kicker: item.region,
    title: item.name,
  }));

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Lieux</h2>
      <TileGrid tiles={tiles} emptyLabel="Aucun lieu pour cette version." />
      {list.total > 0 ? (
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hrefForPage={(p) => hubHref(gameId, "lieux", p)}
        />
      ) : null}
    </section>
  );
}

async function loadGamePokemon(gameId: number, page: number) {
  try {
    const data = await getCatalogueGateway().listGamePokemon(gameId, page);
    return { status: "ok" as const, data };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

async function loadGameItems(gameId: number, page: number) {
  try {
    const data = await getCatalogueGateway().listGameItems(gameId, page);
    return { status: "ok" as const, data };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

async function loadGameLocations(gameId: number, page: number) {
  try {
    const data = await getCatalogueGateway().listGameLocations(gameId, page);
    return { status: "ok" as const, data };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

function hubHref(gameId: number, segment: string, page: number): string {
  const base = `/jeux/${gameId}/${segment}`;
  return page <= 1 ? base : `${base}?page=${page}`;
}
