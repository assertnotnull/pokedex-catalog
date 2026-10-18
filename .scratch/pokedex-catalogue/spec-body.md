## Problem Statement

Visitors who want Pokémon reference material currently have no dedicated site in this project: the app is an empty Next.js starter. They need a **public catalogue** (no sign-in) in **French** that lets them browse **Games**, **Pokémon**, **Items**, and **Locations**, drill into **detail views**, filter by **Game** hubs, and **search** by name—without relying on a slow or fragile live link to the upstream API on every page view.

## Solution

Ship a DaisyUI-based **app shell** (navbar, theme toggle, footer with attribution) around a French-localized catalogue. **Home** shows four section tiles only. Each **Section** offers paginated **list views** (tile grids, 24 per page) and **detail views** with related data when available. **Games** act as **hubs** with sub-routes for filtered Pokémon, items, and locations. **Regions** group **locations** hierarchically. All upstream data is fetched **live on the server** behind a **Redis / Vercel KV** cache (7-day TTL, stale fallback). **Server Components** load data; a small **search** HTTP endpoint powers navbar lookup via cached name indexes.

## User Stories

1. As a **Visitor**, I want to open the site without creating an account, so that I can browse reference material immediately.
2. As a **Visitor**, I want the interface in French, so that I can read labels and names in my language.
3. As a **Visitor**, I want Pokémon, item, location, and game names in French when the data source provides them, so that names match what I know from the games.
4. As a **Visitor**, I want a clear main menu with four **Sections** (Jeux, Pokémon, Objets, Lieux), so that I know where to go for each kind of information.
5. As a **Visitor**, I want the home page to show only the four section entry points, so that I am not distracted by promotional content.
6. As a **Visitor**, I want URL paths to use French segments, so that links are readable and shareable in French.
7. As a **Visitor**, I want a consistent navbar on every page, so that I can jump between **Sections** without returning home.
8. As a **Visitor**, I want a footer with PokeAPI credit and a fan-project disclaimer, so that attribution and legal context are visible.
9. As a **Visitor**, I want a light visual theme with a red accent evoking a Pokédex, so that the site feels on-brand without copying game UI.
10. As a **Visitor**, I want to toggle dark mode, so that I can browse comfortably at night.
11. As a **Visitor**, I want list pages to show entities as a grid of tiles, so that browsing feels visual and scannable.
12. As a **Visitor**, I want list pages paginated with 24 tiles per page, so that pages load predictably and I can jump to a page number.
13. As a **Visitor**, I want the Pokémon list to show sprite, national number, French name, and types per tile, so that I can identify species quickly.
14. As a **Visitor**, I want the items list to show icon (when available), French name, and category per tile, so that I can distinguish item kinds.
15. As a **Visitor**, I want the locations list to show French name and parent **region** per tile, so that I know where each place sits geographically.
16. As a **Visitor**, I want the games list to show artwork (when available), French name, and platform or generation label per tile, so that I can pick the right title.
17. As a **Visitor**, I want to open a Pokémon **detail view**, so that I can see stats, types, evolutions, moves, abilities, and other related data the source exposes.
18. As a **Visitor**, I want to open an item **detail view**, so that I can see full item information and related entities when linked.
19. As a **Visitor**, I want to open a location **detail view**, so that I can see encounter information when the source provides it.
20. As a **Visitor**, I want to open a game **detail view** or hub entry, so that I can see metadata about that title and navigate its filtered content.
21. As a **Visitor**, I want each **Game** hub to offer sub-navigation for Pokémon, items, and locations available in that version, so that I can research version-specific content.
22. As a **Visitor**, I want game-filtered lists to use the same tile grid and pagination rules as global lists, so that behaviour is consistent.
23. As a **Visitor**, I want to browse **regions** and then **locations** within a region, so that I can explore the world hierarchically.
24. As a **Visitor**, I want region and location pages to use French names, so that naming stays consistent with the rest of the catalogue.
25. As a **Visitor**, I want global **search** from the navbar, so that I can find a game, Pokémon, item, or location without browsing every list.
26. As a **Visitor**, I want search results grouped by entity kind with a sensible cap per kind, so that results stay readable.
27. As a **Visitor**, I want search to match French names, so that I can type what I remember from the games.
28. As a **Visitor**, I want search results to link to the correct **detail view**, so that I can go straight to the full reference.
29. As a **Visitor**, I want pages to load quickly on repeat visits, so that browsing many entries feels smooth (served from cache when warm).
30. As a **Visitor**, I want the site to remain usable when the upstream API is temporarily down, so that I can still see recently cached content when available.
31. As a **Visitor**, I want sprite and artwork images to display reliably, so that tiles and detail headers look complete.
32. As a **Visitor**, I want the layout to work on mobile and desktop, so that I can use the catalogue on any device.
33. As a **Visitor**, I want a clear message when an entity does not exist, so that broken links do not show confusing errors.
34. As a **Visitor**, I want links between related entities (e.g. evolution chain, held items, encounter tables), so that I can follow connections without returning to search.
35. As a **Visitor**, I want move, ability, berry, and other ancillary data to appear on relevant **detail views** rather than as extra main-menu **Sections**, so that the menu stays simple while depth remains available.
36. As a **Visitor**, I want the catalogue to eventually cover the full breadth of the upstream dataset, so that rare or later-generation entries are not arbitrarily excluded (populated lazily via cache).
37. As a **Visitor**, I want the first version to avoid loading enormous payloads on list screens, so that initial browsing stays lightweight even as coverage grows.
38. As a **Visitor**, I want stable numeric or canonical identifiers in URLs where appropriate, so that bookmarks and shared links keep working across name changes in translations.
39. As a **Visitor**, I want the browser never to call the upstream API directly, so that my client is not subject to third-party rate limits or CORS failures.
40. As a **Visitor**, I want no sign-in, profile, or saved favourites in v1, so that the experience stays read-only and simple.

