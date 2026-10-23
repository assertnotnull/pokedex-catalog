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

describe("game hub filters", () => {
  test("lists pokemon from the version group pokedex", async () => {
    const gateway = gatewayWith({
      getJson: async (path) => {
        if (path === "/version/1") {
          return {
            id: 1,
            name: "red",
            names: [{ language: { name: "fr" }, name: "Rouge" }],
            version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
          };
        }
        if (path === "/version-group/1") {
          return {
            generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" },
            pokedexes: [{ name: "kanto", url: "https://pokeapi.co/api/v2/pokedex/2/" }],
            regions: [],
          };
        }
        if (path === "/pokedex/2") {
          return {
            pokemon_entries: [
              { entry_number: 1, pokemon_species: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon-species/1/" } },
            ],
          };
        }
        if (path === "/pokemon-species/1") {
          return {
            names: [{ language: { name: "fr" }, name: "Bulbizarre" }],
            varieties: [{ pokemon: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/" } }],
          };
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
        if (path.startsWith("/type/")) return { names: [{ language: { name: "fr" }, name: "Plante" }] };
        if (path === "/generation/1") return { names: [{ language: { name: "fr" }, name: "1re génération" }] };
        throw new Error(`unexpected ${path}`);
      },
    });

    const page = await gateway.listGamePokemon(1, 1);
    expect(page.total).toBe(1);
    expect(page.items[0]?.name).toBe("Bulbizarre");
  });
});
