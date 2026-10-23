import Link from "next/link";
import type { ReactNode } from "react";
import { CatalogueImage } from "@/components/list/catalogue-image";
import type { ItemDetail as ItemDetailData } from "@/lib/catalogue/dto";

export function ItemDetailView({ item }: { item: ItemDetailData }) {
  return (
    <article className="flex flex-col gap-8">
      <p>
        <Link href="/objets" className="link link-hover">
          Retour à la liste
        </Link>
      </p>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="grid place-items-center rounded-box bg-base-100 p-4 shadow-sm">
          <CatalogueImage src={item.iconUrl} alt={item.name} size={96} priority />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold">{item.name}</h1>
          <p>
            <span className="badge badge-outline">{item.category}</span>
          </p>
        </div>
      </header>
      {item.effect ? <p className="max-w-2xl text-lg">{item.effect}</p> : null}
      {item.flavorText ? <p className="max-w-2xl text-base-content/80">{item.flavorText}</p> : null}
      {item.price ? (
        <dl className="grid grid-cols-2 gap-4 sm:max-w-md">
          <div className="rounded-box bg-base-100 p-4 shadow-sm">
            <dt className="text-sm text-base-content/60">Achat</dt>
            <dd className="text-xl font-medium">{pokedollars(item.price.purchase)}</dd>
          </div>
          <div className="rounded-box bg-base-100 p-4 shadow-sm">
            <dt className="text-sm text-base-content/60">Vente</dt>
            <dd className="text-xl font-medium">{pokedollars(item.price.sell)}</dd>
          </div>
        </dl>
      ) : null}
      <Section title="Attributs">
        {item.attributes.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {item.attributes.map((attribute) => (
              <li key={attribute} className="badge badge-ghost">
                {attribute}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {item.flingPower !== null || item.flingEffect ? (
        <Section title="Lancer">
          {item.flingPower !== null ? <p>Puissance : {item.flingPower}</p> : null}
          {item.flingEffect ? <p>{item.flingEffect}</p> : null}
        </Section>
      ) : null}
      {item.heldBy.length > 0 ? (
        <Section title="Tenu par">
          <ul className="flex flex-wrap gap-2">
            {item.heldBy.map((holder) => (
              <li key={holder.id}>
                <Link href={`/pokemon/${holder.id}`} className="btn btn-outline btn-sm">
                  {holder.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {item.machines.length > 0 ? (
        <Section title="CT et CS">
          <ul className="flex flex-wrap gap-2">
            {item.machines.map((machine, index) => (
              <li key={`${machine.move}-${machine.versionGroup}-${index}`} className="badge badge-outline badge-lg">
                {machine.move}
                <span className="text-base-content/60"> · {machine.versionGroup}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {item.triggersBabyEvolution ? (
        <p>Cet objet peut déclencher l’évolution d’un bébé Pokémon.</p>
      ) : null}
    </article>
  );
}

function pokedollars(value: number | null): string {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("fr-FR").format(value);
  return `${formatted} Pokédollars`;
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
