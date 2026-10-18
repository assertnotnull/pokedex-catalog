import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "@/lib/cache/cache-store";
import { Clock } from "@/lib/catalogue/clock";
import type {
  ItemDetail,
  ItemListItem,
  ItemListPage,
  ItemMachine,
  ItemPrice,
  NamedLink,
  PokemonDetail,
  PokemonListItem,
  PokemonListPage,
} from "@/lib/catalogue/dto";
import {
  CatalogueNotFoundError,
  CatalogueUnavailableError,
  UpstreamNotFoundError,
} from "@/lib/catalogue/errors";
import { UpstreamClient } from "@/lib/catalogue/upstream";

export const POKEMON_PAGE_SIZE = 24;
const ITEM_PAGE_SIZE = 24;
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_CONCURRENCY = 8;

type NamedEntry = { name: string; language: { name: string } };
type ResourceRef = { name: string; url: string };

type PokemonResource = {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: {
    front_default: string | null;
    other?: { "official-artwork"?: { front_default?: string | null } };
  };
  types: { slot: number; type: ResourceRef }[];
  abilities: { is_hidden: boolean; ability: ResourceRef }[];
  stats: { base_stat: number; stat: ResourceRef }[];
  moves: { move: ResourceRef }[];
  species: ResourceRef;
  held_items: { item: ResourceRef }[];
};

type SpeciesResource = {
  names?: NamedEntry[];
  genera?: { genus: string; language: { name: string } }[];
  flavor_text_entries?: { flavor_text: string; language: { name: string } }[];
  evolution_chain?: { url: string };
};

type ChainLink = { species: ResourceRef; evolves_to?: ChainLink[] };

type EvolutionResource = { chain: ChainLink };

type ListResource = { count: number; results: ResourceRef[] };

type NamesResource = { names?: NamedEntry[] };

@injectable()
export class CatalogueGateway {
  constructor(
    private readonly cache = inject(CacheStore),
    private readonly upstream = inject(UpstreamClient),
    private readonly clock = inject(Clock),
  ) {}

  async listPokemon(page: number): Promise<PokemonListPage> {
    const safePage = normalizePage(page);
    const offset = (safePage - 1) * POKEMON_PAGE_SIZE;
    const list = asList(
      await this.readThrough(`/pokemon?limit=${POKEMON_PAGE_SIZE}&offset=${offset}`),
    );
    const items = (
      await mapPool(list.results, FETCH_CONCURRENCY, (result) =>
        this.toListItem(idFromResourceUrl(result.url)),
      )
    ).filter((item): item is PokemonListItem => item !== null);

    return {
      page: safePage,
      pageSize: POKEMON_PAGE_SIZE,
      total: list.count,
      items,
    };
  }

  async getPokemon(id: number): Promise<PokemonDetail> {
    if (!Number.isInteger(id) || id < 1) {
      throw new CatalogueNotFoundError(String(id));
    }

    let pokemon: PokemonResource;
    try {
      pokemon = asPokemon(await this.readThrough(`/pokemon/${id}`));
    } catch (error) {
      if (error instanceof CatalogueNotFoundError) {
        throw new CatalogueNotFoundError(String(id));
      }
      throw error;
    }

    const species = await this.loadSpecies(pokemon);
    const name = localizedName(species?.names, pokemon.name);
    const types = await this.localizedRefs(
      [...pokemon.types].sort((a, b) => a.slot - b.slot).map((entry) => entry.type),
    );
    const [abilities, stats, moves, evolutions, heldItems] = await Promise.all([
      mapPool(pokemon.abilities, FETCH_CONCURRENCY, async (entry) => ({
        name: await this.frenchFromResource(pathFromResourceUrl(entry.ability.url), entry.ability.name),
        isHidden: entry.is_hidden,
      })),
      mapPool(pokemon.stats, FETCH_CONCURRENCY, async (entry) => ({
        name: await this.frenchFromResource(pathFromResourceUrl(entry.stat.url), entry.stat.name),
        value: entry.base_stat,
      })),
      mapPool(uniqueRefs(pokemon.moves.map((entry) => entry.move)), FETCH_CONCURRENCY, async (move) => ({
        name: await this.frenchFromResource(pathFromResourceUrl(move.url), move.name),
      })),
      this.loadEvolutions(species),
      mapPool(uniqueRefs(pokemon.held_items.map((entry) => entry.item)), FETCH_CONCURRENCY, async (item) => ({
        id: idFromResourceUrl(item.url),
        name: await this.frenchFromResource(pathFromResourceUrl(item.url), item.name),
      })),
    ]);

    return {
      id: pokemon.id,
      name,
      genus: localizedGenus(species),
      flavorText: localizedFlavor(species),
      spriteUrl: pokemon.sprites.front_default,
      artworkUrl: pokemon.sprites.other?.["official-artwork"]?.front_default ?? null,
      types,
      heightMeters: pokemon.height / 10,
      weightKilograms: pokemon.weight / 10,
      abilities,
      stats,
      moves,
      evolutions,
      heldItems,
    };
  }

