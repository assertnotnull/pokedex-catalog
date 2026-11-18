import Link from "next/link";
import { Suspense } from "react";
import { CatalogueUnavailable } from "../../../components/catalogue-unavailable";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { LocationDetail } from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownLocationError } from "@/src/catalogue/errors";

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
  const { regionId, locationId } = await params;
  if (!/^[1-9]\d*$/.test(regionId) || !/^[1-9]\d*$/.test(locationId)) {
    return <MissingLocation />;
  }

  const location = await loadLocation(Number(locationId));
  if (location === "missing") {
    return <MissingLocation />;
  }
  if (location === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }
  if (location.regionId !== Number(regionId)) {
    return <MissingLocation />;
  }

  return (
    <article className="catalogue-page gap-8">
      <p>
        <Link href={`/lieux/${location.regionId}`} className="link">
          {location.regionName}
        </Link>
      </p>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-5xl leading-none">{location.frenchName}</h1>
        <p className="badge badge-outline w-fit">{location.regionName}</p>
      </header>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Rencontres</h2>
        {location.encounters.length === 0 ? (
          <p>Aucune rencontre renseignée.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {location.encounters.map((encounter) => (
              <li key={encounter.nationalNumber} className="flex flex-col gap-1">
                <Link href={`/pokemon/${encounter.nationalNumber}`} className="link font-display text-xl">
                  {encounter.frenchName}
                </Link>
                <ul className="flex flex-col gap-1 text-sm">
                  {encounter.appearances.map((appearance) => (
                    <li key={`${appearance.gameId}-${appearance.method}-${appearance.minLevel}`}>
                      <Link href={`/jeux/${appearance.gameId}`} className="link">
                        {appearance.gameName}
                      </Link>
                      {` · ${appearance.method} · niv. ${appearance.minLevel}–${appearance.maxLevel} · ${appearance.chance} %`}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

async function loadLocation(id: number): Promise<LocationDetail | "missing" | "unavailable"> {
  try {
    return await getCatalogueGateway().getLocation(id);
  } catch (error) {
    if (error instanceof UnknownLocationError) {
      return "missing";
    }
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function MissingLocation() {
  return (
    <div className="catalogue-page gap-4">
      <h1 className="font-display text-4xl">Lieu introuvable</h1>
      <p>Ce numéro ne correspond à aucun lieu du catalogue.</p>
      <Link href="/lieux" className="btn btn-primary w-fit">
        Retour aux régions
      </Link>
    </div>
  );
}
