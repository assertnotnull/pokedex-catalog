import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueUnavailable } from "../../components/catalogue-unavailable";
import { Pagination } from "../../components/pagination";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import {
  LOCATION_PAGE_SIZE,
  type LocationListEntry,
  type LocationListPage,
} from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownRegionError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Lieux — Pokédex",
};

export default function RegionLocationsPage({
  params,
  searchParams,
}: PageProps<"/lieux/[regionId]">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement des lieux…</p>}>
      <RegionLocations params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RegionLocations({
  params,
  searchParams,
}: {
  params: PageProps<"/lieux/[regionId]">["params"];
  searchParams: PageProps<"/lieux/[regionId]">["searchParams"];
}) {
  const { regionId: rawRegionId } = await params;
  const regionId = parseId(rawRegionId);
  if (regionId === null) {
    notFound();
  }

  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const list = await loadLocations(regionId, page);
  if (list === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return (
    <div className="catalogue-page">
      <div className="breadcrumbs">
        <ul>
          <li>
            <Link href="/lieux">Lieux</Link>
          </li>
          <li aria-current="page">{list.regionName}</li>
        </ul>
      </div>
      <h1 className="font-display text-4xl leading-tight">{list.regionName}</h1>
      {list.entries.length === 0 ? (
        <p>
          {list.total === 0
            ? "Cette région ne contient aucun lieu."
            : "Cette page ne contient aucun lieu."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.entries.map((entry) => (
            <li key={entry.id}>
              <LocationTile regionId={regionId} entry={entry} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        total={list.total}
        pageSize={LOCATION_PAGE_SIZE}
        path={`/lieux/${regionId}`}
      />
    </div>
  );
}

async function loadLocations(
  regionId: number,
  page: number,
): Promise<LocationListPage | "unavailable"> {
  try {
    return await getCatalogueGateway().listLocations(regionId, page);
  } catch (error) {
    if (error instanceof UnknownRegionError) {
      notFound();
    }
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function LocationTile({ regionId, entry }: { regionId: number; entry: LocationListEntry }) {
  return (
    <Link
      href={`/lieux/${regionId}/${entry.id}`}
      className="catalogue-panel block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex flex-col gap-2 px-4 pb-6 pt-7">
        <span className="font-display text-2xl leading-none">{entry.frenchName}</span>
        <span className="text-sm text-base-content/60">{entry.regionName}</span>
      </span>
    </Link>
  );
}

function parseId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }
  return Number(value);
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    return 1;
  }
  return Number(raw);
}
