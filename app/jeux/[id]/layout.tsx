import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CatalogueUnavailable } from "@/components/catalogue/unavailable";
import { GameHubFrame } from "@/components/games/game-hub";
import { CatalogueNotFoundError, CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";

type GameHubLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: GameHubLayoutProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Jeu ${id}` };
}

export default function GameHubLayout({ children, params }: GameHubLayoutProps) {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <GameHub params={params}>{children}</GameHub>
    </Suspense>
  );
}

async function GameHub({ children, params }: GameHubLayoutProps) {
  const { id: rawId } = await params;
  const id = parseGameId(rawId);
  if (id === null) notFound();

  const result = await loadGame(id);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <CatalogueUnavailable />;
  return <GameHubFrame game={result.game}>{children}</GameHubFrame>;
}

async function loadGame(id: number) {
  try {
    const game = await getCatalogueGateway().getGame(id);
    return { status: "ok" as const, game };
  } catch (error) {
    if (error instanceof CatalogueNotFoundError) return { status: "not-found" as const };
    if (error instanceof CatalogueUnavailableError) return { status: "unavailable" as const };
    throw error;
  }
}

function parseGameId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return id;
}

function HubSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-48 w-48" />
      <div className="skeleton h-8 w-48" />
    </div>
  );
}
