import { CacheStore, type CacheRecord } from "@/lib/cache/cache-store";

export class MemoryCacheStore extends CacheStore {
  private readonly records = new Map<string, CacheRecord>();

  async get(key: string): Promise<CacheRecord | null> {
    const record = this.records.get(key);
    return record ? structuredClone(record) : null;
  }

  async set(key: string, record: CacheRecord): Promise<void> {
    this.records.set(key, structuredClone(record));
  }

  get size(): number {
    return this.records.size;
  }
}
