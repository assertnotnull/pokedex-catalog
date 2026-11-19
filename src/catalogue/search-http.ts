import type { SearchHit, SearchKind, SearchResults } from "./catalogue-gateway";

const detailHref: Record<SearchKind, (hit: SearchHit) => string> = {
  games: (hit) => `/jeux/${hit.id}`,
  pokemon: (hit) => `/pokemon/${hit.id}`,
  items: (hit) => `/objets/${hit.id}`,
  locations: (hit) => `/lieux/${hit.regionId}/${hit.id}`,
};

export async function searchCatalogue(
  request: Request,
  gateway: { search(query: string): Promise<SearchResults> },
): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await gateway.search(query);
  return Response.json(
    {
      games: withHrefs("games", results.games),
      pokemon: withHrefs("pokemon", results.pokemon),
      items: withHrefs("items", results.items),
      locations: withHrefs("locations", results.locations),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function withHrefs(kind: SearchKind, hits: SearchHit[]) {
  return hits.map((hit) => ({
    id: hit.id,
    frenchName: hit.frenchName,
    href: detailHref[kind](hit),
  }));
}
