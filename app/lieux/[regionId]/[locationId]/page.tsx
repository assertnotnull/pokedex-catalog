import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { LocationDetailView } from "@/components/location/location-detail";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";

type LocationRouteProps = {
  params: Promise<{ regionId: string; locationId: string }>;
};

export async function generateMetadata({ params }: LocationRouteProps): Promise<Metadata> {
  const { locationId } = await params;
  return { title: `Lieu ${locationId}` };
}

export default function LocationDetailRoute({ params }: LocationRouteProps) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <LocationDetail params={params} />
    </Suspense>
  );
}

async function LocationDetail({ params }: LocationRouteProps) {
  const { regionId: rawRegionId, locationId: rawLocationId } = await params;
  const regionId = parseCatalogueId(rawRegionId);
  const locationId = parseCatalogueId(rawLocationId);
  if (regionId === null || locationId === null) notFound();

  const result = await loadLocation(regionId, locationId);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;
  return <LocationDetailView location={result.location} />;
}

async function loadLocation(regionId: number, locationId: number) {
  try {
    const location = await getCatalogueGateway().getLocation(regionId, locationId);
    return { status: "ok" as const, location };
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

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-24 w-full max-w-xl" />
    </div>
  );
}
