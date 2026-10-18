import Redis from "ioredis";
import { CacheStore, isCacheRecord, type CacheRecord } from "@/lib/cache/cache-store";

export class RedisCacheStore extends CacheStore {
  private client: Redis | null = null;

  constructor(private readonly url: string) {
    super();
  }

  private redis(): Redis {
    if (!this.client) {
      this.client = new Redis(this.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
        enableOfflineQueue: false,
      });
      this.client.on("error", (error: Error) => {
        console.error("Redis cache error", error.message);
      });
    }
    return this.client;
  }

  async get(key: string): Promise<CacheRecord | null> {
    const raw = await this.redis().get(key);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isCacheRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async set(key: string, record: CacheRecord): Promise<void> {
    await this.redis().set(key, JSON.stringify(record));
  }
}
