import { describe, expect, test } from "bun:test";
import { cacheStoreFromEnv, resolveCacheBackend } from "@/lib/cache/cache-store-from-env";
import { RedisCacheStore } from "@/lib/cache/redis-cache-store";
import { VercelKvCacheStore } from "@/lib/cache/vercel-kv-cache-store";

describe("cache backend selection", () => {
  test("defaults to local Redis", () => {
    expect(resolveCacheBackend({})).toBe("redis");
    expect(cacheStoreFromEnv({})).toBeInstanceOf(RedisCacheStore);
    expect(cacheStoreFromEnv({ REDIS_URL: "redis://cache:6379" })).toBeInstanceOf(RedisCacheStore);
  });

  test("selects Vercel KV when CACHE_BACKEND=vercel-kv", () => {
    expect(resolveCacheBackend({ CACHE_BACKEND: "vercel-kv" })).toBe("vercel-kv");
    const store = cacheStoreFromEnv({
      CACHE_BACKEND: "vercel-kv",
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "token",
    });
    expect(store).toBeInstanceOf(VercelKvCacheStore);
  });

  test("rejects an unknown backend and a KV backend without credentials", () => {
    expect(() => resolveCacheBackend({ CACHE_BACKEND: "memory" })).toThrow(/CACHE_BACKEND/);
    expect(() => cacheStoreFromEnv({ CACHE_BACKEND: "vercel-kv" })).toThrow(/KV_REST_API_URL/);
  });
});
