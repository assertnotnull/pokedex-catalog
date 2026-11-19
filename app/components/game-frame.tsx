import Link from "next/link";
import type { ReactNode } from "react";
import { CatalogueUnavailable } from "./catalogue-unavailable";
import { GameHubNav } from "./game-hub-nav";
import { Sprite } from "./sprite";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { GameListEntry } from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownGameError } from "@/src/catalogue/errors";

export async function GameFrame({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) {
    return <MissingGame />;
  }

  const game = await loadGame(Number(id));
  if (game === "missing") {
    return <MissingGame />;
  }
  if (game === "unavailable") {
    return <CatalogueUnavailable />;
  }

  return (
    <div className="catalogue-page">
      <p>
        <Link href="/jeux" className="link">
          Tous les jeux
        </Link>
      </p>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {game.artworkUrl ? <Sprite src={game.artworkUrl} size={160} /> : null}
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-5xl leading-none">{game.frenchName}</h1>
          <p className="badge badge-outline w-fit">{game.generationLabel}</p>
        </div>
      </header>
      <GameHubNav gameId={game.id} />
      {children}
    </div>
  );
}

function MissingGame() {
  return (
    <div className="catalogue-page gap-4">
      <h1 className="font-display text-4xl">Jeu introuvable</h1>
      <p>Ce numéro ne correspond à aucun jeu du catalogue.</p>
      <Link href="/jeux" className="btn btn-primary w-fit">
        Retour à la liste
      </Link>
    </div>
  );
}

async function loadGame(id: number): Promise<GameListEntry | "missing" | "unavailable"> {
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
