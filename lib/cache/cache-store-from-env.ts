import { CacheStore } from "@/lib/cache/cache-store";
import { RedisCacheStore } from "@/lib/cache/redis-cache-store";
import { VercelKvCacheStore } from "@/lib/cache/vercel-kv-cache-store";

export type CacheBackend = "redis" | "vercel-kv";

export type CacheEnv = {
  CACHE_BACKEND?: string;
  REDIS_URL?: string;
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
};

const DEFAULT_REDIS_URL = "redis://localhost:6379";

export function resolveCacheBackend(env: CacheEnv): CacheBackend {
  const value = env.CACHE_BACKEND ?? "redis";
  if (value === "redis" || value === "vercel-kv") return value;
  throw new Error('CACHE_BACKEND must be "redis" or "vercel-kv".');
}

export function cacheStoreFromEnv(env: CacheEnv): CacheStore {
  const backend = resolveCacheBackend(env);
  if (backend === "vercel-kv") {
    const url = env.KV_REST_API_URL;
    const token = env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error(
        "KV_REST_API_URL and KV_REST_API_TOKEN are required when CACHE_BACKEND=vercel-kv.",
      );
    }
    return new VercelKvCacheStore(url, token);
  }
  return new RedisCacheStore(env.REDIS_URL ?? DEFAULT_REDIS_URL);
}
