import { Suspense } from "react";
import { GameFrame } from "../../components/game-frame";

export const metadata = {
  title: "Jeu — Pokédex",
};

export default function GameLandingPage({ params }: PageProps<"/jeux/[id]">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du jeu…</p>}>
      <GameFrame params={params}>
        <p>Choisissez Pokémon, Objets ou Lieux pour explorer ce jeu.</p>
      </GameFrame>
    </Suspense>
  );
}
