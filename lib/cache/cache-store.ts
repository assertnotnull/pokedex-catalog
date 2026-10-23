export type CacheRecord = {
  body: unknown;
  storedAt: number;
};

export function isCacheRecord(value: unknown): value is CacheRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<CacheRecord>;
  return typeof record.storedAt === "number" && "body" in record;
}

/**
 * Persistence for catalogue payloads. Freshness is decided by the gateway
 * from `storedAt` (seven days). Entries stay readable after that so a failed
 * upstream call can still serve the last payload.
 */
export abstract class CacheStore {
  abstract get(key: string): Promise<CacheRecord | null>;
  abstract set(key: string, record: CacheRecord): Promise<void>;
}
