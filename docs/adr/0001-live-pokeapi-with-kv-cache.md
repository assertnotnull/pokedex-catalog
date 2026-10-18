# Live PokeAPI with Redis / Vercel KV cache

Visitors see up-to-date catalogue data without a build-time snapshot. All upstream reads go through the **catalogue gateway**, which persists responses in a **cache store** selected at runtime by **environment variable**: **Redis** (local development, run via **Docker**) or **Vercel KV** (production on Vercel). Both backends use one Redis-compatible client abstraction; call sites do not branch on environment. The cache implementation is **injected** into the gateway with **`@needle-di/core`** so tests can substitute an in-memory or fake store and assert gateway behaviour (upstream fetch, TTL, stale fallback, DTO mapping) without HTTP or React.

On cache miss the gateway fetches PokeAPI, stores the payload with a **7-day TTL**, and returns it. If PokeAPI is unavailable, return the last cached payload when present (stale-while-revalidate); otherwise surface a controlled error in the UI.

## History

| Date | Change |
|------|--------|
| **Initial** | Chose live PokeAPI with server-side cache instead of build-time ingestion: Redis locally, Vercel KV in production, 7-day TTL, stale-while-revalidate. Rationale: operational flexibility on Vercel and lazy population aligned with a lightweight first UI. |
| **2026-10-18** | Clarified local Redis runs in **Docker** (documented dev workflow). Backend choice is explicit via **env var** (Redis vs Vercel KV). Added **`@needle-di/core`** so the cache store is injected at the **catalogue gateway** for direct service-level tests. Recorded on implementation ticket #2. |
