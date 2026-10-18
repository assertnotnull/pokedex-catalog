import Link from "next/link";
import type { ReactNode } from "react";
import type { PokemonDetail as PokemonDetailData } from "@/lib/catalogue/dto";
import { CatalogueImage } from "@/components/list/catalogue-image";
import { measure, nationalNumber } from "@/components/pokemon/format";
import { TypeBadges } from "@/components/pokemon/type-badges";

export function PokemonDetailView({ pokemon }: { pokemon: PokemonDetailData }) {
  const image = pokemon.artworkUrl ?? pokemon.spriteUrl;

  return (
    <article className="flex flex-col gap-8">
      <p>
        <Link href="/pokemon" className="link link-hover">
          Retour à la liste
        </Link>
      </p>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="grid place-items-center rounded-box bg-base-100 p-4 shadow-sm">
          <CatalogueImage src={image} alt={pokemon.name} size={192} priority />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-base-content/60">{nationalNumber(pokemon.id)}</p>
          <h1 className="text-4xl font-semibold">{pokemon.name}</h1>
          {pokemon.genus ? <p className="text-base-content/70">{pokemon.genus}</p> : null}
          <TypeBadges types={pokemon.types} />
        </div>
      </header>
      {pokemon.flavorText ? <p className="max-w-2xl text-lg">{pokemon.flavorText}</p> : null}
      <dl className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-box bg-base-100 p-4 shadow-sm">
          <dt className="text-sm text-base-content/60">Taille</dt>
          <dd className="text-xl font-medium">{measure(pokemon.heightMeters)} m</dd>
        </div>
        <div className="rounded-box bg-base-100 p-4 shadow-sm">
          <dt className="text-sm text-base-content/60">Poids</dt>
          <dd className="text-xl font-medium">{measure(pokemon.weightKilograms)} kg</dd>
        </div>
      </dl>
      <Section title="Talents">
        {pokemon.abilities.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-col gap-1">
            {pokemon.abilities.map((ability) => (
              <li key={`${ability.name}-${ability.isHidden}`}>
                {ability.name}
                {ability.isHidden ? <span className="text-base-content/60"> (caché)</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Statistiques">
        {pokemon.stats.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex max-w-xl flex-col gap-3">
            {pokemon.stats.map((stat) => (
              <li key={stat.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{stat.name}</span>
                  <span>{stat.value}</span>
                </div>
                <progress className="progress progress-primary w-full" value={stat.value} max={255} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Évolutions">
        {pokemon.evolutions.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {pokemon.evolutions.map((evolution) => (
              <li key={evolution.id}>
                <Link href={`/pokemon/${evolution.id}`} className="btn btn-outline btn-sm">
                  {evolution.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Objets tenus">
        {pokemon.heldItems.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {pokemon.heldItems.map((item) => (
              <li key={item.id} className="badge badge-lg badge-outline">
                {item.name}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Attaques">
        {pokemon.moves.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {pokemon.moves.map((move) => (
              <li key={move.name} className="badge badge-ghost">
                {move.name}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="text-base-content/60">Aucune donnée.</p>;
}
