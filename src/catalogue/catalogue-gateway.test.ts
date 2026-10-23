import { Container } from "@needle-di/core";
import { describe, expect, test } from "bun:test";
import { CacheStore, InMemoryCacheStore } from "./cache-store";
import { CatalogueGateway } from "./catalogue-gateway";
import { Clock, FixedClock } from "./clock";
import { PokeApi, type PokemonPage } from "./poke-api";

const T0 = 1_700_000_000_000;

const pagePayload: PokemonPage = {
  count: 1,
  results: [{ name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" }],
};

describe("catalogue gateway", () => {
  test("a cache miss stores the upstream payload", async () => {
    const { gateway, cache } = openGateway();

    await gateway.listPokemon(1);

    expect(cache.storedBodies()).toContainEqual(pagePayload);
  });
});

function openGateway() {
  const cache = new InMemoryCacheStore();
  const clock = new FixedClock(T0);
  const upstream = new FakePokeApi(pagePayload);
  const container = new Container();
  container.bind({ provide: CacheStore, useValue: cache });
  container.bind({ provide: PokeApi, useValue: upstream });
  container.bind({ provide: Clock, useValue: clock });
  return {
    gateway: container.get(CatalogueGateway),
    cache,
    clock,
    upstream,
  };
}

class FakePokeApi extends PokeApi {
  constructor(private readonly page: PokemonPage) {
    super();
  }

  listPokemon(): Promise<PokemonPage> {
    return Promise.resolve(this.page);
  }
}
