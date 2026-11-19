import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "./cache-store";
import { Clock } from "./clock";
import {
  CatalogueUnavailableError,
  UnknownGameError,
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
  type LocalizedName,
  type LocationAreaPayload,
  type LocationPayload,
  type NamedResource,
  type PokemonPayload,
  type RegionPayload,
  type SpeciesPayload,
  type TypePayload,
  type VersionGroupPayload,
  type VersionPayload,
} from "./poke-api";

export const POKEMON_PAGE_SIZE = 24;
export const GAME_PAGE_SIZE = 24;
export const LOCATION_PAGE_SIZE = 24;
const REGION_INDEX_PAGE_SIZE = 24;
const FRESH_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export type RegionListEntry = {
  id: number;
  frenchName: string;
};

export type LocationListEntry = {
  id: number;
  frenchName: string;
  regionName: string;
};

export type LocationListPage = {
  total: number;
  regionName: string;
  entries: LocationListEntry[];
};

export type LocationEncounter = {
  pokemonId: number;
  frenchName: string;
  method: string;
  versions: string[];
  minLevel: number;
  maxLevel: number;
};

export type LocationDetail = {
  id: number;
  frenchName: string;
  regionId: number;
  regionName: string;
  encounters: LocationEncounter[];
};

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
  label: string;
};

export type GameListPage = {
  total: number;
  entries: GameListEntry[];
};

export type GameDetail = GameListEntry;

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

@injectable()
export class CatalogueGateway {
  constructor(
    private readonly cache = inject(CacheStore),
    private readonly upstream = inject(PokeApi),
    private readonly clock = inject(Clock),
  ) {}

  async listRegions(): Promise<RegionListEntry[]> {
    const index = await this.regionIndex();
    const regions = await Promise.all(
      index.map((resource) => this.region(idFromUrl(resource.url))),
    );
    return regions.map((region) => ({
      id: region.id,
      frenchName: localizedName(region.names),
    }));
  }

  async listLocations(regionId: number, page: number): Promise<LocationListPage> {
    const region = await this.regionOrNotFound(regionId);
    const regionName = localizedName(region.names);
    const start = (page - 1) * LOCATION_PAGE_SIZE;
    const slice = region.locations.slice(start, start + LOCATION_PAGE_SIZE);
    const entries = await Promise.all(
      slice.map(async (resource) => {
        const place = await this.location(idFromUrl(resource.url));
        return {
          id: place.id,
          frenchName: localizedName(place.names),
          regionName,
        };
      }),
    );
    return { total: region.locations.length, regionName, entries };
  }

  async getLocation(regionId: number, locationId: number): Promise<LocationDetail> {
    const place = await this.locationOrNotFound(locationId);
    if (!place.region || idFromUrl(place.region.url) !== regionId) {
      throw new UnknownLocationError(locationId);
    }
    const region = await this.regionOrNotFound(regionId);
    return {
      id: place.id,
      frenchName: localizedName(place.names),
      regionId: region.id,
      regionName: localizedName(region.names),
      encounters: await this.encounters(place),
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
    return { total: list.count, entries };
  }

  async listGames(page: number): Promise<GameListPage> {
    const offset = (page - 1) * GAME_PAGE_SIZE;
    const list = await this.load(`version-list:${GAME_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listVersions(offset, GAME_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.gameEntry(idFromUrl(result.url))),
    );
    return { total: list.count, entries };
  }

  async getGame(id: number): Promise<GameDetail> {
    try {
      return await this.gameEntry(id);
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownGameError(id);
      }
      throw error;
    }
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
    const generationId = idFromUrl(group.generation.url);
    const generation = await this.load<DescribedPayload>(`generation:${generationId}`, () =>
      this.upstream.getGeneration(generationId),
    );
    return {
      id: version.id,
      frenchName: localizedName(version.names),
      artworkUrl: null,
      label: localizedName(generation.names),
    };
  }

  private async regionIndex(): Promise<NamedResource[]> {
    const first = await this.load(`region-index:0:${REGION_INDEX_PAGE_SIZE}`, () =>
      this.upstream.listRegions(0, REGION_INDEX_PAGE_SIZE),
    );
    const results = [...first.results];
    let offset = REGION_INDEX_PAGE_SIZE;
    while (results.length < first.count) {
      const page = await this.load(`region-index:${offset}:${REGION_INDEX_PAGE_SIZE}`, () =>
        this.upstream.listRegions(offset, REGION_INDEX_PAGE_SIZE),
      );
      if (page.results.length === 0) {
        break;
      }
      results.push(...page.results);
      offset += REGION_INDEX_PAGE_SIZE;
    }
    return results;
  }

  private region(id: number): Promise<RegionPayload> {
    return this.load(`region:${id}`, () => this.upstream.getRegion(id));
  }

  private async regionOrNotFound(id: number): Promise<RegionPayload> {
    try {
      return await this.region(id);
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownRegionError(id);
      }
      throw error;
    }
  }

  private location(id: number): Promise<LocationPayload> {
    return this.load(`location:${id}`, () => this.upstream.getLocation(id));
  }

  private async locationOrNotFound(id: number): Promise<LocationPayload> {
    try {
      return await this.location(id);
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownLocationError(id);
      }
      throw error;
    }
  }

  private async encounters(place: LocationPayload): Promise<LocationEncounter[]> {
    const groups = new Map<string, LocationEncounter>();
    for (const areaRef of place.areas) {
      const areaId = idFromUrl(areaRef.url);
      const area = await this.load<LocationAreaPayload>(`location-area:${areaId}`, () =>
        this.upstream.getLocationArea(areaId),
      );
      for (const encounter of area.pokemon_encounters) {
        const pokemonId = idFromUrl(encounter.pokemon.url);
        const pokemon = await this.load<PokemonPayload>(`pokemon:${pokemonId}`, () =>
          this.upstream.getPokemon(pokemonId),
        );
        const species = await this.species(pokemon);
        const frenchName = localizedName(species.names);
        for (const versionDetail of encounter.version_details) {
          const version = await this.described(`version`, versionDetail.version.url, (versionId) =>
            this.upstream.getVersion(versionId),
          );
          const versionName = localizedName(version.names);
          for (const detail of versionDetail.encounter_details) {
            const methodId = idFromUrl(detail.method.url);
            const method = await this.described(`encounter-method`, detail.method.url, (id) =>
              this.upstream.getEncounterMethod(id),
            );
            const key = `${pokemonId}:${methodId}`;
            const existing = groups.get(key);
            if (!existing) {
              groups.set(key, {
                pokemonId,
                frenchName,
                method: localizedName(method.names),
                versions: [versionName],
                minLevel: detail.min_level,
                maxLevel: detail.max_level,
              });
              continue;
            }
            if (!existing.versions.includes(versionName)) {
              existing.versions.push(versionName);
            }
            existing.minLevel = Math.min(existing.minLevel, detail.min_level);
            existing.maxLevel = Math.max(existing.maxLevel, detail.max_level);
          }
        }
      }
    }
    return [...groups.values()];
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
