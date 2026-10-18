import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { Pagination } from "@/components/list/pagination";
import { TileGrid } from "@/components/list/tile-grid";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Objets",
};

export default function ItemListRoute({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Objets</h1>
        <p className="text-base-content/70">Objets du catalogue, 24 par page.</p>
      </header>
      <Suspense fallback={<ListSkeleton />}>
        <ItemList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ItemList({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const result = await loadItemList(parsePage(params.page));
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;

  const { list } = result;
  const tiles = list.items.map((item) => ({
    href: `/objets/${item.id}`,
    imageUrl: item.iconUrl,
    imageAlt: item.name,
    kicker: item.category,
    title: item.name,
    tags: null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-base-content/70">{itemCountLabel(list.total)}</p>
      <TileGrid
        tiles={tiles}
        emptyLabel={list.total === 0 ? "Aucun objet dans le catalogue." : "Aucun objet sur cette page."}
      />
      {list.total > 0 ? (
        <Pagination page={list.page} pageSize={list.pageSize} total={list.total} hrefForPage={itemPageHref} />
      ) : null}
    </div>
  );
}

async function loadItemList(page: number) {
  try {
    const list = await getCatalogueGateway().listItems(page);
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

function itemPageHref(page: number): string {
  return page <= 1 ? "/objets" : `/objets?page=${page}`;
}

function itemCountLabel(total: number): string {
  const formatted = new Intl.NumberFormat("fr-FR").format(total);
  return total === 1 ? "1 objet" : `${formatted} objets`;
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
