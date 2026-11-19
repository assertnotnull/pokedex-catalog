import { Suspense } from "react";
import { GameHubFrame } from "../hub-frame";

export const metadata = {
  title: "Jeu — Pokédex",
};

export default function GameLandingPage({ params }: PageProps<"/jeux/[id]">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du jeu…</p>}>
      <GameHubFrame params={params} current="apercu">
        <p>Choisissez Pokémon, objets ou lieux pour explorer ce jeu.</p>
      </GameHubFrame>
    </Suspense>
  );
}
