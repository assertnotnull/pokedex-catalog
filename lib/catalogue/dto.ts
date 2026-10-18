/** Fields shown on a Pokémon list tile. Detail-only data stays off this type. */
export type PokemonListItem = {
  id: number;
  name: string;
  spriteUrl: string | null;
  types: string[];
};

export type PokemonListPage = {
  page: number;
  pageSize: number;
  total: number;
  items: PokemonListItem[];
};

export type NamedLink = {
  id: number;
  name: string;
};

export type PokemonAbility = {
  name: string;
  isHidden: boolean;
};

export type PokemonStat = {
  name: string;
  value: number;
};

export type PokemonDetail = {
  id: number;
  name: string;
  genus: string | null;
  flavorText: string | null;
  spriteUrl: string | null;
  artworkUrl: string | null;
  types: string[];
  heightMeters: number;
  weightKilograms: number;
  abilities: PokemonAbility[];
  stats: PokemonStat[];
  moves: { name: string }[];
  evolutions: NamedLink[];
  heldItems: NamedLink[];
};

/** Fields shown on a Game list tile. Detail-only data stays off this type. */
export type GameListItem = {
  id: number;
  name: string;
  artworkUrl: string | null;
  generationLabel: string;
};

export type GameListPage = {
  page: number;
  pageSize: number;
  total: number;
  items: GameListItem[];
};

export type GameDetail = {
  id: number;
  name: string;
  artworkUrl: string | null;
  generationLabel: string;
};
