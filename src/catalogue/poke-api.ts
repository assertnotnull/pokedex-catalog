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

export type ResourcePage = {
  count: number;
  results: NamedResource[];
};

export type PokemonPage = ResourcePage;

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

export type ItemPricePayload = {
  purchase_price: number | null;
  sell_price: number | null;
  version_group?: NamedResource;
};

export type ItemPayload = {
  id: number;
  prices: ItemPricePayload[];
  sprites: { default: string | null };
  category: NamedResource;
  attributes: NamedResource[];
  effect_entries: { effect?: string; short_effect?: string; language: { name: string } }[];
  flavor_text_entries: {
    text: string;
    language: { name: string };
    version_group?: NamedResource;
  }[];
  names: LocalizedName[];
  held_by_pokemon: {
    pokemon: NamedResource;
    version_details?: { version: NamedResource }[];
  }[];
  machines?: { machine: NamedResource; version_group: NamedResource }[];
  fling_power?: number | null;
  fling_effect?: NamedResource | null;
};

export type VersionGroupPayload = {
  id: number;
  versions: NamedResource[];
};

export type MachinePayload = {
  id: number;
  move: NamedResource;
};

export type FlingEffectPayload = {
  id: number;
  effect_entries: { effect: string; language: { name: string } }[];
};

export abstract class PokeApi {
  abstract listPokemon(offset: number, limit: number): Promise<ResourcePage>;
  abstract listRegions(offset: number, limit: number): Promise<ResourcePage>;
  abstract getRegion(id: number): Promise<RegionPayload>;
  abstract getLocation(id: number): Promise<LocationPayload>;
  abstract getLocationArea(id: number): Promise<LocationAreaPayload>;
  abstract getEncounterMethod(id: number): Promise<DescribedPayload>;
  abstract getPokemon(id: number): Promise<PokemonPayload>;
  abstract getSpecies(id: number): Promise<SpeciesPayload>;
  abstract getType(id: number): Promise<TypePayload>;
  abstract getEvolutionChain(id: number): Promise<EvolutionChainPayload>;
  abstract getAbility(id: number): Promise<DescribedPayload>;
  abstract getMove(id: number): Promise<DescribedPayload>;
  abstract getStat(id: number): Promise<DescribedPayload>;
  abstract listItems(offset: number, limit: number): Promise<ResourcePage>;
  abstract getItem(id: number): Promise<ItemPayload>;
  abstract getItemCategory(id: number): Promise<DescribedPayload>;
  abstract getItemAttribute(id: number): Promise<DescribedPayload>;
  abstract getVersionGroup(id: number): Promise<VersionGroupPayload>;
  abstract getVersion(id: number): Promise<DescribedPayload>;
  abstract getMachine(id: number): Promise<MachinePayload>;
  abstract getItemFlingEffect(id: number): Promise<FlingEffectPayload>;
}
