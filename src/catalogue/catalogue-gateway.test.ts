import { Container } from "@needle-di/core";
import { describe, expect, test } from "bun:test";
import { CacheStore, InMemoryCacheStore } from "./cache-store";
import { CatalogueGateway } from "./catalogue-gateway";
import { Clock, FixedClock } from "./clock";
import { CatalogueUnavailableError } from "./errors";
import {
  PokeApi,
  type PokemonPage,
  type PokemonPayload,
  type SpeciesPayload,
  type TypePayload,
} from "./poke-api";

const T0 = 1_700_000_000_000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const pagePayload: PokemonPage = {
  count: 1,
  results: [{ name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" }],
};

type CatalogueFixture = {
  pages: Map<string, PokemonPage>;
  pokemon: Map<number, PokemonPayload>;
  species: Map<number, SpeciesPayload>;
  types: Map<number, TypePayload>;
};

const pikachuPayload: PokemonPayload = {
  id: 25,
  sprites: {
    front_default:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
  },
  types: [{ slot: 1, type: { name: "electric", url: "https://pokeapi.co/api/v2/type/13/" } }],
  stats: [{ base_stat: 35, stat: { name: "hp", url: "https://pokeapi.co/api/v2/stat/1/" } }],
  abilities: [],
  moves: [],
  species: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
};

const pikachuSpecies: SpeciesPayload = {
  id: 25,
  names: [
    { name: "Pikachu", language: { name: "en" } },
    { name: "Pikachu", language: { name: "fr" } },
  ],
};

const electricType: TypePayload = {
  id: 13,
  names: [
    { name: "Electric", language: { name: "en" } },
    { name: "Électrik", language: { name: "fr" } },
  ],
};

function defaultCatalogue(): CatalogueFixture {
  return {
    pages: new Map([
      ["0:24", pagePayload],
      ["24:24", { count: 1, results: [] }],
    ]),
    pokemon: new Map([[25, pikachuPayload]]),
    species: new Map([[25, pikachuSpecies]]),
    types: new Map([[13, electricType]]),
  };
}

describe("catalogue gateway", () => {
  test("a cache miss stores the upstream payload", async () => {
    const { gateway, cache } = openGateway();

    await gateway.listPokemon(1);

    expect(cache.storedBodies()).toContainEqual(pagePayload);
    expect(cache.storedBodies()).toContainEqual(pikachuPayload);
    expect(cache.storedBodies()).toContainEqual(pikachuSpecies);
    expect(cache.storedBodies()).toContainEqual(electricType);
  });

  test("a fresh cache hit does not refetch the upstream payload", async () => {
    const { gateway, upstream } = openGateway();

    await gateway.listPokemon(1);
    const callsAfterMiss = upstream.callCount;

    await gateway.listPokemon(1);

    expect(upstream.callCount).toBe(callsAfterMiss);
  });

  test("an expired cache entry is refetched", async () => {
    const { gateway, upstream, clock } = openGateway();

    await gateway.listPokemon(1);
    const callsAfterMiss = upstream.callCount;
    clock.advance(SEVEN_DAYS_MS);

    await gateway.listPokemon(1);

    expect(upstream.callCount).toBeGreaterThan(callsAfterMiss);
  });

  test("an upstream failure returns the last stored body", async () => {
    const { gateway, upstream, clock } = openGateway();
    const first = await gateway.listPokemon(1);
    clock.advance(SEVEN_DAYS_MS);
    upstream.fail = true;

    const second = await gateway.listPokemon(1);

    expect(second).toEqual(first);
  });

  test("upstream failure with no stored body is a controlled error", async () => {
    const { gateway, upstream } = openGateway();
    upstream.fail = true;

    await expect(gateway.listPokemon(1)).rejects.toBeInstanceOf(
      CatalogueUnavailableError,
    );
  });

  test("Pokémon list names use French and fall back to English", async () => {
    const { gateway } = openGateway(nameCatalogue());

    const page = await gateway.listPokemon(1);

    expect(page.entries.map((entry) => entry.frenchName)).toEqual([
      "Salamèche",
      "Missingno",
    ]);
  });

  test("a Pokémon list entry keeps only the v1 fields", async () => {
    const { gateway } = openGateway(nameCatalogue());

    const page = await gateway.listPokemon(1);

    expect(page.entries).toEqual([
      {
        nationalNumber: 4,
        frenchName: "Salamèche",
        spriteUrl:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png",
        types: ["Feu"],
      },
      {
        nationalNumber: 999,
        frenchName: "Missingno",
        spriteUrl: null,
        types: ["Bird"],
      },
    ]);
  });

  test("each Pokémon list page requests the next 24 entries", async () => {
    const { gateway, upstream } = openGateway();

    await gateway.listPokemon(1);
    await gateway.listPokemon(2);

    expect(upstream.listCalls).toEqual([
      { offset: 0, limit: 24 },
      { offset: 24, limit: 24 },
    ]);
  });
});

function nameCatalogue(): CatalogueFixture {
  return {
    pages: new Map([
      [
        "0:24",
        {
          count: 2,
          results: [
            { name: "charmander", url: "https://pokeapi.co/api/v2/pokemon/4/" },
            { name: "missingno", url: "https://pokeapi.co/api/v2/pokemon/999/" },
          ],
        },
      ],
    ]),
    pokemon: new Map([
      [
        4,
        {
          id: 4,
          sprites: {
            front_default:
              "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png",
          },
          types: [
            { slot: 1, type: { name: "fire", url: "https://pokeapi.co/api/v2/type/10/" } },
          ],
          stats: [{ base_stat: 39, stat: { name: "hp", url: "https://pokeapi.co/api/v2/stat/1/" } }],
          abilities: [],
          moves: [{ move: { name: "scratch", url: "https://pokeapi.co/api/v2/move/10/" } }],
          species: { name: "charmander", url: "https://pokeapi.co/api/v2/pokemon-species/4/" },
        },
      ],
      [
        999,
        {
          id: 999,
          sprites: { front_default: null },
          types: [
            { slot: 1, type: { name: "bird", url: "https://pokeapi.co/api/v2/type/99/" } },
          ],
          stats: [],
          abilities: [],
          moves: [],
          species: { name: "missingno", url: "https://pokeapi.co/api/v2/pokemon-species/999/" },
        },
      ],
    ]),
    species: new Map([
      [
        4,
        {
          id: 4,
          names: [
            { name: "Charmander", language: { name: "en" } },
            { name: "Salamèche", language: { name: "fr" } },
          ],
        },
      ],
      [
        999,
        {
          id: 999,
          names: [{ name: "Missingno", language: { name: "en" } }],
        },
      ],
    ]),
    types: new Map([
      [
        10,
        {
          id: 10,
          names: [
            { name: "Fire", language: { name: "en" } },
            { name: "Feu", language: { name: "fr" } },
          ],
        },
      ],
      [
        99,
        {
          id: 99,
          names: [{ name: "Bird", language: { name: "en" } }],
        },
      ],
    ]),
  };
}

function openGateway(fixture: CatalogueFixture = defaultCatalogue()) {
  const cache = new InMemoryCacheStore();
  const clock = new FixedClock(T0);
  const upstream = new FakePokeApi(fixture);
  const container = new Container();
  container.bind({ provide: CacheStore, useValue: cache });
  container.bind({ provide: PokeApi, useValue: upstream });
  container.bind({ provide: Clock, useValue: clock });
  return {
    gateway: container.get(CatalogueGateway),
    cache,
    clock,
    upstream,
  };
}

class FakePokeApi extends PokeApi {
  callCount = 0;
  fail = false;
  listCalls: { offset: number; limit: number }[] = [];

  constructor(private readonly fixture: CatalogueFixture) {
    super();
  }

  listPokemon(offset: number, limit: number): Promise<PokemonPage> {
    this.listCalls.push({ offset, limit });
    return this.read(
      () => this.fixture.pages.get(`${offset}:${limit}`),
      `page ${offset}:${limit}`,
    );
  }

  getPokemon(id: number): Promise<PokemonPayload> {
    return this.read(() => this.fixture.pokemon.get(id), `pokemon ${id}`);
  }

  getSpecies(id: number): Promise<SpeciesPayload> {
    return this.read(() => this.fixture.species.get(id), `species ${id}`);
  }

  getType(id: number): Promise<TypePayload> {
    return this.read(() => this.fixture.types.get(id), `type ${id}`);
  }

  private read<T>(load: () => T | undefined, label: string): Promise<T> {
    this.callCount += 1;
    if (this.fail) {
      return Promise.reject(new Error("upstream unavailable"));
    }
    const body = load();
    if (body === undefined) {
      return Promise.reject(new Error(`missing ${label}`));
    }
    return Promise.resolve(body);
  }
}
