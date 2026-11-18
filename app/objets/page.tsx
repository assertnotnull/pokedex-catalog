import { Suspense } from "react";
import Link from "next/link";
import { CatalogueUnavailable } from "../components/catalogue-unavailable";
import { Pagination } from "../components/pagination";
import { Sprite } from "../components/sprite";
import { parsePage } from "../parse-page";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import {
  LIST_PAGE_SIZE,
  type ItemListEntry,
  type ItemListPage,
} from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError } from "@/src/catalogue/errors";

export const metadata = {
  title: "Objets — Pokédex",
};

export default function ItemIndexPage({ searchParams }: PageProps<"/objets">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement des objets…</p>}>
      <ItemList searchParams={searchParams} />
    </Suspense>
  );
}

async function ItemList({
  searchParams,
}: {
  searchParams: PageProps<"/objets">["searchParams"];
}) {
  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const list = await loadList(page);
  if (list === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return (
    <div className="catalogue-page">
      <h1 className="font-display text-4xl leading-tight">Objets</h1>
      {list.entries.length === 0 ? (
        <p>Cette page ne contient aucun objet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.entries.map((entry) => (
            <li key={entry.id}>
              <ItemTile entry={entry} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} total={list.total} pageSize={LIST_PAGE_SIZE} pathname="/objets" />
    </div>
  );
}

async function loadList(page: number): Promise<ItemListPage | "unavailable"> {
  try {
    return await getCatalogueGateway().listItems(page);
  } catch (error) {
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}

function ItemTile({ entry }: { entry: ItemListEntry }) {
  return (
    <Link
      href={`/objets/${entry.id}`}
      className="catalogue-panel block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex flex-col items-center gap-3 px-4 pb-6 pt-7 text-center sm:flex-col">
        <Sprite src={entry.spriteUrl} />
        <span className="font-display text-2xl leading-none">{entry.frenchName}</span>
        <span className="badge badge-outline">{entry.category}</span>
      </span>
    </Link>
  );
}
