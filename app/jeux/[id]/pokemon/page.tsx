import { Suspense } from "react";
import { GameHubFrame, GameHubPending } from "../../hub-frame";

export const metadata = {
  title: "Pokémon du jeu — Pokédex",
};

export default function GamePokemonPage({ params }: PageProps<"/jeux/[id]/pokemon">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-10">Chargement du jeu…</p>}>
      <GameHubFrame params={params} current="pokemon">
        <GameHubPending
          title="Pokémon"
          message="Les Pokémon de ce jeu ne sont pas encore filtrés."
        />
      </GameHubFrame>
    </Suspense>
  );
}
