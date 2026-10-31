## Parent

Part of #1

## What to build

A **Visitor** can use the full **Catalogue** chrome: DaisyUI **app shell** (navbar with links to all four **Sections**, theme toggle, responsive layout), French **home** with only the four section tiles, and footer with PokeAPI credit and fan disclaimer. Data loads only through the **catalogue gateway** (live upstream fetch, 7-day TTL, stale payload when upstream fails) per ADR 0001–0002. **Server Components** render routes; client pieces limited to interactivity.

**Cache and dependency injection**

- **Local development**: Redis runs in **Docker** (e.g. Compose service); document how to start it with the app.
- **Production**: **Vercel KV** when deployed.
- **Backend selection**: a single **environment variable** chooses the cache implementation (local Redis vs Vercel KV); no duplicate cache clients in call sites.
- **Needle-DI**: use **`@needle-di/core`** to wire the **catalogue gateway** (API service layer). The cache store is **injected** into that service so tests can substitute an in-memory or fake cache and exercise **API-level behaviour directly** (upstream + cache + DTO mapping) without going through HTTP or React.

Deliver the first complete **Section**: **Pokémon** **List view** at the French Pokémon route (paginated tile grid, 24 per page, sprite / number / French name / types) and **Detail view** (rich related data from the source on the detail page, ancillary types on detail only). Shared list grid and pagination behaviour, sensible not-found for missing ids, image handling for sprites. Document required env vars (cache backend, Redis URL, KV credentials). Contract tests on the **catalogue gateway** seam via DI (cache miss/hit, TTL, stale on error, French name resolution, list DTO shape).

## Acceptance criteria

- [ ] **Visitor** sees French shell, home four tiles, footer, light/dark toggle without signing in
- [ ] **Pokémon** list and detail work end-to-end through gateway + cache
- [ ] Local Redis is provided via **Docker**; README or dev docs explain starting Redis + app
- [ ] Cache backend is selected by **env var** (Redis vs Vercel KV)
- [ ] **Needle-DI** injects cache into the catalogue gateway; tests resolve the service with a test double cache and assert API behaviour without browser/Route Handler
- [ ] Gateway contract tests cover cache and French list DTO behaviour
- [ ] No browser calls to upstream API directly

## Blocked by

None (can start immediately)