  private async toListItem(id: number): Promise<PokemonListItem | null> {
    let pokemon: PokemonResource;
    try {
      pokemon = asPokemon(await this.readThrough(`/pokemon/${id}`));
    } catch (error) {
      if (error instanceof CatalogueNotFoundError) return null;
      throw error;
    }
    const species = await this.loadSpecies(pokemon);
    const types = await this.localizedRefs(
      [...pokemon.types].sort((a, b) => a.slot - b.slot).map((entry) => entry.type),
    );
    return {
      id: pokemon.id,
      name: localizedName(species?.names, pokemon.name),
      spriteUrl: pokemon.sprites.front_default,
      types,
    };
  }

  private async loadSpecies(pokemon: PokemonResource): Promise<SpeciesResource | null> {
    try {
      return asSpecies(await this.readThrough(pathFromResourceUrl(pokemon.species.url)));
    } catch (error) {
      if (error instanceof CatalogueNotFoundError || error instanceof CatalogueUnavailableError) {
        return null;
      }
      throw error;
    }
  }

  private async loadEvolutions(species: SpeciesResource | null): Promise<NamedLink[]> {
    const url = species?.evolution_chain?.url;
    if (!url) return [];
    try {
      const body = asEvolution(await this.readThrough(pathFromResourceUrl(url)));
      const refs = flattenChain(body.chain);
      return mapPool(refs, FETCH_CONCURRENCY, async (ref) => ({
        id: idFromResourceUrl(ref.url),
        name: await this.frenchFromResource(pathFromResourceUrl(ref.url), ref.name),
      }));
    } catch (error) {
      if (error instanceof CatalogueNotFoundError || error instanceof CatalogueUnavailableError) {
        return [];
      }
      throw error;
    }
  }

  private async localizedRefs(refs: ResourceRef[]): Promise<string[]> {
    return mapPool(refs, FETCH_CONCURRENCY, (ref) =>
      this.frenchFromResource(pathFromResourceUrl(ref.url), ref.name),
    );
  }

  private async frenchFromResource(path: string, fallback: string): Promise<string> {
    try {
      const body = asNames(await this.readThrough(path));
      return localizedName(body.names, fallback);
    } catch (error) {
      if (error instanceof CatalogueNotFoundError || error instanceof CatalogueUnavailableError) {
        return fallback;
      }
      throw error;
    }
  }

  private async readThrough(path: string): Promise<unknown> {
    const key = `catalogue:${normalizePath(path)}`;
    const cached = await this.readCache(key);
    const fresh = cached !== null && this.clock.now() - cached.storedAt < CACHE_TTL_MS;
    if (cached && fresh) return cached.body;

    try {
      const body = await this.upstream.getJson(normalizePath(path));
      await this.writeCache(key, { body, storedAt: this.clock.now() });
      return body;
    } catch (error) {
      if (error instanceof UpstreamNotFoundError) throw new CatalogueNotFoundError(path);
      if (cached) return cached.body;
      throw new CatalogueUnavailableError();
    }
  }

