import Link from "next/link";
import { Suspense } from "react";
import { CatalogueUnavailable } from "../components/catalogue-unavailable";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { RegionListEntry } from "@/src/catalogue/catalogue-gateway";
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
      <p className="text-base-content/70">Choisissez une région pour explorer ses lieux.</p>
      {regions.length === 0 ? (
        <p>Aucune région n’est disponible.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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

async function loadRegions(): Promise<RegionListEntry[] | "unavailable"> {
  try {
    return await getCatalogueGateway().listRegions();
  } catch (error) {
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function RegionTile({ region }: { region: RegionListEntry }) {
  return (
    <Link
      href={`/lieux/${region.id}`}
      className="catalogue-panel block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex flex-col px-4 pb-6 pt-7">
        <span className="font-display text-2xl leading-none">{region.frenchName}</span>
      </span>
    </Link>
  );
}
