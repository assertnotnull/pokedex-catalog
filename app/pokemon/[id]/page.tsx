import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { PokemonDetailView } from "@/components/pokemon/pokemon-detail";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";

type PokemonRouteProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PokemonRouteProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Pokémon n°${id}` };
}

export default function PokemonDetailRoute({ params }: PokemonRouteProps) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <PokemonDetail params={params} />
    </Suspense>
  );
}

async function PokemonDetail({ params }: PokemonRouteProps) {
  const { id: rawId } = await params;
  const id = parsePokemonId(rawId);
  if (id === null) notFound();

  const result = await loadPokemon(id);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;
  return <PokemonDetailView pokemon={result.pokemon} />;
}

async function loadPokemon(id: number) {
  try {
    const pokemon = await getCatalogueGateway().getPokemon(id);
    return { status: "ok" as const, pokemon };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

function parsePokemonId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-48 w-48" />
      <div className="skeleton h-8 w-48" />
    </div>
  );
}
