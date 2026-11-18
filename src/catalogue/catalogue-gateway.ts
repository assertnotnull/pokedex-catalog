import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "./cache-store";
import { Clock } from "./clock";
import {
  CatalogueUnavailableError,
  MissingLocalizedNameError,
  UnknownGameError,
  UnknownItemError,
  UnknownPokemonError,
} from "./errors";
import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
  type EvolutionLink,
  type GenerationPayload,
  type ItemPayload,
  type LocalizedName,
  type LocationPayload,
  type PokemonPayload,
  type PokedexPayload,
  type RegionPayload,
  type SpeciesPayload,
  type TypePayload,
  type VersionGroupPayload,
  type VersionPayload,
} from "./poke-api";

export const LIST_PAGE_SIZE = 24;
export const POKEMON_PAGE_SIZE = LIST_PAGE_SIZE;
const FRESH_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const UPSTREAM_CONCURRENCY = 16;

export type PokemonListEntry = {
  nationalNumber: number;
  frenchName: string;
  spriteUrl: string | null;
  types: string[];
};

export type PokemonListPage = {
  total: number;
  entries: PokemonListEntry[];
};

export type GameListEntry = {
  id: number;
  frenchName: string;
  artworkUrl: string | null;
  generationLabel: string;
};

export type GameListPage = {
  total: number;
  entries: GameListEntry[];
};

export type ItemListEntry = {
  id: number;
  frenchName: string;
  spriteUrl: string | null;
  category: string;
};

export type ItemListPage = {
  total: number;
  entries: ItemListEntry[];
};

export type PokemonDetail = {
  nationalNumber: number;
  frenchName: string;
  spriteUrl: string | null;
  types: string[];
  stats: { name: string; value: number }[];
  abilities: { name: string; isHidden: boolean }[];
  moves: { name: string }[];
  evolutions: { nationalNumber: number; frenchName: string }[];
};

export type LocationListEntry = {
  id: number;
  frenchName: string;
  region: string;
  regionId: number;
};

export type LocationListPage = {
  total: number;
  entries: LocationListEntry[];
};

export type ItemDetail = {
  id: number;
  frenchName: string;
  spriteUrl: string | null;
  category: string;
  purchasePrice: number | null;
  sellPrice: number | null;
  effect: string | null;
  flavorText: string | null;
  attributes: string[];
  heldBy: { nationalNumber: number; frenchName: string }[];
};

@injectable()
export class CatalogueGateway {
  constructor(
    private readonly cache = inject(CacheStore),
    private readonly upstream = inject(PokeApi),
    private readonly clock = inject(Clock),
  ) {}

