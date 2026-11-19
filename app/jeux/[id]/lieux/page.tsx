import { Suspense } from "react";
import { GameHubFrame, GameHubPending } from "../../hub-frame";

export const metadata = {
  title: "Lieux du jeu — Pokédex",
};

export default function GameLocationsPage({ params }: PageProps<"/jeux/[id]/lieux">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du jeu…</p>}>
      <GameHubFrame params={params} current="lieux">
        <GameHubPending title="Lieux" message="Les lieux de ce jeu ne sont pas encore filtrés." />
      </GameHubFrame>
    </Suspense>
  );
}
