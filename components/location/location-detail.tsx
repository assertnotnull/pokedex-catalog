import Link from "next/link";
import type { ReactNode } from "react";
import type { LocationDetail as LocationDetailData } from "@/lib/catalogue/dto";

export function LocationDetailView({ location }: { location: LocationDetailData }) {
  return (
    <article className="flex flex-col gap-8">
      <p>
        <Link href={`/lieux/${location.region.id}`} className="link link-hover">
          Retour à la région
        </Link>
      </p>
      <header className="flex flex-col gap-2">
        <p className="text-sm text-base-content/60">
          <Link href={`/lieux/${location.region.id}`} className="link link-hover">
            {location.region.name}
          </Link>
        </p>
        <h1 className="text-4xl font-semibold">{location.name}</h1>
      </header>
      <Section title="Rencontres">
        {location.encounters.length === 0 ? (
          <p className="text-base-content/60">Aucune donnée.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {location.encounters.map((encounter, index) => (
              <li
                key={`${encounter.pokemon.id}-${encounter.zone}-${encounter.version}-${encounter.method}-${encounter.minLevel}-${encounter.maxLevel}-${index}`}
                className="rounded-box bg-base-100 p-4 shadow-sm"
              >
                <Link href={`/pokemon/${encounter.pokemon.id}`} className="link link-hover font-medium">
                  {encounter.pokemon.name}
                </Link>
                <p className="text-sm text-base-content/70">
                  {encounter.zone} · {encounter.version} · {encounter.method} ·{" "}
                  {levelLabel(encounter.minLevel, encounter.maxLevel)} · {chanceLabel(encounter.chance)}
                </p>
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

function levelLabel(min: number, max: number): string {
  return min === max ? `Niv. ${min}` : `Niv. ${min}–${max}`;
}

function chanceLabel(chance: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(chance)} %`;
}
