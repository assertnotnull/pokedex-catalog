import { DynamicMarker } from "@/components/games/dynamic-marker";
import { GameHubUnfiltered } from "@/components/games/game-hub";

export default function GameLocationsPage() {
  return (
    <>
      <DynamicMarker />
      <GameHubUnfiltered section="Lieux" />
    </>
  );
}
