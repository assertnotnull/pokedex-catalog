import { Container } from "@needle-di/core";
import { describe, expect, test } from "bun:test";
import { CacheStore, InMemoryCacheStore } from "./cache-store";
import { CatalogueGateway } from "./catalogue-gateway";
import { Clock, FixedClock } from "./clock";
import {
  CatalogueUnavailableError,
  UnknownGameError,
  UnknownItemError,
  UnknownLocationError,
  UnknownPokemonError,
  UnknownRegionError,
} from "./errors";
import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
  type GenerationPayload,
  type ItemPayload,
  type LocationAreaPayload,
  type LocationPayload,
  type PokedexPayload,
  type RegionPayload,
  type PokemonPage,
  type VersionGroupPayload,
  type VersionPayload,
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
  itemPages?: Map<string, PokemonPage>;
  items?: Map<number, ItemPayload>;
  itemCategories?: Map<number, DescribedPayload>;
  itemAttributes?: Map<number, DescribedPayload>;
  gamePages?: Map<string, PokemonPage>;
  versions?: Map<number, VersionPayload>;
  versionGroups?: Map<number, VersionGroupPayload>;
  generations?: Map<number, GenerationPayload>;
  regionPages?: Map<string, PokemonPage>;
  regions?: Map<number, RegionPayload>;
  locations?: Map<number, LocationPayload>;
  locationAreas?: Map<number, LocationAreaPayload>;
  encounterMethods?: Map<number, DescribedPayload>;
  pokedexes?: Map<number, PokedexPayload>;
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

  test("a Pokémon without an evolution chain still returns its other detail", async () => {
    const { gateway } = openGateway(dittoCatalogue());

    expect(await gateway.getPokemon(132)).toEqual({
      nationalNumber: 132,
      frenchName: "Métamorph",
      spriteUrl: null,
      types: ["Normal"],
      stats: [{ name: "PV", value: 48 }],
      abilities: [],
      moves: [],
      evolutions: [],
    });
  });

  test("a missing Pokémon is a not-found error", async () => {
    const { gateway } = openGateway();

    await expect(gateway.getPokemon(404)).rejects.toBeInstanceOf(UnknownPokemonError);
  });

  test("an item list entry keeps only the v1 fields and resolves French names", async () => {
    const { gateway } = openGateway(itemCatalogue());

    const page = await gateway.listItems(1);

    expect(page.total).toBe(2);
    expect(page.entries).toEqual([
      {
        id: 4,
        frenchName: "Poké Ball",
        spriteUrl:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
        category: "Poké Balls",
      },
      {
        id: 1,
        frenchName: "Master Ball",
        spriteUrl: null,
        category: "Standard Balls",
      },
    ]);
  });

  test("each item list page requests the next 24 entries", async () => {
    const { gateway, upstream } = openGateway(itemCatalogue());

    await gateway.listItems(1);
    await gateway.listItems(2);

    expect(upstream.itemListCalls).toEqual([
      { offset: 0, limit: 24 },
      { offset: 24, limit: 24 },
    ]);
  });

  test("an item detail shows the French reference and the Pokémon that hold it", async () => {
    const { gateway } = openGateway(itemCatalogue());

    expect(await gateway.getItem(4)).toEqual({
      id: 4,
      frenchName: "Poké Ball",
      spriteUrl:
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
      category: "Poké Balls",
      purchasePrice: 200,
      sellPrice: 100,
      effect: "Permet de capturer un Pokémon sauvage.",
      flavorText: "Un objet pour capturer les Pokémon sauvages.",
      attributes: ["Tenue possible"],
      heldBy: [{ nationalNumber: 25, frenchName: "Pikachu" }],
    });
  });

  test("an item without prices has no purchase or sell price", async () => {
    const { gateway } = openGateway(itemCatalogue());

    const item = await gateway.getItem(1);

    expect(item.purchasePrice).toBeNull();
    expect(item.sellPrice).toBeNull();
    expect(item.frenchName).toBe("Master Ball");
  });

  test("a missing item is a not-found error", async () => {
    const { gateway } = openGateway(itemCatalogue());

    await expect(gateway.getItem(404)).rejects.toBeInstanceOf(UnknownItemError);
  });

  test("a game list entry keeps artwork, French name, and generation label", async () => {
    const { gateway } = openGateway(gameCatalogue());

    const page = await gateway.listGames(1);

    expect(page.total).toBe(2);
    expect(page.entries).toEqual([
      {
        id: 1,
        frenchName: "Rouge",
        artworkUrl: null,
        generationLabel: "1re Génération",
      },
      {
        id: 2,
        frenchName: "Blue",
        artworkUrl: null,
        generationLabel: "Generation I",
      },
    ]);
  });

  test("each game list page requests the next 24 entries", async () => {
    const { gateway, upstream } = openGateway(gameCatalogue());

    await gateway.listGames(1);
    await gateway.listGames(2);

    expect(upstream.gameListCalls).toEqual([
      { offset: 0, limit: 24 },
      { offset: 24, limit: 24 },
    ]);
  });

  test("a game detail repeats the list fields for that title", async () => {
    const { gateway } = openGateway(gameCatalogue());

    expect(await gateway.getGame(1)).toEqual({
      id: 1,
      frenchName: "Rouge",
      artworkUrl: null,
      generationLabel: "1re Génération",
    });
  });

  test("a missing game is a not-found error", async () => {
    const { gateway } = openGateway(gameCatalogue());

    await expect(gateway.getGame(404)).rejects.toBeInstanceOf(UnknownGameError);
  });

  test("a region index lists French names and how many locations each region holds", async () => {
    const { gateway } = openGateway(placeCatalogue());

    expect(await gateway.listRegions()).toEqual([
      { id: 1, frenchName: "Kanto", locationCount: 25 },
      { id: 2, frenchName: "Johto", locationCount: 0 },
    ]);
  });

  test("locations in a region are pages of 24 tiles with the region name", async () => {
    const { gateway } = openGateway(placeCatalogue());

    const first = await gateway.listLocations(1, 1);
    const second = await gateway.listLocations(1, 2);

    expect(first.total).toBe(25);
    expect(first.entries).toHaveLength(24);
    expect(first.entries[0]).toEqual({ id: 1, frenchName: "Lieu 1", regionId: 1, regionName: "Kanto" });
    expect(first.entries[1]).toEqual({
      id: 2,
      frenchName: "Route Two",
      regionId: 1,
      regionName: "Kanto",
    });
    expect(second.entries).toEqual([
      { id: 25, frenchName: "Lieu 25", regionId: 1, regionName: "Kanto" },
    ]);
  });

  test("a region with no locations is an empty page", async () => {
    const { gateway } = openGateway(placeCatalogue());

    expect(await gateway.listLocations(2, 1)).toEqual({ total: 0, entries: [] });
  });

  test("a location detail lists encounters when the source provides them", async () => {
    const { gateway } = openGateway(placeCatalogue());

    expect(await gateway.getLocation(10)).toEqual({
      id: 10,
      frenchName: "Bourg Palette",
      regionId: 1,
      regionName: "Kanto",
      encounters: [
        {
          nationalNumber: 25,
          frenchName: "Pikachu",
          appearances: [
            {
              gameId: 1,
              gameName: "Rouge",
              method: "Marche",
              minLevel: 2,
              maxLevel: 4,
              chance: 10,
            },
          ],
        },
      ],
    });
  });

  test("a location without areas has no encounters", async () => {
    const { gateway } = openGateway(placeCatalogue());

    expect((await gateway.getLocation(1)).encounters).toEqual([]);
  });

  test("a missing region or location is a not-found error", async () => {
    const { gateway } = openGateway(placeCatalogue());

    await expect(gateway.listLocations(404, 1)).rejects.toBeInstanceOf(UnknownRegionError);
    await expect(gateway.getLocation(404)).rejects.toBeInstanceOf(UnknownLocationError);
  });

  test("a game hub lists the Pokémon from that game's Pokédex, 24 per page", async () => {
    const { gateway } = openGateway(hubCatalogue());

    const first = await gateway.listPokemonForGame(1, 1);
    const second = await gateway.listPokemonForGame(1, 2);

    expect(first.total).toBe(25);
    expect(first.entries).toHaveLength(24);
    expect(first.entries[0]).toEqual({
      nationalNumber: 1,
      frenchName: "Pokémon 1",
      spriteUrl: null,
      types: [],
    });
    expect(first.entries.some((entry) => entry.nationalNumber === 99)).toBe(false);
    expect(second.entries.map((entry) => entry.nationalNumber)).toEqual([25]);
    expect(await gateway.listPokemonForGame(2, 1)).toEqual({ total: 0, entries: [] });
  });

  test("a game hub lists items linked by generation or version group", async () => {
    const { gateway } = openGateway(hubCatalogue());

    const first = await gateway.listItemsForGame(1, 1);
    const second = await gateway.listItemsForGame(1, 2);

    expect(first.total).toBe(25);
    expect(first.entries).toHaveLength(24);
    expect(first.entries[0]).toEqual({
      id: 1,
      frenchName: "Objet 1",
      spriteUrl: null,
      category: "Objets",
    });
    expect(first.entries.some((entry) => entry.id === 101)).toBe(false);
    expect(second.entries.map((entry) => entry.id)).toEqual([100]);
  });

  test("a game hub lists locations from the game's regions only", async () => {
    const { gateway } = openGateway(hubCatalogue());

    const first = await gateway.listLocationsForGame(1, 1);
    const second = await gateway.listLocationsForGame(1, 2);

    expect(first.total).toBe(25);
    expect(first.entries).toHaveLength(24);
    expect(first.entries[0]).toEqual({ id: 1, frenchName: "Lieu 1", regionId: 1, regionName: "Kanto" });
    expect(first.entries.some((entry) => entry.id === 50)).toBe(false);
    expect(second.entries).toEqual([
      { id: 25, frenchName: "Lieu 25", regionId: 1, regionName: "Kanto" },
    ]);
    expect(await gateway.listLocationsForGame(2, 1)).toEqual({ total: 0, entries: [] });
  });

  test("a missing game has no filtered lists", async () => {
    const { gateway } = openGateway(hubCatalogue());

    await expect(gateway.listPokemonForGame(404, 1)).rejects.toBeInstanceOf(UnknownGameError);
    await expect(gateway.listItemsForGame(404, 1)).rejects.toBeInstanceOf(UnknownGameError);
    await expect(gateway.listLocationsForGame(404, 1)).rejects.toBeInstanceOf(UnknownGameError);
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

function dittoCatalogue(): CatalogueFixture {
  return {
    pages: new Map(),
    pokemon: new Map([
      [
        132,
        {
          id: 132,
          sprites: { front_default: null },
          types: [{ slot: 1, type: { name: "normal", url: "https://pokeapi.co/api/v2/type/1/" } }],
          stats: [{ base_stat: 48, stat: { name: "hp", url: "https://pokeapi.co/api/v2/stat/1/" } }],
          abilities: [],
          moves: [],
          species: { name: "ditto", url: "https://pokeapi.co/api/v2/pokemon-species/132/" },
        },
      ],
    ]),
    species: new Map([
      [
        132,
        {
          id: 132,
          names: [
            { name: "Ditto", language: { name: "en" } },
            { name: "Métamorph", language: { name: "fr" } },
          ],
        },
      ],
    ]),
    types: new Map([
      [
        1,
        {
          id: 1,
          names: [
            { name: "Normal", language: { name: "en" } },
            { name: "Normal", language: { name: "fr" } },
          ],
        },
      ],
    ]),
    ...emptyRelated(),
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
    ]),
  };
}

