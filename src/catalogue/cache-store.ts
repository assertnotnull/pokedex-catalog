export type StoredPayload = {
  body: unknown;
  storedAt: number;
};

export abstract class CacheStore {
  abstract get(key: string): Promise<StoredPayload | null>;
  abstract set(key: string, body: unknown, storedAt: number): Promise<void>;
}

export class InMemoryCacheStore extends CacheStore {
  private readonly entries = new Map<string, StoredPayload>();

  async get(key: string): Promise<StoredPayload | null> {
    return this.entries.get(key) ?? null;
  }

  async set(key: string, body: unknown, storedAt: number): Promise<void> {
    this.entries.set(key, { body, storedAt });
  }

  storedBodies(): unknown[] {
    return [...this.entries.values()].map((entry) => entry.body);
  }
}
