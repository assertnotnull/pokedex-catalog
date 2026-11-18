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
          {item.purchasePrice !== null ? <p>Prix d’achat : {item.purchasePrice}</p> : null}
          {item.sellPrice !== null ? <p>Prix de vente : {item.sellPrice}</p> : null}
        </div>
      </header>

      {item.effect ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Effet</h2>
          <p>{item.effect}</p>
        </section>
      ) : null}

      {item.flavorText ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Description</h2>
          <p>{item.flavorText}</p>
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

      {item.heldBy.length > 0 ? (
        <section className="flex flex-col gap-3 sm:flex-col">
          <h2 className="font-display text-2xl">Tenu par</h2>
          <ul className="flex flex-col gap-1 sm:flex-col">
            {item.heldBy.map((holder) => (
              <li key={holder.nationalNumber}>
                <Link href={`/pokemon/${holder.nationalNumber}`} className="link">
                  {holder.frenchName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
