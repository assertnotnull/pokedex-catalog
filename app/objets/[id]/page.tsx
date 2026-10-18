import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { ItemDetailView } from "@/components/items/item-detail";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";

type ItemRouteProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ItemRouteProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Objet n°${id}` };
}

export default function ItemDetailRoute({ params }: ItemRouteProps) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ItemDetail params={params} />
    </Suspense>
  );
}

async function ItemDetail({ params }: ItemRouteProps) {
  const { id: rawId } = await params;
  const id = parseItemId(rawId);
  if (id === null) notFound();

  const result = await loadItem(id);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;
  return <ItemDetailView item={result.item} />;
}

async function loadItem(id: number) {
  try {
    const item = await getCatalogueGateway().getItem(id);
    return { status: "ok" as const, item };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

function parseItemId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-24 w-24" />
      <div className="skeleton h-8 w-48" />
    </div>
  );
}
