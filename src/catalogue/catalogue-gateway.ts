import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "./cache-store";
import { Clock } from "./clock";
import { CatalogueUnavailableError } from "./errors";
import {
  PokeApi,
  type LocalizedName,
  type PokemonPayload,
  type SpeciesPayload,
  type TypePayload,
} from "./poke-api";

const PAGE_SIZE = 24;
const FRESH_FOR_MS = 7 * 24 * 60 * 60 * 1000;

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

@injectable()
export class CatalogueGateway {
  constructor(
    private readonly cache = inject(CacheStore),
    private readonly upstream = inject(PokeApi),
    private readonly clock = inject(Clock),
  ) {}

  async listPokemon(page: number): Promise<PokemonListPage> {
    const offset = (page - 1) * PAGE_SIZE;
    const list = await this.load(`pokemon-list:${PAGE_SIZE}:${offset}`, () =>
      this.upstream.listPokemon(offset, PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.listEntry(idFromUrl(result.url))),
    );
    return { total: list.count, entries };
  }

  private async listEntry(id: number): Promise<PokemonListEntry> {
    const pokemon = await this.load<PokemonPayload>(`pokemon:${id}`, () =>
      this.upstream.getPokemon(id),
    );
    const speciesId = idFromUrl(pokemon.species.url);
    const species = await this.load<SpeciesPayload>(`species:${speciesId}`, () =>
      this.upstream.getSpecies(speciesId),
    );
    const types = await Promise.all(
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

    return {
      nationalNumber: pokemon.id,
      frenchName: localizedName(species.names),
      spriteUrl: pokemon.sprites.front_default,
      types,
    };
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
    } catch {
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

function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  if (!match) {
    throw new Error(`No id in ${url}`);
  }
  return Number(match[1]);
}