  private async readCache(key: string) {
    try {
      return await this.cache.get(key);
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, record: { body: unknown; storedAt: number }) {
    try {
      await this.cache.set(key, record);
    } catch {
      // A failed write still leaves the fetched payload usable for this request.
    }
  }

  async listItems(page: number): Promise<ItemListPage> {
    const safePage = normalizePage(page);
    const offset = (safePage - 1) * ITEM_PAGE_SIZE;
    const list = asList(await this.readThrough(`/item?limit=${ITEM_PAGE_SIZE}&offset=${offset}`));
    const items = (
      await mapPool(list.results, FETCH_CONCURRENCY, (result) => this.toItemListItem(idFromResourceUrl(result.url)))
    ).filter((item): item is ItemListItem => item !== null);

    return {
      page: safePage,
      pageSize: ITEM_PAGE_SIZE,
      total: list.count,
      items,
    };
  }

  async getItem(id: number): Promise<ItemDetail> {
    if (!Number.isInteger(id) || id < 1) {
      throw new CatalogueNotFoundError(String(id));
    }

    let item: ItemResource;
    try {
      item = asItem(await this.readThrough(`/item/${id}`));
    } catch (error) {
      if (error instanceof CatalogueNotFoundError) {
        throw new CatalogueNotFoundError(String(id));
      }
      throw error;
    }

    const [category, attributes, flingEffect, heldBy, machines] = await Promise.all([
      this.frenchFromResource(pathFromResourceUrl(item.category.url), item.category.name),
      mapPool(item.attributes ?? [], FETCH_CONCURRENCY, (attribute) =>
        this.frenchFromResource(pathFromResourceUrl(attribute.url), attribute.name),
      ),
      item.fling_effect
        ? this.localizedResourceText(pathFromResourceUrl(item.fling_effect.url), item.fling_effect.name)
        : Promise.resolve(null),
      mapPool(
        uniqueRefs((item.held_by_pokemon ?? []).map((entry) => entry.pokemon)),
        FETCH_CONCURRENCY,
        (pokemon) => this.heldPokemonLink(pokemon),
      ),
      mapPool(item.machines ?? [], FETCH_CONCURRENCY, (machine) => this.toItemMachine(machine)),
    ]);

    return {
      id: item.id,
      name: localizedName(item.names, item.name),
      iconUrl: item.sprites?.default ?? null,
      category,
      price: itemPrice(item),
      effect: localizedProse(item.effect_entries),
      flavorText: localizedProse(item.flavor_text_entries),
      attributes,
      flingPower: typeof item.fling_power === "number" ? item.fling_power : null,
      flingEffect,
      heldBy,
      machines,
      triggersBabyEvolution: item.baby_trigger_for != null,
    };
  }

  private async toItemListItem(id: number): Promise<ItemListItem | null> {
    let item: ItemResource;
    try {
      item = asItem(await this.readThrough(`/item/${id}`));
    } catch (error) {
      if (error instanceof CatalogueNotFoundError) return null;
      throw error;
    }
    return {
      id: item.id,
      name: localizedName(item.names, item.name),
      iconUrl: item.sprites?.default ?? null,
      category: await this.frenchFromResource(pathFromResourceUrl(item.category.url), item.category.name),
    };
  }

  private async heldPokemonLink(ref: ResourceRef): Promise<NamedLink> {
    const id = idFromResourceUrl(ref.url);
    try {
      const pokemon = asPokemon(await this.readThrough(pathFromResourceUrl(ref.url)));
      const species = await this.loadSpecies(pokemon);
      return { id: pokemon.id, name: localizedName(species?.names, pokemon.name) };
    } catch (error) {
      if (error instanceof CatalogueNotFoundError || error instanceof CatalogueUnavailableError) {
        return { id, name: ref.name };
      }
      throw error;
    }
  }

  private async toItemMachine(entry: ItemMachineEntry): Promise<ItemMachine> {
    const versionGroup = await this.frenchFromResource(
      pathFromResourceUrl(entry.version_group.url),
      entry.version_group.name,
    );
    try {
      const machine = asMachine(await this.readThrough(pathFromResourceUrl(entry.machine.url)));
      return {
        move: await this.frenchFromResource(pathFromResourceUrl(machine.move.url), machine.move.name),
        versionGroup,
      };
    } catch (error) {
      if (error instanceof CatalogueNotFoundError || error instanceof CatalogueUnavailableError) {
        return { move: entry.machine.name ?? "machine", versionGroup };
      }
      throw error;
    }
  }

  private async localizedResourceText(path: string, fallback: string): Promise<string> {
    try {
      const body = asTextResource(await this.readThrough(path));
      const named = localizedName(body.names, "");
      if (named) return named;
      return localizedProse(body.effect_entries) ?? fallback;
    } catch (error) {
      if (error instanceof CatalogueNotFoundError || error instanceof CatalogueUnavailableError) {
        return fallback;
      }
      throw error;
    }
  }
}

function normalizePage(page: number): number {
  if (!Number.isInteger(page) || page < 1) return 1;
  return page;
}

function normalizePath(path: string): string {
  const queryIndex = path.indexOf("?");
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : path.slice(queryIndex);
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const trimmed = withSlash.replace(/\/+$/, "") || "/";
  return `${trimmed}${query}`;
}

export function pathFromResourceUrl(url: string): string {
  const parsed = new URL(url);
  const marker = "/api/v2";
  const index = parsed.pathname.indexOf(marker);
  if (index === -1) throw new CatalogueUnavailableError();
  return normalizePath(parsed.pathname.slice(index + marker.length));
}

function idFromResourceUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) throw new CatalogueUnavailableError();
  return Number(match[1]);
}

function localizedName(names: NamedEntry[] | undefined, fallback: string): string {
  const french = names?.find((entry) => entry.language.name === "fr")?.name;
  if (french) return french;
  const english = names?.find((entry) => entry.language.name === "en")?.name;
  if (english) return english;
  return fallback;
}

