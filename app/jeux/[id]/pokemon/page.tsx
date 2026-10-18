import { DynamicMarker } from "@/components/games/dynamic-marker";
import { GameHubUnfiltered } from "@/components/games/game-hub";

export default function GamePokemonPage() {
  return (
    <>
      <DynamicMarker />
      <GameHubUnfiltered section="Pokémon" />
    </>
  );
}
