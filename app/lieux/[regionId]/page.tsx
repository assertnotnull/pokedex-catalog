import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { Pagination } from "@/components/list/pagination";
import { TileGrid } from "@/components/list/tile-grid";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";

type RegionRouteProps = {
  params: Promise<{ regionId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: RegionRouteProps): Promise<Metadata> {
  const { regionId } = await params;
  return { title: `Région ${regionId}` };
}

export default function RegionLocationsRoute({ params, searchParams }: RegionRouteProps) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <RegionLocations params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RegionLocations({ params, searchParams }: RegionRouteProps) {
  const [{ regionId: rawRegionId }, query] = await Promise.all([params, searchParams]);
  const regionId = parseCatalogueId(rawRegionId);
  if (regionId === null) notFound();

  const result = await loadLocations(regionId, parsePage(query.page));
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;

  const { list } = result;
  const tiles = list.items.map((item) => ({
    href: `/lieux/${list.region.id}/${item.id}`,
    imageUrl: null,
    imageAlt: item.name,
    kicker: item.region,
    title: item.name,
    tags: null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/lieux" className="link link-hover">
          Toutes les régions
        </Link>
      </p>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{list.region.name}</h1>
        <p className="text-base-content/70">Lieux de cette région, 24 par page.</p>
      </header>
      <p className="text-sm text-base-content/70">{locationLabel(list.total)}</p>
      <TileGrid
        tiles={tiles}
        emptyLabel={list.total === 0 ? "Aucun lieu dans cette région." : "Aucun lieu sur cette page."}
      />
      {list.total > 0 ? (
        <Pagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hrefForPage={(page) => locationPageHref(list.region.id, page)}
        />
      ) : null}
    </div>
  );
}

async function loadLocations(regionId: number, page: number) {
  try {
    const list = await getCatalogueGateway().listLocations(regionId, page);
    return { status: "ok" as const, list };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

function parseCatalogueId(raw: string): number | null {
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

function locationPageHref(regionId: number, page: number): string {
  return page <= 1 ? `/lieux/${regionId}` : `/lieux/${regionId}?page=${page}`;
}

function locationLabel(total: number): string {
  const formatted = new Intl.NumberFormat("fr-FR").format(total);
  return total === 1 ? "1 lieu" : `${formatted} lieux`;
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
