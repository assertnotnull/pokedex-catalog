import { describe, expect, test } from "bun:test";
import { SEARCH_RESULT_CAP, type SearchHit, type SearchResults } from "./catalogue-gateway";
import { searchResponse } from "./search-response";

describe("search endpoint", () => {
  test("an empty query is an empty grouped result and does not search the catalogue", async () => {
    const gateway = {
      async search(): Promise<SearchResults> {
        throw new Error("search should not run");
      },
    };

    for (const url of [
      "http://catalogue.test/api/recherche",
      "http://catalogue.test/api/recherche?q=",
      "http://catalogue.test/api/recherche?q=%20%20",
    ]) {
      const response = await searchResponse(new Request(url), gateway);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        query: "",
        results: { games: [], pokemon: [], items: [], locations: [] },
      });
    }
  });

  test("a query returns the grouped JSON shape with at most eight hits per kind", async () => {
    const hits = (prefix: string, href: string): SearchHit[] =>
      Array.from({ length: SEARCH_RESULT_CAP + 1 }, (_, index) => ({
        id: index + 1,
        frenchName: `${prefix} ${index + 1}`,
        href: `${href}/${index + 1}`,
      }));
    const gateway = {
      async search(query: string): Promise<SearchResults> {
        return {
          query,
          results: {
            games: hits("Jeu", "/jeux"),
            pokemon: hits("Pokémon", "/pokemon"),
            items: hits("Objet", "/objets"),
            locations: hits("Lieu", "/lieux/1"),
          },
        };
      },
    };

    const response = await searchResponse(
      new Request("http://catalogue.test/api/recherche?q=lieu"),
      gateway,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    expect(body.query).toBe("lieu");
    expect(Object.keys(body.results)).toEqual(["games", "pokemon", "items", "locations"]);
    for (const kind of ["games", "pokemon", "items", "locations"] as const) {
      expect(body.results[kind]).toHaveLength(SEARCH_RESULT_CAP);
      expect(body.results[kind][0]).toEqual({
        id: expect.any(Number),
        frenchName: expect.any(String),
        href: expect.any(String),
      });
    }
    expect(body.results.locations[0].href).toBe("/lieux/1/1");
  });
});
