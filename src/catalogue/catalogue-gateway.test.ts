import { Container } from "@needle-di/core";
import { describe, expect, test } from "bun:test";
import { CacheStore, InMemoryCacheStore } from "./cache-store";
import { CatalogueGateway } from "./catalogue-gateway";
import { Clock, FixedClock } from "./clock";
import { CatalogueUnavailableError } from "./errors";
import { PokeApi, type PokemonPage } from "./poke-api";

const T0 = 1_700_000_000_000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

  test("a fresh cache hit does not refetch the upstream payload", async () => {
    const { gateway, upstream } = openGateway();

    await gateway.listPokemon(1);
    const callsAfterMiss = upstream.callCount;

    await gateway.listPokemon(1);

    expect(upstream.callCount).toBe(callsAfterMiss);
  });

  test("an expired cache entry is refetched", async () => {
    const { gateway, upstream, clock } = openGateway();

    await gateway.listPokemon(1);
    const callsAfterMiss = upstream.callCount;
    clock.advance(SEVEN_DAYS_MS);

    await gateway.listPokemon(1);

    expect(upstream.callCount).toBe(callsAfterMiss + 1);
  });

  test("an upstream failure returns the last stored body", async () => {
    const { gateway, upstream, clock } = openGateway();
    const first = await gateway.listPokemon(1);
    clock.advance(SEVEN_DAYS_MS);
    upstream.fail = true;

    const second = await gateway.listPokemon(1);

    expect(second).toEqual(first);
  });

  test("upstream failure with no stored body is a controlled error", async () => {
    const { gateway, upstream } = openGateway();
    upstream.fail = true;

    await expect(gateway.listPokemon(1)).rejects.toBeInstanceOf(
      CatalogueUnavailableError,
    );
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
  callCount = 0;
  fail = false;

  constructor(private readonly page: PokemonPage) {
    super();
  }

  listPokemon(): Promise<PokemonPage> {
    this.callCount += 1;
    if (this.fail) {
      return Promise.reject(new Error("upstream unavailable"));
    }
    return Promise.resolve(this.page);
  }
}
