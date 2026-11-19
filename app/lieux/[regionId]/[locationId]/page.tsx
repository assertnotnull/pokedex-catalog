import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueUnavailable } from "../../../components/catalogue-unavailable";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { LocationDetail, LocationEncounter } from "@/src/catalogue/catalogue-gateway";
import {
  CatalogueUnavailableError,
  UnknownLocationError,
  UnknownRegionError,
} from "@/src/catalogue/errors";

export const metadata = {
  title: "Lieu — Pokédex",
};

export default function LocationDetailPage({
  params,
}: PageProps<"/lieux/[regionId]/[locationId]">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du lieu…</p>}>
      <LocationDetailView params={params} />
    </Suspense>
  );
}

async function LocationDetailView({
  params,
}: {
  params: PageProps<"/lieux/[regionId]/[locationId]">["params"];
}) {
  const { regionId: rawRegionId, locationId: rawLocationId } = await params;
  const regionId = parseId(rawRegionId);
  const locationId = parseId(rawLocationId);
  if (regionId === null || locationId === null) {
    notFound();
  }

  const location = await loadLocation(regionId, locationId);
  if (location === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return <LocationDetailContent location={location} />;
}

async function loadLocation(
  regionId: number,
  locationId: number,
): Promise<LocationDetail | "unavailable"> {
  try {
    return await getCatalogueGateway().getLocation(regionId, locationId);
  } catch (error) {
    if (error instanceof UnknownLocationError || error instanceof UnknownRegionError) {
      notFound();
    }
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function LocationDetailContent({ location }: { location: LocationDetail }) {
  return (
    <article className="catalogue-page gap-8">
      <div className="breadcrumbs">
        <ul>
          <li>
            <Link href="/lieux">Lieux</Link>
          </li>
          <li>
            <Link href={`/lieux/${location.regionId}`}>{location.regionName}</Link>
          </li>
          <li aria-current="page">{location.frenchName}</li>
        </ul>
      </div>
      <header className="flex flex-col gap-2">
        <p className="text-sm text-base-content/60">{location.regionName}</p>
        <h1 className="font-display text-5xl leading-none">{location.frenchName}</h1>
      </header>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Rencontres</h2>
        {location.encounters.length === 0 ? (
          <p>Aucune rencontre n’est répertoriée pour ce lieu.</p>
        ) : (
          <EncounterTable encounters={location.encounters} />
        )}
      </section>
    </article>
  );
}

function EncounterTable({ encounters }: { encounters: LocationEncounter[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Pokémon</th>
            <th>Méthode</th>
            <th>Versions</th>
            <th>Niveaux</th>
          </tr>
        </thead>
        <tbody>
          {encounters.map((encounter, index) => (
            <tr key={`${encounter.pokemonId}-${index}`}>
              <td>
                <Link href={`/pokemon/${encounter.pokemonId}`} className="link">
                  {encounter.frenchName}
                </Link>
              </td>
              <td>{encounter.method}</td>
              <td>{encounter.versions.join(", ")}</td>
              <td>{levelRange(encounter.minLevel, encounter.maxLevel)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function levelRange(minLevel: number, maxLevel: number): string {
  return minLevel === maxLevel ? String(minLevel) : `${minLevel}–${maxLevel}`;
}

function parseId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }
  return Number(value);
}
