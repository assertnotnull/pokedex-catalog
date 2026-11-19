import { Suspense } from "react";
import Link from "next/link";
import { CatalogueUnavailable } from "../../components/catalogue-unavailable";
import { Pagination } from "../../components/pagination";
import { parsePage } from "../../parse-page";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import {
  LIST_PAGE_SIZE,
  type LocationListPage,
  type RegionSummary,
} from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownRegionError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Lieux d’une région — Pokédex",
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
  const { regionId } = await params;
  if (!/^[1-9]\d*$/.test(regionId)) {
    return <MissingRegion />;
  }
  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const loaded = await loadRegion(Number(regionId), page);
  if (loaded === "missing") {
    return <MissingRegion />;
  }
  if (loaded === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return (
    <div className="catalogue-page">
      <p>
        <Link href="/lieux" className="link">
          Toutes les régions
        </Link>
      </p>
      <h1 className="font-display text-4xl leading-tight">{loaded.region.frenchName}</h1>
      {loaded.list.entries.length === 0 ? (
        <p>Cette région ne contient aucun lieu.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {loaded.list.entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/lieux/${loaded.region.id}/${entry.id}`}
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
        total={loaded.list.total}
        pageSize={LIST_PAGE_SIZE}
        pathname={`/lieux/${loaded.region.id}`}
      />
    </div>
  );
}

async function loadRegion(
  regionId: number,
  page: number,
): Promise<{ region: RegionSummary; list: LocationListPage } | "missing" | "unavailable"> {
  try {
    const gateway = getCatalogueGateway();
    const [regions, list] = await Promise.all([
      gateway.listRegions(),
      gateway.listLocations(regionId, page),
    ]);
    const region = regions.find((entry) => entry.id === regionId);
    if (!region) {
      return "missing";
    }
    return { region, list };
  } catch (error) {
    if (error instanceof UnknownRegionError) {
      return "missing";
    }
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function MissingRegion() {
  return (
    <div className="catalogue-page gap-4">
      <h1 className="font-display text-4xl">Région introuvable</h1>
      <p>Ce numéro ne correspond à aucune région du catalogue.</p>
      <Link href="/lieux" className="btn btn-primary w-fit">
        Retour aux régions
      </Link>
    </div>
  );
}
