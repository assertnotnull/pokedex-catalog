import { Suspense } from "react";
import Link from "next/link";
import { CatalogueUnavailable } from "../components/catalogue-unavailable";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { RegionSummary } from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Lieux — Pokédex",
};

export default function RegionIndexPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement des régions…</p>}>
      <RegionIndex />
    </Suspense>
  );
}

async function RegionIndex() {
  const regions = await loadRegions();
  if (regions === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return (
    <div className="catalogue-page">
      <h1 className="font-display text-4xl leading-tight">Lieux</h1>
      {regions.length === 0 ? (
        <p>Aucune région n’est disponible.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((region) => (
            <li key={region.id}>
              <RegionTile region={region} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function loadRegions(): Promise<RegionSummary[] | "unavailable"> {
  try {
    return await getCatalogueGateway().listRegions();
  } catch (error) {
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function RegionTile({ region }: { region: RegionSummary }) {
  const countLabel = region.locationCount === 1 ? "1 lieu" : `${region.locationCount} lieux`;
  return (
    <Link
      href={`/lieux/${region.id}`}
      className="catalogue-panel block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex flex-col gap-2 px-5 py-6">
        <span className="font-display text-3xl leading-none">{region.frenchName}</span>
        <span className="text-base-content/70">{countLabel}</span>
      </span>
    </Link>
  );
}
