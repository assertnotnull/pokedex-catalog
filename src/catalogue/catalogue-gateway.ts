import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "./cache-store";
import { Clock } from "./clock";
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
  type EvolutionLink,
  type GenerationPayload,
  type ItemPayload,
  type LocalizedName,
  type LocationAreaPayload,
  type LocationPayload,
  type PokedexPayload,
  type RegionPayload,
  type VersionGroupPayload,
  type VersionPayload,
  type PokemonPayload,
  type SpeciesPayload,
  type TypePayload,
} from "./poke-api";

export const LIST_PAGE_SIZE = 24;
export const POKEMON_PAGE_SIZE = LIST_PAGE_SIZE;
export const SEARCH_RESULT_CAP = 8;
const FRESH_FOR_MS = 7 * 24 * 60 * 60 * 1000;

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

export type RegionSummary = {
  id: number;
  frenchName: string;
  locationCount: number;
};

export type LocationListEntry = {
  id: number;
  frenchName: string;
  regionId: number;
  regionName: string;
};

export type LocationListPage = {
  total: number;
  entries: LocationListEntry[];
};

export type LocationEncounter = {
  nationalNumber: number;
  frenchName: string;
  appearances: {
    gameId: number;
    gameName: string;
    method: string;
    minLevel: number;
    maxLevel: number;
    chance: number;
  }[];
};

