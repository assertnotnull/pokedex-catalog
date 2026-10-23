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

/** Fields shown on an item list tile. Detail-only data stays off this type. */
export type ItemListItem = {
  id: number;
  name: string;
  iconUrl: string | null;
  category: string;
};

export type ItemListPage = {
  page: number;
  pageSize: number;
  total: number;
  items: ItemListItem[];
};

export type ItemPrice = {
  purchase: number | null;
  sell: number | null;
};

export type ItemMachine = {
  move: string;
  versionGroup: string;
};

export type ItemDetail = {
  id: number;
  name: string;
  iconUrl: string | null;
  category: string;
  price: ItemPrice | null;
  effect: string | null;
  flavorText: string | null;
  attributes: string[];
  flingPower: number | null;
  flingEffect: string | null;
  heldBy: NamedLink[];
  machines: ItemMachine[];
  triggersBabyEvolution: boolean;
};
