import { describe, expect, test } from "bun:test";
import { MemoryCacheStore } from "@/lib/cache/memory-cache-store";
import { Clock } from "@/lib/catalogue/clock";

class ManualClock extends Clock {
  current = 1_700_000_000_000;
  now() {
    return this.current;
  }
}
import { createCatalogueContainer } from "@/lib/catalogue/container";
import { CatalogueGateway } from "@/lib/catalogue/gateway";
import type { UpstreamClient } from "@/lib/catalogue/upstream";

function gatewayWith(upstream: UpstreamClient) {
  const container = createCatalogueContainer({
    cache: new MemoryCacheStore(),
    upstream,
    clock: new ManualClock(),
  });
  return container.get(CatalogueGateway);
}

describe("catalogue search", () => {
  test("returns empty groups for blank query", async () => {
    const gateway = gatewayWith({ getJson: async () => ({}) });
    await expect(gateway.search("   ")).resolves.toEqual({
      games: [],
      pokemon: [],
      items: [],
      locations: [],
    });
  });

  test("matches cached pokemon index entries", async () => {
    const gateway = gatewayWith({
      getJson: async (path) => {
        if (path.startsWith("/pokemon?")) {
          return {
            count: 1,
            results: [{ name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/" }],
            next: null,
          };
        }
        if (path.startsWith("/version?") || path.startsWith("/item?") || path.startsWith("/location?")) {
          return { count: 0, results: [], next: null };
        }
        if (path === "/pokemon/1") {
          return {
            id: 1,
            name: "bulbasaur",
            species: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon-species/1/" },
            sprites: { front_default: null },
            types: [{ type: { name: "grass", url: "https://pokeapi.co/api/v2/type/12/" } }],
            abilities: [],
            stats: [],
            moves: [],
            held_items: [],
          };
        }
        if (path === "/pokemon-species/1") {
          return { names: [{ language: { name: "fr" }, name: "Bulbizarre" }], genera: [], flavor_text_entries: [] };
        }
        if (path.startsWith("/type/")) return { names: [{ language: { name: "fr" }, name: "Plante" }] };
        throw new Error(`unexpected ${path}`);
      },
    });

    const results = await gateway.search("bulbi");
    expect(results.pokemon).toEqual([{ id: 1, name: "Bulbizarre" }]);
    expect(results.games).toEqual([]);
  });
});
