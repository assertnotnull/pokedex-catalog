import "server-only";
import { Container } from "@needle-di/core";
import { CacheStore } from "./cache-store";
import { CatalogueGateway } from "./catalogue-gateway";
import { Clock, SystemClock } from "./clock";
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
  container.bind({ provide: Clock, useValue: new SystemClock() });
  return container.get(CatalogueGateway);
}

function cacheStoreFromEnv(): CacheStore {
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