function localizedGenus(species: SpeciesResource | null): string | null {
  const genera = species?.genera;
  if (!genera) return null;
  return (
    genera.find((entry) => entry.language.name === "fr")?.genus ??
    genera.find((entry) => entry.language.name === "en")?.genus ??
    null
  );
}

function localizedFlavor(species: SpeciesResource | null): string | null {
  const entries = species?.flavor_text_entries;
  if (!entries) return null;
  const text =
    entries.find((entry) => entry.language.name === "fr")?.flavor_text ??
    entries.find((entry) => entry.language.name === "en")?.flavor_text;
  if (!text) return null;
  return text.replace(/[\f\n\r]+/g, " ").replace(/\s+/g, " ").trim();
}

function flattenChain(link: ChainLink): ResourceRef[] {
  return [link.species, ...(link.evolves_to ?? []).flatMap(flattenChain)];
}

function uniqueRefs(refs: ResourceRef[]): ResourceRef[] {
  const seen = new Set<string>();
  const unique: ResourceRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.url)) continue;
    seen.add(ref.url);
    unique.push(ref);
  }
  return unique;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asList(value: unknown): ListResource {
  if (!isRecord(value) || typeof value.count !== "number" || !Array.isArray(value.results)) {
    throw new CatalogueUnavailableError();
  }
  return value as ListResource;
}

function asPokemon(value: unknown): PokemonResource {
  if (!isRecord(value) || typeof value.id !== "number" || !isRecord(value.sprites)) {
    throw new CatalogueUnavailableError();
  }
  return value as PokemonResource;
}

function asSpecies(value: unknown): SpeciesResource {
  if (!isRecord(value)) throw new CatalogueUnavailableError();
  return value as SpeciesResource;
}

function asNames(value: unknown): NamesResource {
  if (!isRecord(value)) throw new CatalogueUnavailableError();
  return value as NamesResource;
}

function asEvolution(value: unknown): EvolutionResource {
  if (!isRecord(value) || !isRecord(value.chain)) throw new CatalogueUnavailableError();
  return value as EvolutionResource;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

type ProseEntry = {
  language?: { name: string };
  short_effect?: string;
  effect?: string;
  text?: string;
};

type ItemPriceRow = {
  purchase_price?: number | null;
  sell_price?: number | null;
  currency?: { name: string };
};

type ItemMachineEntry = {
  machine: { url: string; name?: string };
  version_group: ResourceRef;
};

type ItemResource = {
  id: number;
  name: string;
  names?: NamedEntry[];
  sprites?: { default?: string | null };
  category: ResourceRef;
  prices?: ItemPriceRow[];
  effect_entries?: ProseEntry[];
  flavor_text_entries?: ProseEntry[];
  attributes?: ResourceRef[];
  fling_power?: number | null;
  fling_effect?: ResourceRef | null;
  held_by_pokemon?: { pokemon: ResourceRef }[];
  machines?: ItemMachineEntry[];
  baby_trigger_for?: { url: string } | null;
};

type TextResource = {
  names?: NamedEntry[];
  effect_entries?: ProseEntry[];
};

type MachineResource = {
  move: ResourceRef;
};

function itemPrice(item: ItemResource): ItemPrice | null {
  const prices = item.prices ?? [];
  const latest =
    [...prices].reverse().find((row) => row.currency?.name === "poke-dollar") ?? [...prices].reverse()[0];
  if (!latest) return null;
  return {
    purchase: typeof latest.purchase_price === "number" ? latest.purchase_price : null,
    sell: typeof latest.sell_price === "number" ? latest.sell_price : null,
  };
}

function localizedProse(entries: ProseEntry[] | undefined): string | null {
  if (!entries) return null;
  const pick = (language: string) => {
    const entry = entries.filter((candidate) => candidate.language?.name === language).at(-1);
    const raw = entry?.short_effect || entry?.effect || entry?.text;
    if (!raw) return null;
    return raw.replace(/[\f\n\r]+/g, " ").replace(/\s+/g, " ").trim();
  };
  return pick("fr") ?? pick("en");
}

function asItem(value: unknown): ItemResource {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    typeof value.name !== "string" ||
    !isRecord(value.category) ||
    typeof value.category.name !== "string" ||
    typeof value.category.url !== "string"
  ) {
    throw new CatalogueUnavailableError();
  }
  return value as ItemResource;
}

function asMachine(value: unknown): MachineResource {
  if (!isRecord(value) || !isRecord(value.move) || typeof value.move.url !== "string") {
    throw new CatalogueUnavailableError();
  }
  return value as MachineResource;
}

function asTextResource(value: unknown): TextResource {
  if (!isRecord(value)) throw new CatalogueUnavailableError();
  return value as TextResource;
}
