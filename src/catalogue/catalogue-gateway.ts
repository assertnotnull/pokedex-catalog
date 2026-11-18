import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "./cache-store";
import { Clock } from "./clock";
import { CatalogueUnavailableError, UnknownItemError, UnknownPokemonError } from "./errors";
import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
  type EvolutionLink,
  type ItemPayload,
  type LocalizedName,
  type PokemonPayload,
  type SpeciesPayload,
  type TypePayload,
} from "./poke-api";

export const LIST_PAGE_SIZE = 24;
export const POKEMON_PAGE_SIZE = LIST_PAGE_SIZE;
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

export const SEARCH_RESULTS_PER_KIND = 5;

export type SearchHit = {
  id: number;
  frenchName: string;
};

export type SearchResults = {
  games: SearchHit[];
  pokemon: SearchHit[];
  items: SearchHit[];
  locations: SearchHit[];
};

export const SEARCH_KINDS = ["games", "pokemon", "items", "locations"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

type SearchIndex = {
  entries: SearchHit[];
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

  async listItems(page: number): Promise<ItemListPage> {
    const offset = (page - 1) * LIST_PAGE_SIZE;
    const list = await this.load(`item-list:${LIST_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listItems(offset, LIST_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.itemListEntry(idFromUrl(result.url))),
    );
    await this.indexListedNames(
      "items",
      entries.map((entry) => ({ id: entry.id, frenchName: entry.frenchName })),
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

  async listPokemon(page: number): Promise<PokemonListPage> {
    const offset = (page - 1) * POKEMON_PAGE_SIZE;
    const list = await this.load(`pokemon-list:${POKEMON_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listPokemon(offset, POKEMON_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.listEntry(idFromUrl(result.url))),
    );
    await this.indexListedNames(
      "pokemon",
      entries.map((entry) => ({ id: entry.nationalNumber, frenchName: entry.frenchName })),
    );
    return { total: list.count, entries };
  }

  async search(query: string): Promise<SearchResults> {
    const normalized = normalizeFrenchName(query);
    const results = emptySearchResults();
    await Promise.all(
      SEARCH_KINDS.map(async (kind) => {
        results[kind] = await this.matchKind(kind, normalized);
      }),
    );
    return results;
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

  /**
   * Games and locations list methods record names here when those sections exist.
   * Each fetched page merges into the cached index for its kind.
   */
  private async indexListedNames(kind: SearchKind, entries: SearchHit[]): Promise<void> {
    const key = searchIndexKey(kind);
    const cached = await this.cache.get(key);
    const current = readSearchIndex(cached?.body);
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    const order = current.map((entry) => entry.id);
    for (const entry of entries) {
      if (!byId.has(entry.id)) {
        order.push(entry.id);
      }
      byId.set(entry.id, entry);
    }
    const indexed = order.flatMap((id) => {
      const entry = byId.get(id);
      return entry ? [entry] : [];
    });
    await this.cache.set(key, { entries: indexed }, this.clock.now());
  }

  private async matchKind(kind: SearchKind, normalizedQuery: string): Promise<SearchHit[]> {
    if (!normalizedQuery) {
      return [];
    }
    const cached = await this.cache.get(searchIndexKey(kind));
    return readSearchIndex(cached?.body)
      .filter((entry) => normalizeFrenchName(entry.frenchName).includes(normalizedQuery))
      .slice(0, SEARCH_RESULTS_PER_KIND);
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

function emptySearchResults(): SearchResults {
  return { games: [], pokemon: [], items: [], locations: [] };
}

function searchIndexKey(kind: SearchKind): string {
  return `search-index:${kind}`;
}

function readSearchIndex(body: unknown): SearchHit[] {
  if (!body || typeof body !== "object" || !("entries" in body)) {
    return [];
  }
  const entries = (body as SearchIndex).entries;
  return Array.isArray(entries) ? entries : [];
}

function normalizeFrenchName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
