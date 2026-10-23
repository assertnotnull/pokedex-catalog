import { Suspense } from "react";
import { DynamicMarker } from "@/components/games/dynamic-marker";
import { GameHubLocationList } from "@/components/games/hub-lists";

export default function GameLocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<p className="skeleton h-32 w-full" />}>
        <GameHubLocationList params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
