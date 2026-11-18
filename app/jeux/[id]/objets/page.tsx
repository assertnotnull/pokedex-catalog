import { Suspense } from "react";
import { GameFrame } from "../../../components/game-frame";
import { UnfilteredGameList } from "../../../components/unfiltered-game-list";

export const metadata = {
  title: "Objets du jeu — Pokédex",
};

export default function GameItemsPage({ params }: PageProps<"/jeux/[id]/objets">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du jeu…</p>}>
      <GameFrame params={params}>
        <UnfilteredGameList title="Objets" />
      </GameFrame>
    </Suspense>
  );
}
