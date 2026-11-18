import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
  type GenerationPayload,
  type ItemPayload,
  type PokemonPage,
  type VersionGroupPayload,
  type VersionPayload,
  type PokemonPayload,
  type SpeciesPayload,
  type TypePayload,
} from "./poke-api";

const ROOT = "https://pokeapi.co/api/v2";

export class PokeApiClient extends PokeApi {
  listPokemon(offset: number, limit: number): Promise<PokemonPage> {
    return this.get(`${ROOT}/pokemon?limit=${limit}&offset=${offset}`);
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

  listItems(offset: number, limit: number): Promise<PokemonPage> {
    return this.get(`${ROOT}/item?limit=${limit}&offset=${offset}`);
  }

  getItem(id: number): Promise<ItemPayload> {
    return this.get(`${ROOT}/item/${id}/`);
  }

  getItemCategory(id: number): Promise<DescribedPayload> {
    return this.get(`${ROOT}/item-category/${id}/`);
  }

  getItemAttribute(id: number): Promise<DescribedPayload> {
    return this.get(`${ROOT}/item-attribute/${id}/`);
  }

  listVersions(offset: number, limit: number): Promise<PokemonPage> {
    return this.get(`${ROOT}/version?limit=${limit}&offset=${offset}`);
  }

  getVersion(id: number): Promise<VersionPayload> {
    return this.get(`${ROOT}/version/${id}/`);
  }

  getVersionGroup(id: number): Promise<VersionGroupPayload> {
    return this.get(`${ROOT}/version-group/${id}/`);
  }

  getGeneration(id: number): Promise<GenerationPayload> {
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
