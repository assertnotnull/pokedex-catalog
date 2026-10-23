import { Container } from "@needle-di/core";
import { describe, expect, test } from "bun:test";
import { CacheStore, InMemoryCacheStore } from "./cache-store";
import { CatalogueGateway } from "./catalogue-gateway";
import { Clock, FixedClock } from "./clock";
import { CatalogueUnavailableError, UnknownPokemonError } from "./errors";
import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
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
  evolutionChains: Map<number, EvolutionChainPayload>;
  abilities: Map<number, DescribedPayload>;
  moves: Map<number, DescribedPayload>;
  stats: Map<number, DescribedPayload>;
};

function emptyRelated(): Pick<
  CatalogueFixture,
  "evolutionChains" | "abilities" | "moves" | "stats"
> {
  return {
    evolutionChains: new Map(),
    abilities: new Map(),
    moves: new Map(),
    stats: new Map(),
  };
}

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
    ...emptyRelated(),
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

  test("a Pokémon detail shows French stats, types, evolutions, moves, and abilities", async () => {
    const { gateway } = openGateway(detailCatalogue());

    expect(await gateway.getPokemon(25)).toEqual({
      nationalNumber: 25,
      frenchName: "Pikachu",
      spriteUrl:
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
      types: ["Électrik"],
      stats: [
        { name: "PV", value: 35 },
        { name: "Attaque", value: 55 },
      ],
      abilities: [
        { name: "Statik", isHidden: false },
        { name: "Paratonnerre", isHidden: true },
      ],
      moves: [{ name: "Éclair" }, { name: "Vive-Attaque" }],
      evolutions: [
        { nationalNumber: 172, frenchName: "Pichu" },
        { nationalNumber: 25, frenchName: "Pikachu" },
        { nationalNumber: 26, frenchName: "Raichu" },
      ],
    });
  });

  test("a missing Pokémon is a not-found error", async () => {
    const { gateway } = openGateway();

    await expect(gateway.getPokemon(404)).rejects.toBeInstanceOf(UnknownPokemonError);
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
    ...emptyRelated(),
  };
}

function detailCatalogue(): CatalogueFixture {
  return {
    pages: new Map(),
    pokemon: new Map([
      [
        25,
        {
          id: 25,
          sprites: {
            front_default:
              "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
          },
          types: [
            {
              slot: 1,
              type: { name: "electric", url: "https://pokeapi.co/api/v2/type/13/" },
            },
          ],
          stats: [
            { base_stat: 35, stat: { name: "hp", url: "https://pokeapi.co/api/v2/stat/1/" } },
            { base_stat: 55, stat: { name: "attack", url: "https://pokeapi.co/api/v2/stat/2/" } },
          ],
          abilities: [
            {
              is_hidden: false,
              ability: { name: "static", url: "https://pokeapi.co/api/v2/ability/9/" },
            },
            {
              is_hidden: true,
              ability: { name: "lightning-rod", url: "https://pokeapi.co/api/v2/ability/31/" },
            },
          ],
          moves: [
            { move: { name: "thunder-shock", url: "https://pokeapi.co/api/v2/move/84/" } },
            { move: { name: "quick-attack", url: "https://pokeapi.co/api/v2/move/98/" } },
          ],
          species: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
        },
      ],
    ]),
    species: new Map([
      [
        172,
        {
          id: 172,
          names: [{ name: "Pichu", language: { name: "fr" } }],
        },
      ],
      [
        25,
        {
          id: 25,
          names: [
            { name: "Pikachu", language: { name: "en" } },
            { name: "Pikachu", language: { name: "fr" } },
          ],
          evolution_chain: { url: "https://pokeapi.co/api/v2/evolution-chain/10/" },
        },
      ],
      [
        26,
        { id: 26, names: [{ name: "Raichu", language: { name: "fr" } }] },
      ],
    ]),
    types: new Map([[13, electricType]]),
    evolutionChains: new Map([
      [
        10,
        {
          id: 10,
          chain: {
            species: { name: "pichu", url: "https://pokeapi.co/api/v2/pokemon-species/172/" },
            evolves_to: [
              {
                species: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
                evolves_to: [
                  {
                    species: { name: "raichu", url: "https://pokeapi.co/api/v2/pokemon-species/26/" },
                    evolves_to: [],
                  },
                ],
              },
            ],
          },
        },
      ],
    ]),
    stats: new Map([
      [
        1,
        {
          id: 1,
          names: [
            { name: "HP", language: { name: "en" } },
            { name: "PV", language: { name: "fr" } },
          ],
        },
      ],
      [
        2,
        {
          id: 2,
          names: [
            { name: "Attack", language: { name: "en" } },
            { name: "Attaque", language: { name: "fr" } },
          ],
        },
      ],
    ]),
    abilities: new Map([
      [
        9,
        {
          id: 9,
          names: [
            { name: "Static", language: { name: "en" } },
            { name: "Statik", language: { name: "fr" } },
          ],
        },
      ],
      [
        31,
        {
          id: 31,
          names: [
            { name: "Lightning Rod", language: { name: "en" } },
            { name: "Paratonnerre", language: { name: "fr" } },
          ],
        },
      ],
    ]),
    moves: new Map([
      [
        84,
        {
          id: 84,
          names: [
            { name: "Thunder Shock", language: { name: "en" } },
            { name: "Éclair", language: { name: "fr" } },
          ],
        },
      ],
      [
        98,
        {
          id: 98,
          names: [
            { name: "Quick Attack", language: { name: "en" } },
            { name: "Vive-Attaque", language: { name: "fr" } },
          ],
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
    return this.read(() => this.fixture.pokemon.get(id), `pokemon ${id}`, true);
  }

  getSpecies(id: number): Promise<SpeciesPayload> {
    return this.read(() => this.fixture.species.get(id), `species ${id}`);
  }

  getType(id: number): Promise<TypePayload> {
    return this.read(() => this.fixture.types.get(id), `type ${id}`);
  }

  getEvolutionChain(id: number): Promise<EvolutionChainPayload> {
    return this.read(() => this.fixture.evolutionChains.get(id), `evolution chain ${id}`);
  }

  getAbility(id: number): Promise<DescribedPayload> {
    return this.read(() => this.fixture.abilities.get(id), `ability ${id}`);
  }

  getMove(id: number): Promise<DescribedPayload> {
    return this.read(() => this.fixture.moves.get(id), `move ${id}`);
  }

  getStat(id: number): Promise<DescribedPayload> {
    return this.read(() => this.fixture.stats.get(id), `stat ${id}`);
  }

  private read<T>(load: () => T | undefined, label: string, missingIsNotFound = false): Promise<T> {
    this.callCount += 1;
    if (this.fail) {
      return Promise.reject(new Error("upstream unavailable"));
    }
    const body = load();
    if (body === undefined) {
      return Promise.reject(
        missingIsNotFound ? new UpstreamNotFound(label) : new Error(`missing ${label}`),
      );
    }
    return Promise.resolve(body);
  }
}
