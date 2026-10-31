import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueUnavailable } from "../../components/catalogue-unavailable";
import { Sprite } from "../../components/sprite";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { PokemonDetail } from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownPokemonError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Pokémon — Pokédex",
};

export default function PokemonDetailPage({ params }: PageProps<"/pokemon/[id]">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du Pokémon…</p>}>
      <PokemonDetailView params={params} />
    </Suspense>
  );
}

async function PokemonDetailView({ params }: { params: PageProps<"/pokemon/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) {
    notFound();
  }

  const pokemon = await loadPokemon(Number(id));
  if (pokemon === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return <PokemonDetailContent pokemon={pokemon} />;
}

async function loadPokemon(id: number): Promise<PokemonDetail | "unavailable"> {
  try {
    return await getCatalogueGateway().getPokemon(id);
  } catch (error) {
    if (error instanceof UnknownPokemonError) {
      notFound();
    }
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function PokemonDetailContent({ pokemon }: { pokemon: PokemonDetail }) {
  const moves = [...new Set(pokemon.moves.map((move) => move.name))];

  return (
    <article className="catalogue-page gap-8">
      <p>
        <Link href="/pokemon" className="link">
          Tous les Pokémon
        </Link>
      </p>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Sprite src={pokemon.spriteUrl} size={160} />
        <div className="flex flex-col gap-2">
          <p className="text-sm text-base-content/60">N° {pokemon.nationalNumber}</p>
          <h1 className="font-display text-5xl leading-none">{pokemon.frenchName}</h1>
          <ul className="flex flex-wrap gap-2">
            {pokemon.types.map((type) => (
              <li key={type} className="badge badge-outline">
                {type}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Statistiques</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {pokemon.stats.map((stat) => (
            <div key={stat.name} className="flex items-baseline justify-between gap-4 border-b border-base-300 py-1">
              <dt>{stat.name}</dt>
              <dd className="font-display text-xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Évolutions</h2>
        <ol className="flex flex-wrap items-center gap-2">
          {pokemon.evolutions.map((evolution, index) => (
            <li key={evolution.nationalNumber} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">→</span> : null}
              <Link href={`/pokemon/${evolution.nationalNumber}`} className="link font-display text-xl">
                {evolution.frenchName}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Talents</h2>
        <ul className="flex flex-col gap-1">
          {pokemon.abilities.map((ability) => (
            <li key={`${ability.name}-${ability.isHidden}`}>
              {ability.name}
              {ability.isHidden ? " (caché)" : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Capacités</h2>
        <ul className="columns-2 gap-x-8 md:columns-3">
          {moves.map((move) => (
            <li key={move} className="break-inside-avoid py-0.5">
              {move}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
