import { DynamicMarker } from "@/components/games/dynamic-marker";
import { GameHubUnfiltered } from "@/components/games/game-hub";

export default function GameItemsPage() {
  return (
    <>
      <DynamicMarker />
      <GameHubUnfiltered section="Objets" />
    </>
  );
}
