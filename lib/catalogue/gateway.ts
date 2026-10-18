import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "@/lib/cache/cache-store";
import { Clock } from "@/lib/catalogue/clock";
import type {
  LocationDetail,
  LocationEncounter,
  LocationListItem,
  LocationListPage,
  NamedLink,
  PokemonDetail,
  PokemonListItem,
  PokemonListPage,
  RegionListItem,
} from "@/lib/catalogue/dto";
import {
  CatalogueNotFoundError,
  CatalogueUnavailableError,
  UpstreamNotFoundError,
} from "@/lib/catalogue/errors";
import { UpstreamClient } from "@/lib/catalogue/upstream";

export const POKEMON_PAGE_SIZE = 24;
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

type ListResource = { count: number; next?: string | null; results: ResourceRef[] };

type NamesResource = { names?: NamedEntry[] };

type RegionResource = {
  id: number;
  name: string;
  names?: NamedEntry[];
  locations: ResourceRef[];
};

type LocationResource = {
  id: number;
  name: string;
  names?: NamedEntry[];
  areas: ResourceRef[];
};

type EncounterDetail = {
  min_level: number;
  max_level: number;
  chance: number;
  method: ResourceRef;
};

type VersionEncounter = {
  version: ResourceRef;
  encounter_details?: EncounterDetail[];
};

type PokemonEncounter = {
  pokemon: ResourceRef;
  version_details?: VersionEncounter[];
};

type LocationAreaResource = {
  name: string;
  names?: NamedEntry[];
  pokemon_encounters: PokemonEncounter[];
};

type EncounterRow = {
  pokemon: ResourceRef;
  version: ResourceRef;
  method: ResourceRef;
  minLevel: number;
  maxLevel: number;
  chance: number;
};

