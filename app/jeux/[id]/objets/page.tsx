import { Suspense } from "react";
import { GameHubFrame, GameHubPending } from "../../hub-frame";

export const metadata = {
  title: "Objets du jeu — Pokédex",
};

export default function GameItemsPage({ params }: PageProps<"/jeux/[id]/objets">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du jeu…</p>}>
      <GameHubFrame params={params} current="objets">
        <GameHubPending title="Objets" message="Les objets de ce jeu ne sont pas encore filtrés." />
      </GameHubFrame>
    </Suspense>
  );
}
