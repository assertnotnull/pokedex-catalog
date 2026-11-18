import "server-only";
import { Container } from "@needle-di/core";
import { CacheStore, InMemoryCacheStore } from "./cache-store";
import { CatalogueGateway } from "./catalogue-gateway";
import { Clock, FixedClock, SystemClock } from "./clock";
import { PokeApi } from "./poke-api";
import { PokeApiClient } from "./poke-api-client";
import { RedisCacheStore } from "./redis-cache-store";

let gateway: CatalogueGateway | undefined;

export function getCatalogueGateway(): CatalogueGateway {
  gateway ??= createGateway();
  return gateway;
}

function createGateway(): CatalogueGateway {
  const container = new Container();
  container.bind({ provide: CacheStore, useValue: cacheStoreFromEnv() });
  container.bind({ provide: PokeApi, useValue: new PokeApiClient() });
  container.bind({ provide: Clock, useValue: clockFromEnv() });
  // Next's compiler does not keep the @injectable registration, so the
  // composition root binds the gateway explicitly. Tests still resolve it
  // through the decorator.
  container.bind({
    provide: CatalogueGateway,
    useFactory: (resolved) =>
      new CatalogueGateway(resolved.get(CacheStore), resolved.get(PokeApi), resolved.get(Clock)),
  });
  return container.get(CatalogueGateway);
}

function catalogueFixturesEnabled(): boolean {
  return process.env["CATALOGUE_FIXTURES"] === "1";
}

function clockFromEnv(): Clock {
  // A fixed clock lets the fixture server prerender without reading the current time.
  if (catalogueFixturesEnabled()) {
    return new FixedClock(1_700_000_000_000);
  }
  return new SystemClock();
}

function cacheStoreFromEnv(): CacheStore {
  // The visitor E2E server sets this so journeys never need Redis or a live upstream.
  if (catalogueFixturesEnabled()) {
    return new InMemoryCacheStore();
  }
  const backend = process.env.CACHE_BACKEND;
  if (backend === "redis") {
    return new RedisCacheStore(requiredEnv("REDIS_URL"));
  }
  if (backend === "vercel-kv") {
    return new RedisCacheStore(requiredEnv("KV_URL"));
  }
  throw new Error("CACHE_BACKEND must be redis or vercel-kv");
}

function requiredEnv(name: "REDIS_URL" | "KV_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when CACHE_BACKEND=${process.env.CACHE_BACKEND}`);
  }
  return value;
}
