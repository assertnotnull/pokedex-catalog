export type NamedResource = {
  name: string;
  url: string;
};

export type PokemonPage = {
  count: number;
  results: NamedResource[];
};

export abstract class PokeApi {
  abstract listPokemon(offset: number, limit: number): Promise<PokemonPage>;
}
