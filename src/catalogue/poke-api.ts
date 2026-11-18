export class UpstreamNotFound extends Error {
  constructor(readonly resource: string) {
    super(`Upstream resource was not found: ${resource}`);
    this.name = "UpstreamNotFound";
  }
}

export type NamedResource = {
  name: string;
  url: string;
};

export type PokemonPage = {
  count: number;
  results: NamedResource[];
};

export type ResourcePage = PokemonPage;

export type RegionPayload = {
  id: number;
  names: LocalizedName[];
  locations: NamedResource[];
};

export type LocationPayload = {
  id: number;
  names: LocalizedName[];
  region: NamedResource | null;
  areas: NamedResource[];
};

export type LocationAreaPayload = {
  id: number;
  names: LocalizedName[];
  pokemon_encounters: {
    pokemon: NamedResource;
    version_details: {
      version: NamedResource;
      encounter_details: {
        min_level: number;
        max_level: number;
        method: NamedResource;
      }[];
    }[];
  }[];
};

export type LocalizedName = {
  name: string;
  language: { name: string };
};

export type PokemonPayload = {
  id: number;
  sprites: { front_default: string | null };
  types: { slot: number; type: NamedResource }[];
  stats: { base_stat: number; stat: NamedResource }[];
  abilities: { is_hidden: boolean; ability: NamedResource }[];
  moves: { move: NamedResource }[];
  species: NamedResource;
};

export type SpeciesPayload = {
  id: number;
  names: LocalizedName[];
  evolution_chain?: { url: string };
};

export type TypePayload = {
  id: number;
  names: LocalizedName[];
};

export type DescribedPayload = {
  id: number;
  names: LocalizedName[];
};

export type EvolutionLink = {
  species: NamedResource;
  evolves_to: EvolutionLink[];
};

export type EvolutionChainPayload = {
  id: number;
  chain: EvolutionLink;
};

export abstract class PokeApi {
  abstract listPokemon(offset: number, limit: number): Promise<PokemonPage>;
  abstract listRegions(offset: number, limit: number): Promise<ResourcePage>;
  abstract getRegion(id: number): Promise<RegionPayload>;
  abstract getLocation(id: number): Promise<LocationPayload>;
  abstract getLocationArea(id: number): Promise<LocationAreaPayload>;
  abstract getVersion(id: number): Promise<DescribedPayload>;
  abstract getEncounterMethod(id: number): Promise<DescribedPayload>;
  abstract getPokemon(id: number): Promise<PokemonPayload>;
  abstract getSpecies(id: number): Promise<SpeciesPayload>;
  abstract getType(id: number): Promise<TypePayload>;
  abstract getEvolutionChain(id: number): Promise<EvolutionChainPayload>;
  abstract getAbility(id: number): Promise<DescribedPayload>;
  abstract getMove(id: number): Promise<DescribedPayload>;
  abstract getStat(id: number): Promise<DescribedPayload>;
}