  async listGames(page: number): Promise<GameListPage> {
    const offset = (page - 1) * LIST_PAGE_SIZE;
    const list = await this.load(`version-list:${LIST_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listVersions(offset, LIST_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.gameEntry(idFromUrl(result.url))),
    );
    return { total: list.count, entries };
  }

  async getGame(id: number): Promise<GameListEntry> {
    await this.gameOrNotFound(id);
    return this.gameEntry(id);
  }

  async listItems(page: number): Promise<ItemListPage> {
    const offset = (page - 1) * LIST_PAGE_SIZE;
    const list = await this.load(`item-list:${LIST_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listItems(offset, LIST_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.itemListEntry(idFromUrl(result.url))),
    );
    return { total: list.count, entries };
  }

  async getItem(id: number): Promise<ItemDetail> {
    const item = await this.itemOrNotFound(id);
    const [category, attributes, heldBy] = await Promise.all([
      this.described(`item-category`, item.category.url, (categoryId) =>
        this.upstream.getItemCategory(categoryId),
      ),
      Promise.all(
        item.attributes.map((attribute) =>
          this.described(`item-attribute`, attribute.url, (attributeId) =>
            this.upstream.getItemAttribute(attributeId),
          ),
        ),
      ),
      Promise.all(
        item.held_by_pokemon.map(async (held) => {
          const nationalNumber = idFromUrl(held.pokemon.url);
          const pokemon = await this.load<PokemonPayload>(`pokemon:${nationalNumber}`, () =>
            this.upstream.getPokemon(nationalNumber),
          );
          const species = await this.species(pokemon);
          return { nationalNumber, frenchName: localizedName(species.names) };
        }),
      ),
    ]);

    return {
      id: item.id,
      frenchName: localizedName(item.names),
      spriteUrl: item.sprites.default,
      category: localizedName(category.names),
      purchasePrice: firstPrice(item.prices, "purchase_price"),
      sellPrice: firstPrice(item.prices, "sell_price"),
      effect: localizedProse(item.effect_entries, "short_effect"),
      flavorText: localizedProse(item.flavor_text_entries, "text"),
      attributes: attributes.map((attribute) => localizedName(attribute.names)),
      heldBy,
    };
  }

  async listPokemonForGame(gameId: number, page: number): Promise<PokemonListPage> {
    const speciesIds = await this.speciesIdsForGame(gameId);
    return this.pageEntries(speciesIds, page, (id) => this.listEntry(id));
  }

  async listItemsForGame(gameId: number, page: number): Promise<ItemListPage> {
    const itemIds = await this.itemIdsForGame(gameId);
    const offset = (page - 1) * LIST_PAGE_SIZE;
    const loaded = await Promise.all(
      itemIds.slice(offset, offset + LIST_PAGE_SIZE).map(async (id) => {
        try {
          return await this.itemListEntry(id);
        } catch (error) {
          if (error instanceof MissingLocalizedNameError) {
            return null;
          }
          throw error;
        }
      }),
    );
    return {
      total: itemIds.length,
      entries: loaded.filter((entry): entry is ItemListEntry => entry !== null),
    };
  }

  async listLocationsForGame(gameId: number, page: number): Promise<LocationListPage> {
    const places = await this.placesForGame(gameId);
    const loaded = await mapPool(places, UPSTREAM_CONCURRENCY, async (place) => {
      const location = await this.locationOrMissing(place.id);
      const frenchName = location ? localizedNameOrNull(location.names) : null;
      if (!location || !frenchName) {
        return null;
      }
      return {
        id: location.id,
        frenchName,
        region: place.region,
        regionId: place.regionId,
      };
    });
    const resolved = loaded.filter((entry): entry is LocationListEntry => entry !== null);
    const offset = (page - 1) * LIST_PAGE_SIZE;
    return { total: resolved.length, entries: resolved.slice(offset, offset + LIST_PAGE_SIZE) };
  }

  async listPokemon(page: number): Promise<PokemonListPage> {
    const offset = (page - 1) * POKEMON_PAGE_SIZE;
    const list = await this.load(`pokemon-list:${POKEMON_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listPokemon(offset, POKEMON_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.listEntry(idFromUrl(result.url))),
    );
    return { total: list.count, entries };
  }

  async getPokemon(id: number): Promise<PokemonDetail> {
    const pokemon = await this.pokemonOrNotFound(id);
    const species = await this.species(pokemon);
    const chainUrl = species.evolution_chain?.url;
    let speciesRefs: EvolutionLink["species"][] = [];
    if (chainUrl) {
      const chainId = idFromUrl(chainUrl);
      const chain = await this.load<EvolutionChainPayload>(`evolution-chain:${chainId}`, () =>
        this.upstream.getEvolutionChain(chainId),
      );
      speciesRefs = flattenEvolution(chain.chain);
    }

    const [types, stats, abilities, moves, evolutions] = await Promise.all([
      this.frenchTypes(pokemon),
      Promise.all(
        pokemon.stats.map(async (stat) => {
          const described = await this.described(`stat`, stat.stat.url, (statId) =>
            this.upstream.getStat(statId),
          );
          return { name: localizedName(described.names), value: stat.base_stat };
        }),
      ),
      Promise.all(
        pokemon.abilities.map(async (ability) => {
          const described = await this.described(`ability`, ability.ability.url, (abilityId) =>
            this.upstream.getAbility(abilityId),
          );
          return { name: localizedName(described.names), isHidden: ability.is_hidden };
        }),
      ),
      Promise.all(
        pokemon.moves.map(async (move) => {
          const described = await this.described(`move`, move.move.url, (moveId) =>
            this.upstream.getMove(moveId),
          );
          return { name: localizedName(described.names) };
        }),
      ),
      Promise.all(
        speciesRefs.map(async (speciesRef) => {
          const evolutionId = idFromUrl(speciesRef.url);
          const evolution = await this.load<SpeciesPayload>(`species:${evolutionId}`, () =>
            this.upstream.getSpecies(evolutionId),
          );
          return {
            nationalNumber: evolutionId,
            frenchName: localizedName(evolution.names),
          };
        }),
      ),
    ]);

    return {
      nationalNumber: pokemon.id,
      frenchName: localizedName(species.names),
      spriteUrl: pokemon.sprites.front_default,
      types,
      stats,
      abilities,
      moves,
      evolutions,
    };
  }

  private async gameEntry(id: number): Promise<GameListEntry> {
    const version = await this.load<VersionPayload>(`version:${id}`, () => this.upstream.getVersion(id));
    const groupId = idFromUrl(version.version_group.url);
    const group = await this.load<VersionGroupPayload>(`version-group:${groupId}`, () =>
      this.upstream.getVersionGroup(groupId),
    );
    const generationUrl = group.generation?.url;
    if (!generationUrl) {
      return {
        id: version.id,
        frenchName: localizedName(version.names),
        artworkUrl: null,
        generationLabel: "",
      };
    }
    const generationId = idFromUrl(generationUrl);
    const generation = await this.load<GenerationPayload>(`generation:${generationId}`, () =>
      this.upstream.getGeneration(generationId),
    );
    return {
      id: version.id,
      frenchName: localizedName(version.names),
      artworkUrl: null,
      generationLabel: localizedName(generation.names),
    };
  }

  private async gameOrNotFound(id: number): Promise<VersionPayload> {
    try {
      return await this.load(`version:${id}`, () => this.upstream.getVersion(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownGameError(id);
      }
      throw error;
    }
  }

  private async itemListEntry(id: number): Promise<ItemListEntry> {
    const item = await this.load<ItemPayload>(`item:${id}`, () => this.upstream.getItem(id));
    const category = await this.described(`item-category`, item.category.url, (categoryId) =>
      this.upstream.getItemCategory(categoryId),
    );
    return {
      id: item.id,
      frenchName: localizedName(item.names),
      spriteUrl: item.sprites.default,
      category: localizedName(category.names),
    };
  }

  private async listEntry(id: number): Promise<PokemonListEntry> {
    const pokemon = await this.load<PokemonPayload>(`pokemon:${id}`, () =>
      this.upstream.getPokemon(id),
    );
    const species = await this.species(pokemon);
    return {
      nationalNumber: pokemon.id,
      frenchName: localizedName(species.names),
      spriteUrl: pokemon.sprites.front_default,
      types: await this.frenchTypes(pokemon),
    };
  }

  private async itemOrNotFound(id: number): Promise<ItemPayload> {
    try {
      return await this.load(`item:${id}`, () => this.upstream.getItem(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownItemError(id);
      }
      throw error;
    }
  }

  private async pageEntries<T, R>(
    ids: T[],
    page: number,
    loadEntry: (id: T) => Promise<R>,
  ): Promise<{ total: number; entries: R[] }> {
    const offset = (page - 1) * LIST_PAGE_SIZE;
    const entries = await Promise.all(
      ids.slice(offset, offset + LIST_PAGE_SIZE).map((id) => loadEntry(id)),
    );
    return { total: ids.length, entries };
  }

  private async itemIdsForGame(gameId: number): Promise<number[]> {
    const group = await this.versionGroupForGame(gameId);
    const generationUrl = group?.generation?.url;
    if (!generationUrl) {
      return [];
    }
    const generationId = idFromUrl(generationUrl);
    return this.load(`items-in-generation:${generationId}`, () =>
      this.itemIdsInGeneration(generationId),
    );
  }

  private async itemIdsInGeneration(generationId: number): Promise<number[]> {
    const ids = await this.allItemIds();
    const linked = await mapPool(ids, UPSTREAM_CONCURRENCY, async (id) => {
      const item = await this.itemOrMissing(id);
      if (!item || !localizedNameOrNull(item.names)) {
        return false;
      }
      return (
        item.game_indices?.some((index) => idFromUrl(index.generation.url) === generationId) ??
        false
      );
    });
    return ids.filter((_, index) => linked[index]);
  }

  private async itemOrMissing(id: number): Promise<ItemPayload | null> {
    try {
      return await this.load(`item:${id}`, () => this.upstream.getItem(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        return null;
      }
      throw error;
    }
  }

  private async allItemIds(): Promise<number[]> {
    const first = await this.itemPage(0);
    const ids = first.results.map((result) => idFromUrl(result.url));
    const offsets: number[] = [];
    for (let offset = first.results.length; offset < first.count; offset += LIST_PAGE_SIZE) {
      offsets.push(offset);
    }
    const pages = await mapPool(offsets, UPSTREAM_CONCURRENCY, (offset) => this.itemPage(offset));
    for (const page of pages) {
      ids.push(...page.results.map((result) => idFromUrl(result.url)));
    }
    return ids;
  }

  private itemPage(offset: number) {
    return this.load(`item-list:${LIST_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listItems(offset, LIST_PAGE_SIZE),
    );
  }

  private async locationOrMissing(id: number): Promise<LocationPayload | null> {
    try {
      return await this.load(`location:${id}`, () => this.upstream.getLocation(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        return null;
      }
      throw error;
    }
  }

  private async placesForGame(
    gameId: number,
  ): Promise<{ id: number; region: string; regionId: number }[]> {
    const group = await this.versionGroupForGame(gameId);
    if (!group) {
      return [];
    }
    const places: { id: number; region: string; regionId: number }[] = [];
    const seen = new Set<number>();
    for (const regionRef of group.regions) {
      const region = await this.linked<RegionPayload>(`region`, regionRef.url, (id) =>
        this.upstream.getRegion(id),
      );
      if (!region) {
        continue;
      }
      const regionName = localizedNameOrNull(region.names);
      if (!regionName) {
        continue;
      }
      for (const locationRef of region.locations) {
        const id = idFromUrl(locationRef.url);
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        places.push({ id, region: regionName, regionId: region.id });
      }
    }
    return places;
  }

  private async speciesIdsForGame(gameId: number): Promise<number[]> {
    const group = await this.versionGroupForGame(gameId);
    if (!group) {
      return [];
    }
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const pokedexRef of group.pokedexes) {
      const pokedex = await this.linked<PokedexPayload>(`pokedex`, pokedexRef.url, (pokedexId) =>
        this.upstream.getPokedex(pokedexId),
      );
      if (!pokedex) {
        continue;
      }
      for (const entry of pokedex.pokemon_entries) {
        const speciesId = idFromUrl(entry.pokemon_species.url);
        if (seen.has(speciesId)) {
          continue;
        }
        seen.add(speciesId);
        ids.push(speciesId);
      }
    }
    return ids;
  }

  private async versionGroupForGame(gameId: number): Promise<VersionGroupPayload | null> {
    const version = await this.gameOrNotFound(gameId);
    return this.linked(`version-group`, version.version_group.url, (groupId) =>
      this.upstream.getVersionGroup(groupId),
    );
  }

  private async linked<T>(
    kind: string,
    url: string,
    fetchBody: (id: number) => Promise<T>,
  ): Promise<T | null> {
    const id = idFromUrl(url);
    try {
      return await this.load(`${kind}:${id}`, () => fetchBody(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        return null;
      }
      throw error;
    }
  }

  private async pokemonOrNotFound(id: number): Promise<PokemonPayload> {
    try {
      return await this.load(`pokemon:${id}`, () => this.upstream.getPokemon(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownPokemonError(id);
      }
      throw error;
    }
  }

  private species(pokemon: PokemonPayload): Promise<SpeciesPayload> {
    const speciesId = idFromUrl(pokemon.species.url);
    return this.load(`species:${speciesId}`, () => this.upstream.getSpecies(speciesId));
  }

  private frenchTypes(pokemon: PokemonPayload): Promise<string[]> {
    return Promise.all(
      [...pokemon.types]
        .sort((left, right) => left.slot - right.slot)
        .map(async (slot) => {
          const typeId = idFromUrl(slot.type.url);
          const type = await this.load<TypePayload>(`type:${typeId}`, () =>
            this.upstream.getType(typeId),
          );
          return localizedName(type.names);
        }),
    );
  }

  private described(
    kind: string,
    url: string,
    fetchBody: (id: number) => Promise<DescribedPayload>,
  ): Promise<DescribedPayload> {
    const id = idFromUrl(url);
    return this.load(`${kind}:${id}`, () => fetchBody(id));
  }

  private async load<T>(key: string, fetchBody: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached && this.clock.now() - cached.storedAt < FRESH_FOR_MS) {
      return cached.body as T;
    }

    try {
      const body = await fetchBody();
      await this.cache.set(key, body, this.clock.now());
      return body;
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw error;
      }
      if (cached) {
        return cached.body as T;
      }
      throw new CatalogueUnavailableError();
    }
  }
}

function firstPrice(
  prices: { purchase_price: number | null; sell_price: number | null }[] | undefined,
  field: "purchase_price" | "sell_price",
): number | null {
  for (const price of prices ?? []) {
    const value = price[field];
    if (typeof value === "number") {
      return value;
    }
  }
  return null;
}

function localizedProse(
  entries: { short_effect?: string; text?: string; language: { name: string } }[],
  field: "short_effect" | "text",
): string | null {
  const french = entries.find((entry) => entry.language.name === "fr");
  const english = entries.find((entry) => entry.language.name === "en");
  const raw = (french ?? english)?.[field];
  if (!raw) {
    return null;
  }
  const cleaned = raw.replace(/[\n\f]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function localizedName(names: LocalizedName[]): string {
  const name = localizedNameOrNull(names);
  if (name) {
    return name;
  }
  throw new MissingLocalizedNameError();
}

function localizedNameOrNull(names: LocalizedName[]): string | null {
  const french = names.find((entry) => entry.language.name === "fr");
  if (french) {
    return french.name;
  }
  const english = names.find((entry) => entry.language.name === "en");
  return english?.name ?? null;
}

function flattenEvolution(link: EvolutionLink): EvolutionLink["species"][] {
  return [link.species, ...link.evolves_to.flatMap((next) => flattenEvolution(next))];
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  if (!match) {
    throw new Error(`No id in ${url}`);
  }
  return Number(match[1]);
}
