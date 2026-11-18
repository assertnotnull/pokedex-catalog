import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CatalogueUnavailable } from "../../components/catalogue-unavailable";
import { GameHubNav } from "./game-hub-nav";
import { parseGameId } from "./parse-game-id";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { GameSummary } from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownGameError } from "@/src/catalogue/errors";

export default function GameHubLayout({ children, params }: LayoutProps<"/jeux/[id]">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du jeu…</p>}>
      <GameHub params={params}>{children}</GameHub>
    </Suspense>
  );
}

async function GameHub({
  children,
  params,
}: {
  children: ReactNode;
  params: LayoutProps<"/jeux/[id]">["params"];
}) {
  const { id: rawId } = await params;
  const id = parseGameId(rawId);
  if (id === null) {
    notFound();
  }

  const game = await loadGame(id);
  if (game === "missing") {
    notFound();
  }
  if (game === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  return (
    <div className="catalogue-page">
      <p>
        <Link href="/jeux" className="link">
          Tous les jeux
        </Link>
      </p>
      <h1 className="font-display text-4xl leading-tight">{game.frenchName}</h1>
      <GameHubNav gameId={game.id} />
      {children}
    </div>
  );
}

async function loadGame(id: number): Promise<GameSummary | "missing" | "unavailable"> {
  try {
    return await getCatalogueGateway().getGame(id);
  } catch (error) {
    if (error instanceof UnknownGameError) {
      return "missing";
    }
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}
