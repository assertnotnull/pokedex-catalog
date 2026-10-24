import { createClient } from "redis";
import { CacheStore, type StoredPayload } from "./cache-store";

type RedisClient = ReturnType<typeof createClient>;

/**
 * Redis-protocol cache used for local Redis and for Vercel KV.
 * The body is stored without an expiry so a stale payload remains readable
 * after the gateway's freshness window.
 */
export class RedisCacheStore extends CacheStore {
  private client: RedisClient | null = null;

  constructor(private readonly url: string) {
    super();
  }

  async get(key: string): Promise<StoredPayload | null> {
    const raw = await (await this.redis()).get(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as StoredPayload;
  }

  async set(key: string, body: unknown, storedAt: number): Promise<void> {
    await (await this.redis()).set(key, JSON.stringify({ body, storedAt }));
  }

  private async redis(): Promise<RedisClient> {
    if (this.client?.isOpen) {
      return this.client;
    }
    const client = createClient({ url: this.url });
    client.on("error", (error) => {
      console.error("Redis client error", error);
    });
    await client.connect();
    this.client = client;
    return client;
  }
}