## Implementation Decisions

- **Stack**: Next.js App Router (existing project), React Server Components for data-heavy pages, Client Components only for interactivity (theme toggle, search input behaviour), Tailwind CSS v4, DaisyUI for components and themes, Bun as package manager, deployment target Vercel with Vercel KV in production.
- **Domain language**: Use terms from `GLOSSARY.md` (**Visitor**, **Catalogue**, **Section**, **Game**, **List view**, **Detail view**, **Search**, **Region**, **Location**, etc.) in UI copy, tests, and module naming.
- **ADR 0001 — Caching**: Single Redis-compatible client; local Redis for development, Vercel KV in production. Cache key strategy per upstream resource URL or logical resource id. TTL seven days. On miss: fetch upstream, store, return. On upstream failure: return stale cached body if present; otherwise surface a controlled error state in the UI.
- **ADR 0002 — Data boundary**: Server Components and server-only modules are the default data path. One **catalogue gateway** module family exposes typed read operations for lists, details, hub filters, region/location trees, and cache/index maintenance. Route Handlers are reserved for browser-initiated **Search** (and similar JSON endpoints), implemented by calling the same gateway—not duplicate fetch logic.
- **Upstream integration**: PokeAPI as the sole external data source for v1. Map upstream payloads into catalogue-facing DTOs shaped for list tiles vs detail richness. French names via upstream `names` (or equivalent) with English fallback for missing translations.
- **Routing**: French URL segments for **Sections** and game hub sub-routes (`…/pokemon`, `…/objets`, `…/lieux` under a game). Home at root. Detail routes keyed by stable upstream ids.
- **UI shell**: DaisyUI navbar with links to four **Sections**, embedded **Search**, theme toggle (`data-theme` light/dark). Home: four large section cards. Footer: PokeAPI attribution + non-commercial fan disclaimer in French.
- **List views**: DaisyUI cards in a responsive grid; pagination controls (numbered pages, not infinite scroll). Shared list-pagination component behaviour across **Sections** and game hub lists.
- **Game hub**: Game landing with sub-nav to three filtered list routes; filters derived from version/game linkage in upstream data where available; empty states when linkage is missing.
- **Locations**: Region index → region detail listing child **locations** → location **detail view** with encounters when present.
- **Search v1**: Server endpoint accepting a query string; matches against in-cache **name indexes** per entity kind (built or refreshed when list resources are fetched). Prefix/substring matching on normalized French names; capped results per kind; JSON grouped response consumed by a client search UI.
- **Images**: Configure image optimization for upstream sprite/artwork hosts; use placeholders when assets are missing.
- **Environment configuration**: Separate connection settings for local Redis vs Vercel KV; document required env vars for deploy (no secrets in client bundles).
- **Lazy population**: No full prefetch job in v1; cache and indexes fill on demand. **List views** request minimal fields; **detail views** may trigger additional cached fetches for related resources.

## Testing Decisions

- **Principle**: Test observable behaviour at the highest stable seam, not internal cache key strings or framework lifecycle details. Prefer contract tests on the **catalogue gateway** (inputs → DTO outputs, cache hit/miss/stale scenarios with mocked Redis and mocked upstream HTTP) over testing individual page files.
- **Primary seam (target: one)**: The **catalogue gateway** — the server-only API that all Server Components and the search Route Handler use. Unit/integration tests inject fake Redis and fake upstream responses to assert: cache miss populates store; TTL respected; stale served on upstream error; list DTOs contain only v1 list fields; French name resolution and fallback; game hub filters; search index updates and query matching.
- **Secondary seam (narrow)**: HTTP contract tests for the **Search** endpoint (status codes, grouped JSON shape, caps, empty query behaviour) using the gateway with test doubles.
- **End-to-end**: Playwright (or Next-recommended E2E) for a small set of **Visitor** journeys: home four tiles, navigate to a list, paginate, open a detail, toggle theme, submit search, footer visible. Run against a test server with gateway wired to fixtures or recorded upstream mocks—not live PokeAPI in CI.
- **Prior art**: None yet (greenfield); establish gateway tests as the pattern for future catalogue features.
- **Seam check**: If you expected multiple seams (e.g. per-Section modules or per-page tests), say so before `/to-tickets`; the spec assumes consolidation through the gateway.

## Out of Scope

- User accounts, registration, sessions, favourites, or personalisation.
- Build-time full ingestion or shipping a static snapshot of the entire upstream dataset in the repo.
- Cache warm-up cron, background workers, or admin tools to flush cache in v1.
- Dedicated top-level **Sections** for moves, abilities, berries, machines, etc. (they remain on **detail views** only).
- Full-text search engines (Elasticsearch, etc.); v1 uses cached name indexes only.
- Infinite-scroll lists.
- Locales beyond French for UI copy (English fallback for missing names only).
- Legal review beyond standard fan-project disclaimer text (copy is placeholder-quality until reviewed).
- Guaranteed completeness of version-exclusive linkages when upstream data is incomplete (show honest empty/partial states instead).
- Rate-limit UI for upstream abuse (rely on server-side cache; no Visitor-facing quota).

## Further Notes

- Grill session decisions are recorded in `GLOSSARY.md` and ADRs 0001–0002.
- Q12 follow-up: cache warming and “how lightweight” list/detail payloads are may be refined after v1 ships; this spec still requires lazy cache and thin list DTOs.
- Run `/setup-matt-pocock-skills` if `docs/agents/issue-tracker.md` is missing so later skills share triage vocabulary with the repo.
- Implementation tickets: GitHub sub-issues #2–#8 under parent #1 (see issue tracker).
