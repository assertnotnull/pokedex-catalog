import { Container } from "@needle-di/core";
import { describe, expect, test } from "bun:test";
import { CacheStore, InMemoryCacheStore } from "./cache-store";
import { CatalogueGateway } from "./catalogue-gateway";
import { Clock, FixedClock } from "./clock";
import {
  CatalogueUnavailableError,
  UnknownGameError,
  UnknownItemError,
  UnknownPokemonError,
} from "./errors";
import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
  type ItemPayload,
  type LocationPayload,
  type PokemonPage,
  type PokemonPayload,
  type PokedexPayload,
  type RegionPayload,
  type SpeciesPayload,
  type TypePayload,
  type VersionGroupPayload,
  type VersionPayload,
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
  itemIndex?: { name: string; url: string }[];
  items?: Map<number, ItemPayload>;
  itemCategories?: Map<number, DescribedPayload>;
  itemAttributes?: Map<number, DescribedPayload>;
  versions?: Map<
    number,
    {
      id: number;
      name: string;
      names: { name: string; language: { name: string } }[];
      version_group: { name: string; url: string };
    }
  >;
  versionGroups?: Map<
    number,
    {
      id: number;
      name: string;
      generation?: { name: string; url: string };
      pokedexes: { name: string; url: string }[];
      regions: { name: string; url: string }[];
    }
  >;
  pokedexes?: Map<number, PokedexPayload>;
  regions?: Map<number, RegionPayload>;
  locations?: Map<number, LocationPayload>;
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

  test("a Game hub lists only the Pokémon linked to that version, in French", async () => {
    const { gateway } = openGateway(redBlueCatalogue());

    const page = await gateway.listPokemonForGame(1, 1);

    expect(page).toEqual({
      total: 2,
      entries: [
        {
          nationalNumber: 1,
          frenchName: "Bulbizarre",
          spriteUrl:
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
          types: ["Plante", "Poison"],
        },
        {
          nationalNumber: 25,
          frenchName: "Pikachu",
          spriteUrl: null,
          types: ["Electric"],
        },
      ],
    });
  });

  test("a Game hub paginates its Pokémon 24 at a time", async () => {
    const { gateway } = openGateway(pagedPokedexCatalogue());

    const first = await gateway.listPokemonForGame(1, 1);
    const second = await gateway.listPokemonForGame(1, 2);

    expect(first.total).toBe(25);
    expect(first.entries).toHaveLength(24);
    expect(first.entries[0]).toEqual({
      nationalNumber: 1,
      frenchName: "Bulbizarre",
      spriteUrl: null,
      types: ["Plante"],
    });
    expect(second).toEqual({
      total: 25,
      entries: [
        {
          nationalNumber: 25,
          frenchName: "Pikachu",
          spriteUrl: null,
          types: ["Electric"],
        },
      ],
    });
  });

  test("a Game with no Pokédex linkage returns an empty Pokémon list", async () => {
    const fixture = redBlueCatalogue();
    fixture.versionGroups?.set(1, {
      id: 1,
      name: "red-blue",
      pokedexes: [],
      regions: [],
    });
    const { gateway } = openGateway(fixture);

    expect(await gateway.listPokemonForGame(1, 1)).toEqual({ total: 0, entries: [] });
  });

  test("a missing upstream Pokédex is an empty Pokémon list", async () => {
    const fixture = redBlueCatalogue();
    fixture.versionGroups?.set(1, {
      id: 1,
      name: "red-blue",
      pokedexes: [{ name: "missing", url: "https://pokeapi.co/api/v2/pokedex/9/" }],
      regions: [],
    });
    const { gateway } = openGateway(fixture);

    expect(await gateway.listPokemonForGame(1, 1)).toEqual({ total: 0, entries: [] });
  });

  test("Pokémon listed in two Pokédexes appear once, in the first order", async () => {
    const fixture = redBlueCatalogue();
    fixture.versionGroups?.set(1, {
      id: 1,
      name: "red-blue",
      pokedexes: [
        { name: "kanto", url: "https://pokeapi.co/api/v2/pokedex/2/" },
        { name: "extra", url: "https://pokeapi.co/api/v2/pokedex/3/" },
      ],
      regions: [],
    });
    fixture.pokedexes?.set(3, {
      id: 3,
      pokemon_entries: [
        {
          pokemon_species: {
            name: "pikachu",
            url: "https://pokeapi.co/api/v2/pokemon-species/25/",
          },
        },
        {
          pokemon_species: {
            name: "chikorita",
            url: "https://pokeapi.co/api/v2/pokemon-species/152/",
          },
        },
      ],
    });
    const { gateway } = openGateway(fixture);

    const page = await gateway.listPokemonForGame(1, 1);

    expect(page.total).toBe(3);
    expect(page.entries.map((entry) => entry.frenchName)).toEqual([
      "Bulbizarre",
      "Pikachu",
      "Germignon",
    ]);
  });

  test("an unknown Game is not an empty Pokémon list", async () => {
    const { gateway } = openGateway(redBlueCatalogue());

    await expect(gateway.listPokemonForGame(404, 1)).rejects.toBeInstanceOf(UnknownGameError);
  });

  test("a Game hub lists only the items linked to that version's generation", async () => {
    const { gateway } = openGateway(generationItemsCatalogue());

    expect(await gateway.listItemsForGame(1, 1)).toEqual({
      total: 1,
      entries: [
        {
          id: 17,
          frenchName: "Potion",
          spriteUrl:
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png",
          category: "Médicaments",
        },
      ],
    });
    expect(await gateway.listItemsForGame(2, 1)).toEqual({
      total: 1,
      entries: [
        {
          id: 80,
          frenchName: "Pierre Soleil",
          spriteUrl: null,
          category: "Evolution Stones",
        },
      ],
    });
  });

  test("a Game with no generation linkage returns an empty item list", async () => {
    const fixture = generationItemsCatalogue();
    fixture.versionGroups?.set(1, {
      id: 1,
      name: "red-blue",
      pokedexes: [],
      regions: [],
    });
    const { gateway } = openGateway(fixture);

    expect(await gateway.listItemsForGame(1, 1)).toEqual({ total: 0, entries: [] });
  });

  test("a Game hub paginates its items 24 at a time", async () => {
    const { gateway } = openGateway(pagedItemsCatalogue());

    const first = await gateway.listItemsForGame(1, 1);
    const second = await gateway.listItemsForGame(1, 2);

    expect(first.total).toBe(25);
    expect(first.entries).toHaveLength(24);
    expect(first.entries[0]).toEqual({
      id: 1,
      frenchName: "Potion",
      spriteUrl: null,
      category: "Médicaments",
    });
    expect(second).toEqual({
      total: 25,
      entries: [
        {
          id: 25,
          frenchName: "Rappel",
          spriteUrl: null,
          category: "Médicaments",
        },
      ],
    });
  });

  test("an item with no French or English name is left off the Game hub list", async () => {
    const fixture = generationItemsCatalogue();
    const unnamed = bareItem(41, "なし", [1]);
    unnamed.names = [{ name: "なし", language: { name: "ja-hrkt" } }];
    fixture.items?.set(41, unnamed);
    fixture.itemIndex?.push({ name: "unnamed", url: "https://pokeapi.co/api/v2/item/41/" });
    const { gateway } = openGateway(fixture);

    const page = await gateway.listItemsForGame(1, 1);

    expect(page.entries.map((entry) => entry.frenchName)).toEqual(["Potion"]);
  });

  test("an item missing upstream is left off the Game hub list", async () => {
    const fixture = generationItemsCatalogue();
    fixture.itemIndex?.push({ name: "missing", url: "https://pokeapi.co/api/v2/item/404/" });
    const { gateway } = openGateway(fixture);

    const page = await gateway.listItemsForGame(1, 1);

    expect(page.total).toBe(1);
    expect(page.entries.map((entry) => entry.frenchName)).toEqual(["Potion"]);
  });

  test("an unknown Game is not an empty item list", async () => {
    const { gateway } = openGateway(generationItemsCatalogue());

    await expect(gateway.listItemsForGame(404, 1)).rejects.toBeInstanceOf(UnknownGameError);
  });

  test("a Game hub lists only the locations linked to that version, in French", async () => {
    const { gateway } = openGateway(kantoLocationsCatalogue());

    expect(await gateway.listLocationsForGame(1, 1)).toEqual({
      total: 2,
      entries: [
        { id: 86, frenchName: "Bourg Palette", region: "Kanto", regionId: 1 },
        { id: 67, frenchName: "Celadon City", region: "Kanto", regionId: 1 },
      ],
    });
  });

  test("locations from each region of the version keep that region's French name", async () => {
    const fixture = kantoLocationsCatalogue();
    fixture.versionGroups?.get(1)?.regions.push({
      name: "johto",
      url: "https://pokeapi.co/api/v2/region/2/",
    });
    const { gateway } = openGateway(fixture);

    const page = await gateway.listLocationsForGame(1, 1);

    expect(page.entries).toEqual([
      { id: 86, frenchName: "Bourg Palette", region: "Kanto", regionId: 1 },
      { id: 67, frenchName: "Celadon City", region: "Kanto", regionId: 1 },
      { id: 100, frenchName: "Mauville", region: "Johto", regionId: 2 },
    ]);
  });

  test("a Game with no region linkage returns an empty location list", async () => {
    const fixture = kantoLocationsCatalogue();
    fixture.versionGroups?.set(1, {
      id: 1,
      name: "red-blue",
      pokedexes: [],
      regions: [],
    });
    const { gateway } = openGateway(fixture);

    expect(await gateway.listLocationsForGame(1, 1)).toEqual({ total: 0, entries: [] });
  });

  test("a location with no French or English name is left off the Game hub list", async () => {
    const fixture = kantoLocationsCatalogue();
    fixture.regions?.get(1)?.locations.push({
      name: "unnamed",
      url: "https://pokeapi.co/api/v2/location/50/",
    });
    fixture.locations?.set(50, {
      id: 50,
      names: [{ name: "無名", language: { name: "ja-hrkt" } }],
    });
    const { gateway } = openGateway(fixture);

    const page = await gateway.listLocationsForGame(1, 1);

    expect(page.total).toBe(2);
    expect(page.entries.map((entry) => entry.frenchName)).toEqual([
      "Bourg Palette",
      "Celadon City",
    ]);
  });

  test("a location missing upstream is left off the Game hub list", async () => {
    const fixture = kantoLocationsCatalogue();
    fixture.regions?.get(1)?.locations.push({
      name: "missing",
      url: "https://pokeapi.co/api/v2/location/404/",
    });
    const { gateway } = openGateway(fixture);

    expect(await gateway.listLocationsForGame(1, 1)).toEqual({
      total: 2,
      entries: [
        { id: 86, frenchName: "Bourg Palette", region: "Kanto", regionId: 1 },
        { id: 67, frenchName: "Celadon City", region: "Kanto", regionId: 1 },
      ],
    });
  });

  test("a Game hub paginates its locations 24 at a time", async () => {
    const { gateway } = openGateway(pagedLocationsCatalogue());

    const first = await gateway.listLocationsForGame(1, 1);
    const second = await gateway.listLocationsForGame(1, 2);

    expect(first.total).toBe(25);
    expect(first.entries).toHaveLength(24);
    expect(first.entries[0]).toEqual({
      id: 1,
      frenchName: "Bourg Palette",
      region: "Kanto",
      regionId: 1,
    });
    expect(second).toEqual({
      total: 25,
      entries: [{ id: 25, frenchName: "Plateau Indigo", region: "Kanto", regionId: 1 }],
    });
  });

  test("an unknown Game is not an empty location list", async () => {
    const { gateway } = openGateway(kantoLocationsCatalogue());

    await expect(gateway.listLocationsForGame(404, 1)).rejects.toBeInstanceOf(UnknownGameError);
  });

  test("a Game summary uses the French name and falls back to English", async () => {
    const fixture = redBlueCatalogue();
    fixture.versions?.set(2, {
      id: 2,
      name: "blue",
      names: [{ name: "Blue", language: { name: "en" } }],
      version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
    });
    const { gateway } = openGateway(fixture);

    expect(await gateway.getGame(1)).toEqual({ id: 1, frenchName: "Rouge" });
    expect(await gateway.getGame(2)).toEqual({ id: 2, frenchName: "Blue" });
    await expect(gateway.getGame(404)).rejects.toBeInstanceOf(UnknownGameError);
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

function redBlueCatalogue(): CatalogueFixture {
  return {
    pages: new Map(),
    pokemon: new Map([
      [
        1,
        {
          id: 1,
          sprites: {
            front_default:
              "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
          },
          types: [
            { slot: 2, type: { name: "poison", url: "https://pokeapi.co/api/v2/type/4/" } },
            { slot: 1, type: { name: "grass", url: "https://pokeapi.co/api/v2/type/12/" } },
          ],
          stats: [],
          abilities: [],
          moves: [],
          species: { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon-species/1/" },
        },
      ],
      [
        25,
        {
          id: 25,
          sprites: { front_default: null },
          types: [
            { slot: 1, type: { name: "electric", url: "https://pokeapi.co/api/v2/type/13/" } },
          ],
          stats: [],
          abilities: [],
          moves: [],
          species: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
        },
      ],
      [
        152,
        {
          id: 152,
          sprites: { front_default: null },
          types: [
            { slot: 1, type: { name: "grass", url: "https://pokeapi.co/api/v2/type/12/" } },
          ],
          stats: [],
          abilities: [],
          moves: [],
          species: { name: "chikorita", url: "https://pokeapi.co/api/v2/pokemon-species/152/" },
        },
      ],
    ]),
    species: new Map([
      [
        1,
        {
          id: 1,
          names: [
            { name: "Bulbasaur", language: { name: "en" } },
            { name: "Bulbizarre", language: { name: "fr" } },
          ],
        },
      ],
      [
        25,
        {
          id: 25,
          names: [{ name: "Pikachu", language: { name: "en" } }],
        },
      ],
      [
        152,
        {
          id: 152,
          names: [
            { name: "Chikorita", language: { name: "en" } },
            { name: "Germignon", language: { name: "fr" } },
          ],
        },
      ],
    ]),
    types: new Map([
      [
        12,
        {
          id: 12,
          names: [
            { name: "Grass", language: { name: "en" } },
            { name: "Plante", language: { name: "fr" } },
          ],
        },
      ],
      [
        4,
        {
          id: 4,
          names: [
            { name: "Poison", language: { name: "en" } },
            { name: "Poison", language: { name: "fr" } },
          ],
        },
      ],
      [
        13,
        {
          id: 13,
          names: [{ name: "Electric", language: { name: "en" } }],
        },
      ],
    ]),
    ...emptyRelated(),
    versions: new Map([
      [
        1,
        {
          id: 1,
          name: "red",
          names: [
            { name: "Red", language: { name: "en" } },
            { name: "Rouge", language: { name: "fr" } },
          ],
          version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
        },
      ],
    ]),
    versionGroups: new Map([
      [
        1,
        {
          id: 1,
          name: "red-blue",
          generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" },
          pokedexes: [{ name: "kanto", url: "https://pokeapi.co/api/v2/pokedex/2/" }],
          regions: [{ name: "kanto", url: "https://pokeapi.co/api/v2/region/1/" }],
        },
      ],
    ]),
    pokedexes: new Map([
      [
        2,
        {
          id: 2,
          pokemon_entries: [
            {
              pokemon_species: {
                name: "bulbasaur",
                url: "https://pokeapi.co/api/v2/pokemon-species/1/",
              },
            },
            {
              pokemon_species: {
                name: "pikachu",
                url: "https://pokeapi.co/api/v2/pokemon-species/25/",
              },
            },
          ],
        },
      ],
    ]),
  };
}

function pagedPokedexCatalogue(): CatalogueFixture {
  const pokemon = new Map<number, PokemonPayload>();
  const species = new Map<number, SpeciesPayload>();
  const entries: PokedexPayload["pokemon_entries"] = [];
  for (let id = 1; id <= 25; id += 1) {
    const french = id === 1 ? "Bulbizarre" : id === 25 ? "Pikachu" : `Monstre ${id}`;
    const typeId = id === 25 ? 13 : 12;
    pokemon.set(id, {
      id,
      sprites: { front_default: null },
      types: [
        {
          slot: 1,
          type: { name: "type", url: `https://pokeapi.co/api/v2/type/${typeId}/` },
        },
      ],
      stats: [],
      abilities: [],
      moves: [],
      species: { name: `species-${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
    });
    species.set(id, {
      id,
      names:
        id === 25
          ? [{ name: "Pikachu", language: { name: "en" } }]
          : [
              { name: `Monster ${id}`, language: { name: "en" } },
              { name: french, language: { name: "fr" } },
            ],
    });
    entries.push({
      pokemon_species: {
        name: `species-${id}`,
        url: `https://pokeapi.co/api/v2/pokemon-species/${id}/`,
      },
    });
  }

  return {
    pages: new Map(),
    pokemon,
    species,
    types: new Map([
      [
        12,
        {
          id: 12,
          names: [
            { name: "Grass", language: { name: "en" } },
            { name: "Plante", language: { name: "fr" } },
          ],
        },
      ],
      [
        13,
        { id: 13, names: [{ name: "Electric", language: { name: "en" } }] },
      ],
    ]),
    ...emptyRelated(),
    versions: new Map([
      [
        1,
        {
          id: 1,
          name: "red",
          names: [{ name: "Rouge", language: { name: "fr" } }],
          version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
        },
      ],
    ]),
    versionGroups: new Map([
      [
        1,
        {
          id: 1,
          name: "red-blue",
          pokedexes: [{ name: "kanto", url: "https://pokeapi.co/api/v2/pokedex/2/" }],
          regions: [],
        },
      ],
    ]),
    pokedexes: new Map([[2, { id: 2, pokemon_entries: entries }]]),
  };
}

function generationItemsCatalogue(): CatalogueFixture {
  const items = new Map<number, ItemPayload>();
  const itemIndex: { name: string; url: string }[] = [];
  for (let id = 100; id < 124; id += 1) {
    items.set(id, bareItem(id, `Objet ${id}`, []));
    itemIndex.push({ name: `item-${id}`, url: `https://pokeapi.co/api/v2/item/${id}/` });
  }
  items.set(80, {
    ...bareItem(80, "Pierre Soleil", [2]),
    names: [
      { name: "Sun Stone", language: { name: "en" } },
      { name: "Pierre Soleil", language: { name: "fr" } },
    ],
    category: { name: "evolution-stones", url: "https://pokeapi.co/api/v2/item-category/12/" },
  });
  items.set(17, {
    ...bareItem(17, "Potion", [1]),
    sprites: {
      default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png",
    },
    category: { name: "healing", url: "https://pokeapi.co/api/v2/item-category/30/" },
  });
  itemIndex.push(
    { name: "sun-stone", url: "https://pokeapi.co/api/v2/item/80/" },
    { name: "potion", url: "https://pokeapi.co/api/v2/item/17/" },
  );

  return {
    pages: new Map(),
    pokemon: new Map(),
    species: new Map(),
    types: new Map(),
    ...emptyRelated(),
    versions: new Map([
      [
        1,
        {
          id: 1,
          name: "red",
          names: [{ name: "Rouge", language: { name: "fr" } }],
          version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
        },
      ],
      [
        2,
        {
          id: 2,
          name: "gold",
          names: [{ name: "Or", language: { name: "fr" } }],
          version_group: { name: "gold-silver", url: "https://pokeapi.co/api/v2/version-group/3/" },
        },
      ],
    ]),
    versionGroups: new Map([
      [
        1,
        {
          id: 1,
          name: "red-blue",
          generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" },
          pokedexes: [],
          regions: [],
        },
      ],
      [
        3,
        {
          id: 3,
          name: "gold-silver",
          generation: { name: "generation-ii", url: "https://pokeapi.co/api/v2/generation/2/" },
          pokedexes: [],
          regions: [],
        },
      ],
    ]),
    itemIndex,
    items,
    itemCategories: new Map([
      [
        30,
        {
          id: 30,
          names: [
            { name: "Medicine", language: { name: "en" } },
            { name: "Médicaments", language: { name: "fr" } },
          ],
        },
      ],
      [
        12,
        {
          id: 12,
          names: [{ name: "Evolution Stones", language: { name: "en" } }],
        },
      ],
      [
        1,
        {
          id: 1,
          names: [{ name: "Divers", language: { name: "fr" } }],
        },
      ],
    ]),
  };
}

function pagedItemsCatalogue(): CatalogueFixture {
  const items = new Map<number, ItemPayload>();
  const itemIndex: { name: string; url: string }[] = [];
  for (let id = 1; id <= 25; id += 1) {
    const french = id === 1 ? "Potion" : id === 25 ? "Rappel" : `Objet ${id}`;
    const item = bareItem(id, french, [1]);
    if (id === 1 || id === 25) {
      item.category = { name: "healing", url: "https://pokeapi.co/api/v2/item-category/30/" };
    }
    items.set(id, item);
    itemIndex.push({ name: `item-${id}`, url: `https://pokeapi.co/api/v2/item/${id}/` });
  }
  const base = generationItemsCatalogue();
  return { ...base, items, itemIndex };
}

function kantoLocationsCatalogue(): CatalogueFixture {
  const base = redBlueCatalogue();
  base.versionGroups?.set(1, {
    id: 1,
    name: "red-blue",
    generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" },
    pokedexes: [{ name: "kanto", url: "https://pokeapi.co/api/v2/pokedex/2/" }],
    regions: [{ name: "kanto", url: "https://pokeapi.co/api/v2/region/1/" }],
  });
  base.regions = new Map([
    [
      1,
      {
        id: 1,
        names: [
          { name: "Kanto", language: { name: "en" } },
          { name: "Kanto", language: { name: "fr" } },
        ],
        locations: [
          { name: "pallet-town", url: "https://pokeapi.co/api/v2/location/86/" },
          { name: "celadon-city", url: "https://pokeapi.co/api/v2/location/67/" },
        ],
      },
    ],
    [
      2,
      {
        id: 2,
        names: [{ name: "Johto", language: { name: "fr" } }],
        locations: [{ name: "violet-city", url: "https://pokeapi.co/api/v2/location/100/" }],
      },
    ],
  ]);
  base.locations = new Map([
    [
      86,
      {
        id: 86,
        names: [
          { name: "Pallet Town", language: { name: "en" } },
          { name: "Bourg Palette", language: { name: "fr" } },
        ],
      },
    ],
    [
      67,
      {
        id: 67,
        names: [{ name: "Celadon City", language: { name: "en" } }],
      },
    ],
    [
      100,
      {
        id: 100,
        names: [{ name: "Mauville", language: { name: "fr" } }],
      },
    ],
  ]);
  return base;
}

function pagedLocationsCatalogue(): CatalogueFixture {
  const fixture = kantoLocationsCatalogue();
  const locations = new Map<number, LocationPayload>();
  const refs: { name: string; url: string }[] = [];
  for (let id = 1; id <= 25; id += 1) {
    const french = id === 1 ? "Bourg Palette" : id === 25 ? "Plateau Indigo" : `Lieu ${id}`;
    locations.set(id, {
      id,
      names: [{ name: french, language: { name: "fr" } }],
    });
    refs.push({ name: `location-${id}`, url: `https://pokeapi.co/api/v2/location/${id}/` });
  }
  fixture.locations = locations;
  fixture.regions?.set(1, {
    id: 1,
    names: [
      { name: "Kanto", language: { name: "en" } },
      { name: "Kanto", language: { name: "fr" } },
    ],
    locations: refs,
  });
  return fixture;
}

function bareItem(id: number, frenchName: string, generationIds: number[]): ItemPayload {
  return {
    id,
    prices: [],
    sprites: { default: null },
    category: { name: "misc", url: "https://pokeapi.co/api/v2/item-category/1/" },
    attributes: [],
    effect_entries: [],
    flavor_text_entries: [],
    names: [{ name: frenchName, language: { name: "fr" } }],
    held_by_pokemon: [],
    game_indices: generationIds.map((generationId) => ({
      generation: {
        name: `generation-${generationId}`,
        url: `https://pokeapi.co/api/v2/generation/${generationId}/`,
      },
    })),
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
  itemListCalls: { offset: number; limit: number }[] = [];

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
    if (this.fixture.itemIndex) {
      const index = this.fixture.itemIndex;
      return this.read(
        () => ({ count: index.length, results: index.slice(offset, offset + limit) }),
        "item index",
      );
    }
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

  getVersion(id: number): Promise<VersionPayload> {
    return this.read(() => this.fixture.versions?.get(id), `version ${id}`, true);
  }

  getVersionGroup(id: number): Promise<VersionGroupPayload> {
    return this.read(() => this.fixture.versionGroups?.get(id), `version group ${id}`, true);
  }

  getPokedex(id: number): Promise<PokedexPayload> {
    return this.read(() => this.fixture.pokedexes?.get(id), `pokedex ${id}`, true);
  }

  getRegion(id: number): Promise<RegionPayload> {
    return this.read(() => this.fixture.regions?.get(id), `region ${id}`, true);
  }

  getLocation(id: number): Promise<LocationPayload> {
    return this.read(() => this.fixture.locations?.get(id), `location ${id}`, true);
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