function itemCatalogue(): CatalogueFixture {
  return {
    pages: new Map(),
    pokemon: new Map([
      [
        25,
        {
          id: 25,
          sprites: { front_default: null },
          types: [],
          stats: [],
          abilities: [],
          moves: [],
          species: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
        },
      ],
    ]),
    species: new Map([
      [
        25,
        {
          id: 25,
          names: [{ name: "Pikachu", language: { name: "fr" } }],
        },
      ],
    ]),
    types: new Map(),
    ...emptyRelated(),
    itemPages: new Map([
      [
        "0:24",
        {
          count: 2,
          results: [
            { name: "poke-ball", url: "https://pokeapi.co/api/v2/item/4/" },
            { name: "master-ball", url: "https://pokeapi.co/api/v2/item/1/" },
          ],
        },
      ],
      ["24:24", { count: 2, results: [] }],
    ]),
    items: new Map([
      [
        4,
        {
          id: 4,
          prices: [
            {
              purchase_price: 200,
              sell_price: 100,
            },
          ],
          sprites: {
            default:
              "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
          },
          category: { name: "standard-balls", url: "https://pokeapi.co/api/v2/item-category/34/" },
          attributes: [
            { name: "holdable", url: "https://pokeapi.co/api/v2/item-attribute/5/" },
          ],
          effect_entries: [
            {
              short_effect: "Permet de capturer un Pokémon sauvage.",
              language: { name: "fr" },
            },
          ],
          flavor_text_entries: [
            {
              text: "Un objet pour\ncapturer les Pokémon sauvages.",
              language: { name: "fr" },
            },
          ],
          names: [
            { name: "Poke Ball", language: { name: "en" } },
            { name: "Poké Ball", language: { name: "fr" } },
          ],
          held_by_pokemon: [
            { pokemon: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" } },
          ],
        },
      ],
      [
        1,
        {
          id: 1,
          prices: [],
          sprites: { default: null },
          category: { name: "standard-balls", url: "https://pokeapi.co/api/v2/item-category/33/" },
          attributes: [],
          effect_entries: [],
          flavor_text_entries: [],
          names: [{ name: "Master Ball", language: { name: "en" } }],
          held_by_pokemon: [],
        },
      ],
    ]),
    itemCategories: new Map([
      [
        34,
        {
          id: 34,
          names: [
            { name: "Poké Balls", language: { name: "en" } },
            { name: "Poké Balls", language: { name: "fr" } },
          ],
        },
      ],
      [
        33,
        {
          id: 33,
          names: [{ name: "Standard Balls", language: { name: "en" } }],
        },
      ],
    ]),
    itemAttributes: new Map([
      [
        5,
        {
          id: 5,
          names: [
            { name: "Holdable", language: { name: "en" } },
            { name: "Tenue possible", language: { name: "fr" } },
          ],
        },
      ],
    ]),
  };
}

function gameCatalogue(): CatalogueFixture {
  return {
    pages: new Map(),
    pokemon: new Map(),
    species: new Map(),
    types: new Map(),
    ...emptyRelated(),
    gamePages: new Map([
      [
        "0:24",
        {
          count: 2,
          results: [
            { name: "red", url: "https://pokeapi.co/api/v2/version/1/" },
            { name: "blue", url: "https://pokeapi.co/api/v2/version/2/" },
          ],
        },
      ],
      ["24:24", { count: 2, results: [] }],
    ]),
    versions: new Map([
      [
        1,
        {
          id: 1,
          names: [
            { name: "Red", language: { name: "en" } },
            { name: "Rouge", language: { name: "fr" } },
          ],
          version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
        },
      ],
      [
        2,
        {
          id: 2,
          names: [{ name: "Blue", language: { name: "en" } }],
          version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/2/" },
        },
      ],
    ]),
    versionGroups: new Map([
      [
        1,
        {
          id: 1,
          generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" },
          regions: [{ name: "kanto", url: "https://pokeapi.co/api/v2/region/1/" }],
          pokedexes: [{ name: "kanto", url: "https://pokeapi.co/api/v2/pokedex/2/" }],
        },
      ],
      [
        2,
        {
          id: 2,
          generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/2/" },
          regions: [],
          pokedexes: [],
        },
      ],
    ]),
    generations: new Map([
      [
        1,
        {
          id: 1,
          names: [
            { name: "Generation I", language: { name: "en" } },
            { name: "1re Génération", language: { name: "fr" } },
          ],
        },
      ],
      [
        2,
        {
          id: 2,
          names: [{ name: "Generation I", language: { name: "en" } }],
        },
      ],
    ]),
  };
}

function placeCatalogue(): CatalogueFixture {
  const locations = new Map<number, LocationPayload>();
  const refs: { name: string; url: string }[] = [];
  for (let id = 1; id <= 25; id += 1) {
    refs.push({ name: `lieu-${id}`, url: `https://pokeapi.co/api/v2/location/${id}/` });
    locations.set(id, {
      id,
      names:
        id === 2
          ? [{ name: "Route Two", language: { name: "en" } }]
          : [
              { name: `Place ${id}`, language: { name: "en" } },
              { name: `Lieu ${id}`, language: { name: "fr" } },
            ],
      region: { name: "kanto", url: "https://pokeapi.co/api/v2/region/1/" },
      areas: [],
    });
  }
  locations.set(10, {
    id: 10,
    names: [
      { name: "Pallet Town", language: { name: "en" } },
      { name: "Bourg Palette", language: { name: "fr" } },
    ],
    region: { name: "kanto", url: "https://pokeapi.co/api/v2/region/1/" },
    areas: [{ name: "pallet-town-area", url: "https://pokeapi.co/api/v2/location-area/10/" }],
  });

  return {
    pages: new Map(),
    pokemon: new Map([
      [
        25,
        {
          id: 25,
          sprites: { front_default: null },
          types: [],
          stats: [],
          abilities: [],
          moves: [],
          species: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
        },
      ],
    ]),
    species: new Map([[25, { id: 25, names: [{ name: "Pikachu", language: { name: "fr" } }] }]]),
    types: new Map(),
    ...emptyRelated(),
    versions: new Map([
      [
        1,
        {
          id: 1,
          names: [{ name: "Rouge", language: { name: "fr" } }],
          version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
        },
      ],
    ]),
    regionPages: new Map([
      [
        "0:100",
        {
          count: 2,
          results: [
            { name: "kanto", url: "https://pokeapi.co/api/v2/region/1/" },
            { name: "johto", url: "https://pokeapi.co/api/v2/region/2/" },
          ],
        },
      ],
    ]),
    regions: new Map([
      [
        1,
        {
          id: 1,
          names: [
            { name: "Kanto", language: { name: "en" } },
            { name: "Kanto", language: { name: "fr" } },
          ],
          locations: refs,
        },
      ],
      [
        2,
        {
          id: 2,
          names: [{ name: "Johto", language: { name: "en" } }],
          locations: [],
        },
      ],
    ]),
    locations,
    locationAreas: new Map([
      [
        10,
        {
          id: 10,
          pokemon_encounters: [
            {
              pokemon: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" },
              version_details: [
                {
                  version: { name: "red", url: "https://pokeapi.co/api/v2/version/1/" },
                  encounter_details: [
                    {
                      min_level: 2,
                      max_level: 4,
                      chance: 10,
                      method: { name: "walk", url: "https://pokeapi.co/api/v2/encounter-method/1/" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    ]),
    encounterMethods: new Map([
      [
        1,
        {
          id: 1,
          names: [
            { name: "Walk", language: { name: "en" } },
            { name: "Marche", language: { name: "fr" } },
          ],
        },
      ],
    ]),
  };
}

function hubCatalogue(): CatalogueFixture {
  const pokemon = new Map<number, PokemonPayload>();
  const species = new Map<number, SpeciesPayload>();
  const pokedexEntries: PokedexPayload["pokemon_entries"] = [];
  for (let id = 1; id <= 25; id += 1) {
    pokedexEntries.push({
      entry_number: id,
      pokemon_species: { name: `species-${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
    });
    pokemon.set(id, {
      id,
      sprites: { front_default: null },
      types: [],
      stats: [],
      abilities: [],
      moves: [],
      species: { name: `species-${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
    });
    species.set(id, { id, names: [{ name: `Pokémon ${id}`, language: { name: "fr" } }] });
  }
  pokemon.set(99, {
    id: 99,
    sprites: { front_default: null },
    types: [],
    stats: [],
    abilities: [],
    moves: [],
    species: { name: "missingno", url: "https://pokeapi.co/api/v2/pokemon-species/99/" },
  });
  species.set(99, { id: 99, names: [{ name: "Missingno", language: { name: "en" } }] });

  const itemResults: { name: string; url: string }[] = [];
  const items = new Map<number, ItemPayload>();
  const category = { name: "items", url: "https://pokeapi.co/api/v2/item-category/1/" };
  for (let id = 1; id <= 24; id += 1) {
    itemResults.push({ name: `item-${id}`, url: `https://pokeapi.co/api/v2/item/${id}/` });
    items.set(id, itemBody(id, `Objet ${id}`, [{ generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" } }], []));
  }
  itemResults.push({ name: "flavor-item", url: "https://pokeapi.co/api/v2/item/100/" });
  items.set(
    100,
    itemBody(100, "Objet parfumé", [], [
      {
        text: "Parfum.",
        language: { name: "fr" },
        version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
      },
    ]),
  );
  itemResults.push({ name: "other-item", url: "https://pokeapi.co/api/v2/item/101/" });
  items.set(101, itemBody(101, "Objet d’ailleurs", [{ generation: { name: "generation-ii", url: "https://pokeapi.co/api/v2/generation/2/" } }], []));

  const locationRefs = Array.from({ length: 25 }, (_, index) => {
    const id = index + 1;
    return { name: `lieu-${id}`, url: `https://pokeapi.co/api/v2/location/${id}/` };
  });
  const locations = new Map<number, LocationPayload>();
  for (const ref of locationRefs) {
    const id = Number(/\/(\d+)\/?$/.exec(ref.url)?.[1]);
    locations.set(id, {
      id,
      names: [{ name: `Lieu ${id}`, language: { name: "fr" } }],
      region: { name: "kanto", url: "https://pokeapi.co/api/v2/region/1/" },
      areas: [],
    });
  }
  locations.set(50, {
    id: 50,
    names: [{ name: "Elsewhere", language: { name: "en" } }],
    region: { name: "johto", url: "https://pokeapi.co/api/v2/region/2/" },
    areas: [],
  });

  return {
    pages: new Map(),
    pokemon,
    species,
    types: new Map(),
    ...emptyRelated(),
    itemPages: new Map([["0:10000", { count: itemResults.length, results: itemResults }]]),
    items,
    itemCategories: new Map([
      [1, { id: 1, names: [{ name: "Objets", language: { name: "fr" } }] }],
    ]),
    versions: new Map([
      [
        1,
        {
          id: 1,
          names: [{ name: "Rouge", language: { name: "fr" } }],
          version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
        },
      ],
      [
        2,
        {
          id: 2,
          names: [{ name: "Bleu", language: { name: "fr" } }],
          version_group: { name: "blue", url: "https://pokeapi.co/api/v2/version-group/9/" },
        },
      ],
    ]),
    versionGroups: new Map([
      [
        1,
        {
          id: 1,
          generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" },
          regions: [{ name: "kanto", url: "https://pokeapi.co/api/v2/region/1/" }],
          pokedexes: [{ name: "kanto", url: "https://pokeapi.co/api/v2/pokedex/2/" }],
        },
      ],
      [
        9,
        {
          id: 9,
          generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" },
          regions: [],
          pokedexes: [],
        },
      ],
    ]),
    regions: new Map([
      [1, { id: 1, names: [{ name: "Kanto", language: { name: "fr" } }], locations: locationRefs }],
      [
        2,
        {
          id: 2,
          names: [{ name: "Johto", language: { name: "fr" } }],
          locations: [{ name: "elsewhere", url: "https://pokeapi.co/api/v2/location/50/" }],
        },
      ],
    ]),
    locations,
    pokedexes: new Map([[2, { id: 2, pokemon_entries: pokedexEntries }]]),
  };

  function itemBody(
    id: number,
    frenchName: string,
    gameIndices: { generation: { name: string; url: string } }[],
    flavor: ItemPayload["flavor_text_entries"],
  ): ItemPayload {
    return {
      id,
      prices: [],
      sprites: { default: null },
      category,
      attributes: [],
      effect_entries: [],
      flavor_text_entries: flavor,
      names: [{ name: frenchName, language: { name: "fr" } }],
      held_by_pokemon: [],
      game_indices: gameIndices,
    };
  }
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
  itemListCalls: { offset: number; limit: number }[] = [];
  gameListCalls: { offset: number; limit: number }[] = [];

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

  listItems(offset: number, limit: number): Promise<PokemonPage> {
    this.itemListCalls.push({ offset, limit });
    return this.read(
      () => this.fixture.itemPages?.get(`${offset}:${limit}`),
      `item page ${offset}:${limit}`,
    );
  }

  getItem(id: number): Promise<ItemPayload> {
    return this.read(() => this.fixture.items?.get(id), `item ${id}`, true);
  }

  getItemCategory(id: number): Promise<DescribedPayload> {
    return this.read(() => this.fixture.itemCategories?.get(id), `item category ${id}`);
  }

  getItemAttribute(id: number): Promise<DescribedPayload> {
    return this.read(() => this.fixture.itemAttributes?.get(id), `item attribute ${id}`);
  }

  listVersions(offset: number, limit: number): Promise<PokemonPage> {
    this.gameListCalls.push({ offset, limit });
    return this.read(
      () => this.fixture.gamePages?.get(`${offset}:${limit}`),
      `version page ${offset}:${limit}`,
    );
  }

  getVersion(id: number): Promise<VersionPayload> {
    return this.read(() => this.fixture.versions?.get(id), `version ${id}`, true);
  }

  getVersionGroup(id: number): Promise<VersionGroupPayload> {
    return this.read(() => this.fixture.versionGroups?.get(id), `version group ${id}`);
  }

  getGeneration(id: number): Promise<GenerationPayload> {
    return this.read(() => this.fixture.generations?.get(id), `generation ${id}`);
  }

  listRegions(offset: number, limit: number): Promise<PokemonPage> {
    return this.read(
      () => this.fixture.regionPages?.get(`${offset}:${limit}`),
      `region page ${offset}:${limit}`,
    );
  }

  getRegion(id: number): Promise<RegionPayload> {
    return this.read(() => this.fixture.regions?.get(id), `region ${id}`, true);
  }

  getLocation(id: number): Promise<LocationPayload> {
    return this.read(() => this.fixture.locations?.get(id), `location ${id}`, true);
  }

  getLocationArea(id: number): Promise<LocationAreaPayload> {
    return this.read(() => this.fixture.locationAreas?.get(id), `location area ${id}`);
  }

  getEncounterMethod(id: number): Promise<DescribedPayload> {
    return this.read(() => this.fixture.encounterMethods?.get(id), `encounter method ${id}`);
  }

  getPokedex(id: number): Promise<PokedexPayload> {
    return this.read(() => this.fixture.pokedexes?.get(id), `pokedex ${id}`);
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
