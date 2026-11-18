import { SEARCH_RESULT_CAP, type SearchHit, type SearchResults } from "./catalogue-gateway";

type SearchGateway = {
  search(query: string): Promise<SearchResults>;
};

export async function searchResponse(request: Request, gateway: SearchGateway): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query === "") {
    return Response.json({
      query: "",
      results: { games: [], pokemon: [], items: [], locations: [] },
    });
  }

  const body = await gateway.search(query);
  return Response.json({
    query: body.query,
    results: {
      games: cap(body.results.games),
      pokemon: cap(body.results.pokemon),
      items: cap(body.results.items),
      locations: cap(body.results.locations),
    },
  });
}

function cap(hits: SearchHit[]): SearchHit[] {
  return hits.slice(0, SEARCH_RESULT_CAP);
}
