import "server-only";
import type { Container } from "@needle-di/core";
import { cacheStoreFromEnv } from "@/lib/cache/cache-store-from-env";
import { CatalogueGateway } from "@/lib/catalogue/gateway";
import { createCatalogueContainer } from "@/lib/catalogue/container";
import { PokeApiUpstream } from "@/lib/catalogue/upstream";

const globalStore = globalThis as unknown as { catalogueContainer?: Container };

export function getCatalogueGateway(): CatalogueGateway {
  if (!globalStore.catalogueContainer) {
    globalStore.catalogueContainer = createCatalogueContainer({
      cache: cacheStoreFromEnv({
        CACHE_BACKEND: process.env.CACHE_BACKEND,
        REDIS_URL: process.env.REDIS_URL,
        KV_REST_API_URL: process.env.KV_REST_API_URL,
        KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
      }),
      upstream: new PokeApiUpstream(),
    });
  }
  return globalStore.catalogueContainer.get(CatalogueGateway);
}
