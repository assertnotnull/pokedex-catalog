import { describe, expect, test } from "bun:test";
import { MemoryCacheStore } from "@/lib/cache/memory-cache-store";
import { Clock } from "@/lib/catalogue/clock";
import { createCatalogueContainer } from "@/lib/catalogue/container";
import { CatalogueNotFoundError, CatalogueUnavailableError, UpstreamNotFoundError, UpstreamRequestError } from "@/lib/catalogue/errors";
import { CatalogueGateway } from "@/lib/catalogue/gateway";
import { UpstreamClient } from "@/lib/catalogue/upstream";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

class ManualClock extends Clock {
  current = 1_700_000_000_000;

  override now(): number {
    return this.current;
  }
}

class FixtureUpstream extends UpstreamClient {
  readonly calls: string[] = [];
  fail = false;
  bulbasaurFrench: string | undefined = "Bulbizarre";

  async getJson(path: string): Promise<unknown> {
    this.calls.push(path);
    if (this.fail) throw new UpstreamRequestError(path, 503);
    const body = this.route(path);
    if (body === undefined) throw new UpstreamNotFoundError(path);
    return structuredClone(body);
  }

  private route(path: string): unknown | undefined {
    if (path === "/pokemon?limit=24&offset=0") {
      return {
        count: 25,
        results: [
          { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/" },
          { name: "ivysaur", url: "https://pokeapi.co/api/v2/pokemon/2/" },
        ],
      };
    }
    if (path === "/pokemon?limit=24&offset=24") {
      return {
        count: 25,
        results: [{ name: "venusaur", url: "https://pokeapi.co/api/v2/pokemon/3/" }],
      };
    }
    if (path === "/pokemon/1") return pokemonFixture(1, "bulbasaur", true);
    if (path === "/pokemon/2") return pokemonFixture(2, "ivysaur", false);
    if (path === "/pokemon/3") return pokemonFixture(3, "venusaur", false);
    if (path === "/pokemon-species/1") {
      return {
        names: names(this.bulbasaurFrench, "Bulbasaur"),
        genera: [{ genus: "Pokémon Graine", language: { name: "fr" } }],
        flavor_text_entries: [
          { flavor_text: "Il a une plante\nsur le dos.", language: { name: "fr" } },
        ],
        evolution_chain: { url: "https://pokeapi.co/api/v2/evolution-chain/1/" },
      };
    }
    if (path === "/pokemon-species/2") {
      return { names: names(undefined, "Ivysaur"), genera: [], flavor_text_entries: [] };
    }
    if (path === "/pokemon-species/3") {
      return { names: [], genera: [], flavor_text_entries: [] };
    }
    if (path === "/type/12") return { names: names("Plante", "Grass") };
    if (path === "/type/4") return { names: names("Poison", "Poison") };
    if (path === "/ability/65") return { names: names("Engrais", "Overgrow") };
    if (path === "/stat/1") return { names: names("PV", "HP") };
    if (path === "/move/33") return { names: names("Charge", "Tackle") };
    if (path === "/item/132") return { names: names("Baie Oran", "Oran Berry") };
    if (path === "/evolution-chain/1") {
      return {
        chain: {
          species: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon-species/1/" },
          evolves_to: [
            {
              species: { name: "ivysaur", url: "https://pokeapi.co/api/v2/pokemon-species/2/" },
              evolves_to: [],
            },
          ],
        },
      };
    }
    return undefined;
  }
}

function names(french: string | undefined, english: string) {
  const entries = [];
  if (french) entries.push({ name: french, language: { name: "fr" } });
  entries.push({ name: english, language: { name: "en" } });
  return entries;
}

function pokemonFixture(id: number, name: string, rich: boolean) {
  return {
    id,
    name,
    height: 7,
    weight: 69,
    sprites: {
      front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
      other: {
        "official-artwork": {
          front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
        },
      },
    },
    types: [
      { slot: 1, type: { name: "grass", url: "https://pokeapi.co/api/v2/type/12/" } },
      { slot: 2, type: { name: "poison", url: "https://pokeapi.co/api/v2/type/4/" } },
    ],
    abilities: rich
      ? [{ is_hidden: false, ability: { name: "overgrow", url: "https://pokeapi.co/api/v2/ability/65/" } }]
      : [],
    stats: rich ? [{ base_stat: 45, stat: { name: "hp", url: "https://pokeapi.co/api/v2/stat/1/" } }] : [],
    moves: rich ? [{ move: { name: "tackle", url: "https://pokeapi.co/api/v2/move/33/" } }] : [],
    species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
    held_items: rich
      ? [{ item: { name: "oran-berry", url: "https://pokeapi.co/api/v2/item/132/" } }]
      : [],
  };
}

function setup() {
  const cache = new MemoryCacheStore();
  const upstream = new FixtureUpstream();
  const clock = new ManualClock();
  const gateway = createCatalogueContainer({ cache, upstream, clock }).get(CatalogueGateway);
  return { cache, upstream, clock, gateway };
}

describe("catalogue gateway", () => {
  test("resolves through Needle-DI with an injected cache", () => {
    const { gateway, cache } = setup();
    expect(gateway).toBeInstanceOf(CatalogueGateway);
    expect(cache).toBeInstanceOf(MemoryCacheStore);
  });

  test("cache miss populates the store and a later read is a hit", async () => {
    const { gateway, upstream, cache } = setup();
    expect(cache.size).toBe(0);

    const first = await gateway.getPokemon(1);
    expect(first.name).toBe("Bulbizarre");
    expect(cache.size).toBeGreaterThan(0);
    const callsAfterMiss = upstream.calls.length;
    expect(callsAfterMiss).toBeGreaterThan(0);

    const second = await gateway.getPokemon(1);
    expect(second).toEqual(first);
    expect(upstream.calls.length).toBe(callsAfterMiss);
  });

  test("refetches after the seven-day TTL and serves stale data when upstream fails", async () => {
    const { gateway, upstream, clock } = setup();
    const original = await gateway.getPokemon(1);
    const callsAfterMiss = upstream.calls.length;

    clock.current += SEVEN_DAYS_MS - 1;
    await gateway.getPokemon(1);
    expect(upstream.calls.length).toBe(callsAfterMiss);

    clock.current += 1;
    upstream.bulbasaurFrench = "Bulbizarre Prime";
    const refreshed = await gateway.getPokemon(1);
    expect(refreshed.name).toBe("Bulbizarre Prime");
    expect(upstream.calls.length).toBeGreaterThan(callsAfterMiss);

    const callsAfterRefresh = upstream.calls.length;
    clock.current += SEVEN_DAYS_MS;
    upstream.fail = true;
    const stale = await gateway.getPokemon(1);
    expect(stale.name).toBe("Bulbizarre Prime");
    expect(stale.abilities).toEqual(original.abilities);
    expect(upstream.calls.length).toBeGreaterThan(callsAfterRefresh);
  });

  test("fails closed when upstream errors and nothing is cached", async () => {
    const { gateway, upstream, cache } = setup();
    upstream.fail = true;
    await expect(gateway.getPokemon(1)).rejects.toBeInstanceOf(CatalogueUnavailableError);
    expect(cache.size).toBe(0);
  });

  test("does not cache a missing Pokémon", async () => {
    const { gateway, cache } = setup();
    await expect(gateway.getPokemon(999)).rejects.toBeInstanceOf(CatalogueNotFoundError);
    expect(cache.size).toBe(0);
  });

  test("resolves French names and falls back to English, then the identifier", async () => {
    const { gateway } = setup();
    const french = await gateway.getPokemon(1);
    const english = await gateway.getPokemon(2);
    const identifier = await gateway.getPokemon(3);

    expect(french.name).toBe("Bulbizarre");
    expect(french.genus).toBe("Pokémon Graine");
    expect(french.flavorText).toBe("Il a une plante sur le dos.");
    expect(french.types).toEqual(["Plante", "Poison"]);
    expect(french.abilities).toEqual([{ name: "Engrais", isHidden: false }]);
    expect(french.stats).toEqual([{ name: "PV", value: 45 }]);
    expect(french.moves).toEqual([{ name: "Charge" }]);
    expect(french.evolutions).toEqual([
      { id: 1, name: "Bulbizarre" },
      { id: 2, name: "Ivysaur" },
    ]);
    expect(french.heldItems).toEqual([{ id: 132, name: "Baie Oran" }]);
    expect(english.name).toBe("Ivysaur");
    expect(identifier.name).toBe("venusaur");
  });

  test("list DTOs keep only the v1 tile fields and request 24 per page", async () => {
    const { gateway, upstream } = setup();
    const page = await gateway.listPokemon(1);

    expect(upstream.calls[0]).toBe("/pokemon?limit=24&offset=0");
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(24);
    expect(page.total).toBe(25);
    expect(page.items).toEqual([
      {
        id: 1,
        name: "Bulbizarre",
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
        types: ["Plante", "Poison"],
      },
      {
        id: 2,
        name: "Ivysaur",
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
        types: ["Plante", "Poison"],
      },
    ]);
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(["id", "name", "spriteUrl", "types"]);
    }

    const second = await gateway.listPokemon(2);
    expect(upstream.calls).toContain("/pokemon?limit=24&offset=24");
    expect(second.items.map((item) => item.name)).toEqual(["venusaur"]);
    expect(await gateway.listPokemon(0)).toMatchObject({ page: 1 });
  });
});