type EncounterArea = {
  zone: string;
  rows: EncounterRow[];
};

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

  async listRegions(): Promise<RegionListItem[]> {
    const refs = await this.collectResourceList("region");
    const items = (
      await mapPool(refs, FETCH_CONCURRENCY, async (ref) => {
        const id = idFromResourceUrl(ref.url);
        try {
          const region = asRegion(await this.readThrough(`/region/${id}`));
          return { id: region.id, name: localizedName(region.names, region.name) };
        } catch (error) {
          if (error instanceof CatalogueNotFoundError) return null;
          throw error;
        }
      })
    ).filter((item): item is RegionListItem => item !== null);
    return items.sort((a, b) => a.id - b.id);
  }

  async listLocations(regionId: number, page: number): Promise<LocationListPage> {
    const region = await this.loadRegion(regionId);
    const safePage = normalizePage(page);
    const regionName = localizedName(region.names, region.name);
    const offset = (safePage - 1) * POKEMON_PAGE_SIZE;
    const slice = region.locations.slice(offset, offset + POKEMON_PAGE_SIZE);
    const items = (
      await mapPool(slice, FETCH_CONCURRENCY, async (ref) => {
        const id = idFromResourceUrl(ref.url);
        try {
          const location = asLocation(await this.readThrough(`/location/${id}`));
          return {
            id: location.id,
            name: localizedName(location.names, location.name),
            region: regionName,
          };
        } catch (error) {
          if (error instanceof CatalogueNotFoundError) return null;
          throw error;
        }
      })
    ).filter((item): item is LocationListItem => item !== null);

    return {
      page: safePage,
      pageSize: POKEMON_PAGE_SIZE,
      total: region.locations.length,
      region: { id: region.id, name: regionName },
      items,
    };
  }

  async getLocation(regionId: number, locationId: number): Promise<LocationDetail> {
    if (!Number.isInteger(locationId) || locationId < 1) {
      throw new CatalogueNotFoundError(String(locationId));
    }
    const region = await this.loadRegion(regionId);
    const listed = region.locations.some((ref) => idFromResourceUrl(ref.url) === locationId);
    if (!listed) throw new CatalogueNotFoundError(String(locationId));

    let location: LocationResource;
    try {
      location = asLocation(await this.readThrough(`/location/${locationId}`));
    } catch (error) {
      if (error instanceof CatalogueNotFoundError) throw new CatalogueNotFoundError(String(locationId));
      throw error;
    }

    return {
      id: location.id,
      name: localizedName(location.names, location.name),
      region: { id: region.id, name: localizedName(region.names, region.name) },
      encounters: await this.loadEncounters(location),
    };
  }

  private async loadRegion(regionId: number): Promise<RegionResource> {
    if (!Number.isInteger(regionId) || regionId < 1) {
      throw new CatalogueNotFoundError(String(regionId));
    }
    try {
      return asRegion(await this.readThrough(`/region/${regionId}`));
    } catch (error) {
      if (error instanceof CatalogueNotFoundError) throw new CatalogueNotFoundError(String(regionId));
      throw error;
    }
  }

  private async collectResourceList(resource: string): Promise<ResourceRef[]> {
    const refs: ResourceRef[] = [];
    const seen = new Set<string>();
    let path: string | null = `/${resource}?limit=100&offset=0`;
    while (path && !seen.has(path)) {
      seen.add(path);
      const list = asList(await this.readThrough(path));
      refs.push(...list.results);
      path = list.next ? pathFromResourceUrl(list.next) : null;
    }
    return refs;
  }

  private async loadEncounters(location: LocationResource): Promise<LocationEncounter[]> {
    const areas = await mapPool(location.areas, FETCH_CONCURRENCY, (ref) => this.loadEncounterArea(ref));
    const rows = areas
      .filter((area): area is EncounterArea => area !== null)
      .flatMap((area) => area.rows.map((row) => ({ zone: area.zone, ...row })));
    if (rows.length === 0) return [];

    const pokemonLinks = new Map<string, NamedLink>();
    const versionNames = new Map<string, string>();
    const methodNames = new Map<string, string>();
    await Promise.all([
      mapPool(uniqueRefs(rows.map((row) => row.pokemon)), FETCH_CONCURRENCY, async (ref) => {
        pokemonLinks.set(ref.url, await this.pokemonLink(ref));
      }),
      mapPool(uniqueRefs(rows.map((row) => row.version)), FETCH_CONCURRENCY, async (ref) => {
        versionNames.set(ref.url, await this.frenchFromResource(pathFromResourceUrl(ref.url), ref.name));
      }),
      mapPool(uniqueRefs(rows.map((row) => row.method)), FETCH_CONCURRENCY, async (ref) => {
        methodNames.set(ref.url, await this.frenchFromResource(pathFromResourceUrl(ref.url), ref.name));
      }),
    ]);

    return rows.map((row) => ({
      zone: row.zone,
      pokemon: pokemonLinks.get(row.pokemon.url) ?? {
        id: idFromResourceUrl(row.pokemon.url),
        name: row.pokemon.name,
      },
      version: versionNames.get(row.version.url) ?? row.version.name,
      method: methodNames.get(row.method.url) ?? row.method.name,
      minLevel: row.minLevel,
      maxLevel: row.maxLevel,
      chance: row.chance,
    }));
  }

  private async loadEncounterArea(ref: ResourceRef): Promise<EncounterArea | null> {
    try {
      const area = asLocationArea(await this.readThrough(pathFromResourceUrl(ref.url)));
      const rows: EncounterRow[] = [];
      for (const encounter of area.pokemon_encounters) {
        for (const version of encounter.version_details ?? []) {
          for (const detail of version.encounter_details ?? []) {
            rows.push({
              pokemon: encounter.pokemon,
              version: version.version,
              method: detail.method,
              minLevel: detail.min_level,
              maxLevel: detail.max_level,
              chance: detail.chance,
            });
          }
        }
      }
      return { zone: localizedName(area.names, area.name), rows };
    } catch (error) {
      if (error instanceof CatalogueNotFoundError) return null;
      throw error;
    }
  }

  private async pokemonLink(ref: ResourceRef): Promise<NamedLink> {
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
  return normalizePath(`${parsed.pathname.slice(index + marker.length)}${parsed.search}`);
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

function asRegion(value: unknown): RegionResource {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.locations)
  ) {
    throw new CatalogueUnavailableError();
  }
  return value as RegionResource;
}

function asLocation(value: unknown): LocationResource {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.areas)
  ) {
    throw new CatalogueUnavailableError();
  }
  return value as LocationResource;
}

function asLocationArea(value: unknown): LocationAreaResource {
  if (!isRecord(value) || typeof value.name !== "string" || !Array.isArray(value.pokemon_encounters)) {
    throw new CatalogueUnavailableError();
  }
  return value as LocationAreaResource;
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
