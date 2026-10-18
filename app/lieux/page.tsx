import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { TileGrid } from "@/components/list/tile-grid";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Lieux" };

export default function RegionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Lieux</h1>
        <p className="text-base-content/70">Régions du catalogue, puis les lieux de chacune.</p>
      </header>
      <Suspense fallback={<ListSkeleton />}>
        <RegionIndex />
      </Suspense>
    </div>
  );
}

async function RegionIndex() {
  const result = await loadRegions();
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;

  const { regions } = result;
  const tiles = regions.map((region) => ({
    href: `/lieux/${region.id}`,
    imageUrl: null,
    imageAlt: region.name,
    kicker: "Région",
    title: region.name,
    tags: null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-base-content/70">{regionLabel(regions.length)}</p>
      <TileGrid tiles={tiles} emptyLabel="Aucune région dans le catalogue." />
    </div>
  );
}

async function loadRegions() {
  try {
    const regions = await getCatalogueGateway().listRegions();
    return { status: "ok" as const, regions };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

function regionLabel(total: number): string {
  const formatted = new Intl.NumberFormat("fr-FR").format(total);
  return total === 1 ? "1 région" : `${formatted} régions`;
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