export type LocationDetail = {
  id: number;
  frenchName: string;
  regionId: number;
  regionName: string;
  encounters: LocationEncounter[];
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

export type SearchHit = {
  id: number;
  frenchName: string;
  href: string;
};

export type SearchResults = {
  query: string;
  results: {
    games: SearchHit[];
    pokemon: SearchHit[];
    items: SearchHit[];
    locations: SearchHit[];
  };
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

  async listRegions(): Promise<RegionSummary[]> {
    const list = await this.load("region-list:100:0", () => this.upstream.listRegions(0, 100));
    return Promise.all(list.results.map((result) => this.regionSummary(idFromUrl(result.url))));
  }

  async listLocations(regionId: number, page: number): Promise<LocationListPage> {
    const region = await this.regionOrNotFound(regionId);
    const start = (page - 1) * LIST_PAGE_SIZE;
    const slice = region.locations.slice(start, start + LIST_PAGE_SIZE);
    const regionName = localizedName(region.names);
    const entries = await Promise.all(
      slice.map(async (ref) => {
        const id = idFromUrl(ref.url);
        const location = await this.load<LocationPayload>(`location:${id}`, () =>
          this.upstream.getLocation(id),
        );
        return {
          id: location.id,
          frenchName: localizedName(location.names),
          regionId: region.id,
          regionName,
        };
      }),
    );
    const pageResult = { total: region.locations.length, entries };
    await this.rememberNames(
      "locations",
      entries.map((entry) => ({
        id: entry.id,
        frenchName: entry.frenchName,
        href: `/lieux/${entry.regionId}/${entry.id}`,
      })),
    );
    return pageResult;
  }

  async getLocation(id: number): Promise<LocationDetail> {
    const location = await this.locationOrNotFound(id);
    const regionId = idFromUrl(location.region.url);
    const region = await this.regionOrNotFound(regionId);
    return {
      id: location.id,
      frenchName: localizedName(location.names),
      regionId,
      regionName: localizedName(region.names),
      encounters: await this.encounters(location),
    };
  }

  async listPokemonForGame(gameId: number, page: number): Promise<PokemonListPage> {
    const speciesIds = await this.speciesIdsForGame(gameId);
    const slice = pageSlice(speciesIds, page);
    const entries = await Promise.all(slice.map((id) => this.listEntry(id)));
    await this.rememberNames("pokemon", pokemonHits(entries));
    return { total: speciesIds.length, entries };
  }

  async listItemsForGame(gameId: number, page: number): Promise<ItemListPage> {
    const version = await this.gameOrNotFound(gameId);
    const groupId = idFromUrl(version.version_group.url);
    const group = await this.versionGroup(groupId);
    const generationId = idFromUrl(group.generation.url);
    const ids = await this.itemIdsForGame(generationId, groupId);
    const slice = pageSlice(ids, page);
    const entries = await Promise.all(slice.map((id) => this.itemListEntry(id)));
    await this.rememberNames("items", itemHits(entries));
    return { total: ids.length, entries };
  }

  async listLocationsForGame(gameId: number, page: number): Promise<LocationListPage> {
    const version = await this.gameOrNotFound(gameId);
    const group = await this.versionGroup(idFromUrl(version.version_group.url));
    const refs: { id: number; regionId: number; regionName: string }[] = [];
    const seen = new Set<number>();
    for (const regionRef of group.regions) {
      const region = await this.regionOrNotFound(idFromUrl(regionRef.url));
      const regionName = localizedName(region.names);
      for (const locationRef of region.locations) {
        const id = idFromUrl(locationRef.url);
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        refs.push({ id, regionId: region.id, regionName });
      }
    }
    const slice = pageSlice(refs, page);
    const entries = await Promise.all(
      slice.map(async (ref) => {
        const location = await this.load<LocationPayload>(`location:${ref.id}`, () =>
          this.upstream.getLocation(ref.id),
        );
        return {
          id: location.id,
          frenchName: localizedName(location.names),
          regionId: ref.regionId,
          regionName: ref.regionName,
        };
      }),
    );
    await this.rememberNames(
      "locations",
      entries.map((entry) => ({
        id: entry.id,
        frenchName: entry.frenchName,
        href: `/lieux/${entry.regionId}/${entry.id}`,
      })),
    );
    return { total: refs.length, entries };
  }

  async warmSearchIndexes(): Promise<void> {
    await this.tryList(() => this.listPokemon(1));
    await this.tryList(() => this.listItems(1));
    await this.tryList(() => this.listGames(1));
    const regions = await this.tryList(() => this.listRegions());
    for (const region of regions ?? []) {
      await this.tryList(() => this.listLocations(region.id, 1));
    }
  }

  async search(query: string): Promise<SearchResults> {
    const trimmed = query.trim();
    const empty = {
      query: trimmed,
      results: { games: [], pokemon: [], items: [], locations: [] },
    };
    if (trimmed === "") {
      return empty;
    }
    const needle = normalizeSearch(trimmed);
    const [games, pokemon, items, locations] = await Promise.all([
      this.searchIndex("games"),
      this.searchIndex("pokemon"),
      this.searchIndex("items"),
      this.searchIndex("locations"),
    ]);
    return {
      query: trimmed,
      results: {
        games: matchNames(games, needle),
        pokemon: matchNames(pokemon, needle),
        items: matchNames(items, needle),
        locations: matchNames(locations, needle),
      },
    };
  }

  async listGames(page: number): Promise<GameListPage> {
    const offset = (page - 1) * LIST_PAGE_SIZE;
    const list = await this.load(`version-list:${LIST_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listVersions(offset, LIST_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.gameEntry(idFromUrl(result.url))),
    );
    await this.rememberNames(
      "games",
      entries.map((entry) => ({
        id: entry.id,
        frenchName: entry.frenchName,
        href: `/jeux/${entry.id}`,
      })),
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
    await this.rememberNames("items", itemHits(entries));
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

  async listPokemon(page: number): Promise<PokemonListPage> {
    const offset = (page - 1) * POKEMON_PAGE_SIZE;
    const list = await this.load(`pokemon-list:${POKEMON_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listPokemon(offset, POKEMON_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.listEntry(idFromUrl(result.url))),
    );
    await this.rememberNames("pokemon", pokemonHits(entries));
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

  private async speciesIdsForGame(gameId: number): Promise<number[]> {
    const version = await this.gameOrNotFound(gameId);
    const group = await this.versionGroup(idFromUrl(version.version_group.url));
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const pokedexRef of group.pokedexes) {
      const pokedexId = idFromUrl(pokedexRef.url);
      const pokedex = await this.load<PokedexPayload>(`pokedex:${pokedexId}`, () =>
        this.upstream.getPokedex(pokedexId),
      );
      for (const entry of pokedex.pokemon_entries) {
        const id = idFromUrl(entry.pokemon_species.url);
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }

  private async itemIdsForGame(generationId: number, versionGroupId: number): Promise<number[]> {
    return this.load<number[]>(`item-ids:gen:${generationId}:vg:${versionGroupId}`, async () => {
      const list = await this.upstream.listItems(0, 10_000);
      const linked = await mapPool(list.results, 12, async (result) => {
        const id = idFromUrl(result.url);
        const item = await this.load<ItemPayload>(`item:${id}`, () => this.upstream.getItem(id));
        const linkedByGeneration = (item.game_indices ?? []).some(
          (index) => idFromUrl(index.generation.url) === generationId,
        );
        const linkedByVersionGroup = item.flavor_text_entries.some(
          (entry) =>
            entry.version_group !== undefined && idFromUrl(entry.version_group.url) === versionGroupId,
        );
        return linkedByGeneration || linkedByVersionGroup ? id : null;
      });
      return linked.filter((id): id is number => id !== null);
    });
  }

  private versionGroup(id: number): Promise<VersionGroupPayload> {
    return this.load(`version-group:${id}`, () => this.upstream.getVersionGroup(id));
  }

  private async regionSummary(id: number): Promise<RegionSummary> {
    const region = await this.regionOrNotFound(id);
    return {
      id: region.id,
      frenchName: localizedName(region.names),
      locationCount: region.locations.length,
    };
  }

  private async encounters(location: LocationPayload): Promise<LocationEncounter[]> {
    const byPokemon = new Map<number, LocationEncounter>();
    for (const areaRef of location.areas) {
      const areaId = idFromUrl(areaRef.url);
      const area = await this.load<LocationAreaPayload>(`location-area:${areaId}`, () =>
        this.upstream.getLocationArea(areaId),
      );
      for (const encounter of area.pokemon_encounters) {
        const nationalNumber = idFromUrl(encounter.pokemon.url);
        const pokemon = await this.load<PokemonPayload>(`pokemon:${nationalNumber}`, () =>
          this.upstream.getPokemon(nationalNumber),
        );
        const species = await this.species(pokemon);
        const current = byPokemon.get(nationalNumber) ?? {
          nationalNumber,
          frenchName: localizedName(species.names),
          appearances: [],
        };
        for (const versionDetail of encounter.version_details) {
          const gameId = idFromUrl(versionDetail.version.url);
          const version = await this.load<VersionPayload>(`version:${gameId}`, () =>
            this.upstream.getVersion(gameId),
          );
          for (const detail of versionDetail.encounter_details) {
            const method = await this.described(
              "encounter-method",
              detail.method.url,
              (methodId) => this.upstream.getEncounterMethod(methodId),
            );
            current.appearances.push({
              gameId,
              gameName: localizedName(version.names),
              method: localizedName(method.names),
              minLevel: detail.min_level,
              maxLevel: detail.max_level,
              chance: detail.chance,
            });
          }
        }
        byPokemon.set(nationalNumber, current);
      }
    }
    return [...byPokemon.values()];
  }

  private async regionOrNotFound(id: number): Promise<RegionPayload> {
    try {
      return await this.load(`region:${id}`, () => this.upstream.getRegion(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownRegionError(id);
      }
      throw error;
    }
  }

  private async locationOrNotFound(id: number): Promise<LocationPayload> {
    try {
      return await this.load(`location:${id}`, () => this.upstream.getLocation(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownLocationError(id);
      }
      throw error;
    }
  }

  private async gameEntry(id: number): Promise<GameListEntry> {
    const version = await this.load<VersionPayload>(`version:${id}`, () => this.upstream.getVersion(id));
    const groupId = idFromUrl(version.version_group.url);
    const group = await this.load<VersionGroupPayload>(`version-group:${groupId}`, () =>
      this.upstream.getVersionGroup(groupId),
    );
    const generationId = idFromUrl(group.generation.url);
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

  private async tryList<T>(load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch (error) {
      if (error instanceof CatalogueUnavailableError) {
        return null;
      }
      throw error;
    }
  }

  private async searchIndex(kind: "games" | "pokemon" | "items" | "locations"): Promise<SearchHit[]> {
    const stored = await this.cache.get(`search-index:${kind}`);
    return Array.isArray(stored?.body) ? (stored.body as SearchHit[]) : [];
  }

  private async rememberNames(
    kind: "games" | "pokemon" | "items" | "locations",
    entries: SearchHit[],
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    const current = await this.searchIndex(kind);
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    const order = current.map((entry) => entry.id);
    for (const entry of entries) {
      if (!byId.has(entry.id)) {
        order.push(entry.id);
      }
      byId.set(entry.id, entry);
    }
    await this.cache.set(
      `search-index:${kind}`,
      order.map((id) => byId.get(id)),
      this.clock.now(),
    );
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

async function mapPool<T, R>(
  items: T[],
  limit: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await map(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function pokemonHits(entries: PokemonListEntry[]): SearchHit[] {
  return entries.map((entry) => ({
    id: entry.nationalNumber,
    frenchName: entry.frenchName,
    href: `/pokemon/${entry.nationalNumber}`,
  }));
}

function itemHits(entries: ItemListEntry[]): SearchHit[] {
  return entries.map((entry) => ({
    id: entry.id,
    frenchName: entry.frenchName,
    href: `/objets/${entry.id}`,
  }));
}

function matchNames(entries: SearchHit[], needle: string): SearchHit[] {
  return entries
    .filter((entry) => normalizeSearch(entry.frenchName).includes(needle))
    .slice(0, SEARCH_RESULT_CAP);
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .trim();
}

function pageSlice<T>(items: T[], page: number): T[] {
  const start = (page - 1) * LIST_PAGE_SIZE;
  return items.slice(start, start + LIST_PAGE_SIZE);
}

function localizedName(names: LocalizedName[]): string {
  const french = names.find((entry) => entry.language.name === "fr");
  if (french) {
    return french.name;
  }
  const english = names.find((entry) => entry.language.name === "en");
  if (english) {
    return english.name;
  }
  throw new Error("No French or English name");
}

function flattenEvolution(link: EvolutionLink): EvolutionLink["species"][] {
  return [link.species, ...link.evolves_to.flatMap((next) => flattenEvolution(next))];
}

function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  if (!match) {
    throw new Error(`No id in ${url}`);
  }
  return Number(match[1]);
}
