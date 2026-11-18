import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueUnavailable } from "../../components/catalogue-unavailable";
import { Sprite } from "../../components/sprite";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { ItemDetail } from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownItemError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Objet — Pokédex",
};

export default function ItemDetailPage({ params }: PageProps<"/objets/[id]">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement de l’objet…</p>}>
      <ItemDetailView params={params} />
    </Suspense>
  );
}

async function ItemDetailView({ params }: { params: PageProps<"/objets/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) {
    notFound();
  }

  const item = await loadItem(Number(id));
  if (item === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return <ItemDetailContent item={item} />;
}

async function loadItem(id: number): Promise<ItemDetail | "unavailable"> {
  try {
    return await getCatalogueGateway().getItem(id);
  } catch (error) {
    if (error instanceof UnknownItemError) {
      notFound();
    }
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function ItemDetailContent({ item }: { item: ItemDetail }) {
  return (
    <article className="catalogue-page gap-8">
      <p>
        <Link href="/objets" className="link">
          Tous les objets
        </Link>
      </p>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Sprite src={item.spriteUrl} size={96} />
        <div className="flex flex-col gap-2 sm:flex-col">
          <h1 className="font-display text-5xl leading-none">{item.frenchName}</h1>
          <p className="badge badge-outline w-fit">{item.category}</p>
        </div>
      </header>

      {item.prices.length > 0 ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Prix</h2>
          <ul className="flex flex-col gap-1 sm:flex-col">
            {item.prices.map((price) => (
              <li key={`${price.versions}-${price.purchasePrice}-${price.sellPrice}`}>
                {price.versions ? <span>{price.versions} : </span> : null}
                {price.purchasePrice !== null ? <span>achat {price.purchasePrice}</span> : null}
                {price.purchasePrice !== null && price.sellPrice !== null ? <span>, </span> : null}
                {price.sellPrice !== null ? <span>vente {price.sellPrice}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.effect ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Effet</h2>
          <p>{item.effect}</p>
        </section>
      ) : null}

      {item.flavorTexts.length > 0 ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Description</h2>
          <ul className="flex flex-col gap-2 sm:flex-col">
            {item.flavorTexts.map((flavor) => (
              <li key={`${flavor.versions}-${flavor.text}`}>
                {flavor.versions ? <span className="text-base-content/60">{flavor.versions}. </span> : null}
                {flavor.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.flingPower !== null || item.flingEffect ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Lancer</h2>
          {item.flingPower !== null ? <p>Puissance {item.flingPower}</p> : null}
          {item.flingEffect ? <p>{item.flingEffect}</p> : null}
        </section>
      ) : null}

      {item.attributes.length > 0 ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Attributs</h2>
          <ul className="flex flex-wrap gap-2 sm:flex-wrap">
            {item.attributes.map((attribute) => (
              <li key={attribute} className="badge badge-outline">
                {attribute}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.machines.length > 0 ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Machines</h2>
          <ul className="flex flex-col gap-1 sm:flex-col">
            {item.machines.map((machine) => (
              <li key={`${machine.versions}-${machine.move}`}>
                {machine.move}
                {machine.versions ? <span className="text-base-content/60"> ({machine.versions})</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.heldBy.length > 0 ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Tenu par</h2>
          <ul className="flex flex-col gap-1 sm:flex-col">
            {item.heldBy.map((holder) => (
              <li key={holder.nationalNumber}>
                <Link href={`/pokemon/${holder.nationalNumber}`} className="link">
                  {holder.frenchName}
                </Link>
                {holder.versions.length > 0 ? (
                  <span className="text-base-content/60"> ({holder.versions.join(", ")})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
