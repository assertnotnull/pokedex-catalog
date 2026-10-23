import Redis from "ioredis";
import { CacheStore, isCacheRecord, type CacheRecord } from "@/lib/cache/cache-store";

export class RedisCacheStore extends CacheStore {
  private client: Redis | null = null;
  private connecting: Promise<void> | null = null;

  constructor(private readonly url: string) {
    super();
  }

  private async redis(): Promise<Redis> {
    if (!this.client || this.client.status === "end") {
      this.client = new Redis(this.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
      });
      this.client.on("error", (error: Error) => {
        console.error("Redis cache error", error.message);
      });
      const client = this.client;
      this.connecting = client.connect().then(() => undefined).catch((error: unknown) => {
        client.disconnect();
        if (this.client === client) {
          this.client = null;
          this.connecting = null;
        }
        throw error;
      });
    }
    if (this.connecting) await this.connecting;
    if (!this.client || this.client.status !== "ready") {
      throw new Error("Redis is not ready");
    }
    return this.client;
  }

  async get(key: string): Promise<CacheRecord | null> {
    const raw = await (await this.redis()).get(key);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isCacheRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async set(key: string, record: CacheRecord): Promise<void> {
    await (await this.redis()).set(key, JSON.stringify(record));
  }
}
