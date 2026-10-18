import { createClient, type VercelKV } from "@vercel/kv";
import { CacheStore, isCacheRecord, type CacheRecord } from "@/lib/cache/cache-store";

export class VercelKvCacheStore extends CacheStore {
  private client: VercelKV | null = null;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {
    super();
  }

  private kv(): VercelKV {
    if (!this.client) {
      this.client = createClient({ url: this.url, token: this.token });
    }
    return this.client;
  }

  async get(key: string): Promise<CacheRecord | null> {
    const value: unknown = await this.kv().get(key);
    return isCacheRecord(value) ? value : null;
  }

  async set(key: string, record: CacheRecord): Promise<void> {
    await this.kv().set(key, record);
  }
}
