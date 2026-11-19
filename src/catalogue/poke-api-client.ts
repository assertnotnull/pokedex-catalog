import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
  type LocationAreaPayload,
  type LocationPayload,
  type PokemonPage,
  type PokemonPayload,
  type RegionPayload,
  type ResourcePage,
  type SpeciesPayload,
  type TypePayload,
  type VersionGroupPayload,
  type VersionPage,
  type VersionPayload,
} from "./poke-api";

const ROOT = "https://pokeapi.co/api/v2";

export class PokeApiClient extends PokeApi {
  listPokemon(offset: number, limit: number): Promise<PokemonPage> {
    return this.get(`${ROOT}/pokemon?limit=${limit}&offset=${offset}`);
  }

  listRegions(offset: number, limit: number): Promise<ResourcePage> {
    return this.get(`${ROOT}/region?limit=${limit}&offset=${offset}`);
  }

  getRegion(id: number): Promise<RegionPayload> {
    return this.get(`${ROOT}/region/${id}/`);
  }

  getLocation(id: number): Promise<LocationPayload> {
    return this.get(`${ROOT}/location/${id}/`);
  }

  getLocationArea(id: number): Promise<LocationAreaPayload> {
    return this.get(`${ROOT}/location-area/${id}/`);
  }

  getEncounterMethod(id: number): Promise<DescribedPayload> {
    return this.get(`${ROOT}/encounter-method/${id}/`);
  }

  getPokemon(id: number): Promise<PokemonPayload> {
    return this.get(`${ROOT}/pokemon/${id}/`);
  }

  getSpecies(id: number): Promise<SpeciesPayload> {
    return this.get(`${ROOT}/pokemon-species/${id}/`);
  }

  getType(id: number): Promise<TypePayload> {
    return this.get(`${ROOT}/type/${id}/`);
  }

  getEvolutionChain(id: number): Promise<EvolutionChainPayload> {
    return this.get(`${ROOT}/evolution-chain/${id}/`);
  }

  getAbility(id: number): Promise<DescribedPayload> {
    return this.get(`${ROOT}/ability/${id}/`);
  }

  getMove(id: number): Promise<DescribedPayload> {
    return this.get(`${ROOT}/move/${id}/`);
  }

  getStat(id: number): Promise<DescribedPayload> {
    return this.get(`${ROOT}/stat/${id}/`);
  }

  listVersions(offset: number, limit: number): Promise<VersionPage> {
    return this.get(`${ROOT}/version?limit=${limit}&offset=${offset}`);
  }

  getVersion(id: number): Promise<VersionPayload> {
    return this.get(`${ROOT}/version/${id}/`);
  }

  getVersionGroup(id: number): Promise<VersionGroupPayload> {
    return this.get(`${ROOT}/version-group/${id}/`);
  }

  getGeneration(id: number): Promise<DescribedPayload> {
    return this.get(`${ROOT}/generation/${id}/`);
  }

  private async get<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 404) {
      throw new UpstreamNotFound(url);
    }
    if (!response.ok) {
      throw new Error(`PokeAPI responded ${response.status} for ${url}`);
    }
    return (await response.json()) as T;
  }
}
