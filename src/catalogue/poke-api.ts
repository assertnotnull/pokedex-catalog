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

export type ItemPayload = {
  id: number;
  prices: { purchase_price: number | null; sell_price: number | null }[];
  sprites: { default: string | null };
  category: NamedResource;
  attributes: NamedResource[];
  effect_entries: { short_effect: string; language: { name: string } }[];
  flavor_text_entries: { text: string; language: { name: string } }[];
  names: LocalizedName[];
  held_by_pokemon: { pokemon: NamedResource }[];
  game_indices?: { generation: NamedResource }[];
};

export type VersionPayload = {
  id: number;
  name: string;
  names: LocalizedName[];
  version_group: NamedResource;
};

export type VersionGroupPayload = {
  id: number;
  name: string;
  generation?: NamedResource;
  pokedexes: NamedResource[];
  regions: NamedResource[];
};

export type PokedexPayload = {
  id: number;
  pokemon_entries: { pokemon_species: NamedResource }[];
};

export type RegionPayload = {
  id: number;
  names: LocalizedName[];
  locations: NamedResource[];
};

export type LocationPayload = {
  id: number;
  names: LocalizedName[];
};

export abstract class PokeApi {
  abstract listPokemon(offset: number, limit: number): Promise<PokemonPage>;
  abstract getPokemon(id: number): Promise<PokemonPayload>;
  abstract getSpecies(id: number): Promise<SpeciesPayload>;
  abstract getType(id: number): Promise<TypePayload>;
  abstract getEvolutionChain(id: number): Promise<EvolutionChainPayload>;
  abstract getAbility(id: number): Promise<DescribedPayload>;
  abstract getMove(id: number): Promise<DescribedPayload>;
  abstract getStat(id: number): Promise<DescribedPayload>;
  abstract listItems(offset: number, limit: number): Promise<PokemonPage>;
  abstract getItem(id: number): Promise<ItemPayload>;
  abstract getItemCategory(id: number): Promise<DescribedPayload>;
  abstract getItemAttribute(id: number): Promise<DescribedPayload>;
  abstract getVersion(id: number): Promise<VersionPayload>;
  abstract getVersionGroup(id: number): Promise<VersionGroupPayload>;
  abstract getPokedex(id: number): Promise<PokedexPayload>;
  abstract getRegion(id: number): Promise<RegionPayload>;
  abstract getLocation(id: number): Promise<LocationPayload>;
}
