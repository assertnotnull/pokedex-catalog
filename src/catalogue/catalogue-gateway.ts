import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "./cache-store";
import { Clock } from "./clock";
import { PokeApi } from "./poke-api";

const PAGE_SIZE = 24;

export type PokemonListPage = {
  total: number;
  entries: unknown[];
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
    return { total: list.count, entries: [] };
  }

  private async load<T>(key: string, fetchBody: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached) {
      return cached.body as T;
    }

    const body = await fetchBody();
    await this.cache.set(key, body, this.clock.now());
    return body;
  }
}
