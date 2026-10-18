# Pokédex Catalogue

French, read-only catalogue of Pokémon data. Visitors browse without signing in. Lists and detail pages load through a server-side catalogue gateway. The gateway fetches [PokeAPI](https://pokeapi.co/) on a cache miss, keeps each payload fresh for seven days, and serves the last cached payload when the upstream call fails.

## Requirements

- [Bun](https://bun.sh)
- Docker, for the local Redis cache

## Environment

Copy `.env.example` to `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `CACHE_BACKEND` | yes | `redis` for local development, `vercel-kv` in production. Defaults to `redis`. |
| `REDIS_URL` | when `CACHE_BACKEND=redis` | Redis connection URL. Defaults to `redis://localhost:6379`. |
| `KV_REST_API_URL` | when `CACHE_BACKEND=vercel-kv` | Vercel KV REST URL. |
| `KV_REST_API_TOKEN` | when `CACHE_BACKEND=vercel-kv` | Vercel KV REST token. |

Cache credentials stay on the server. The browser never calls PokeAPI.

## Local development

Start Redis, then the app:

```bash
docker compose up -d redis
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
bun test
bun run typecheck
bun run lint
```

## Production cache

Set `CACHE_BACKEND=vercel-kv` and provide `KV_REST_API_URL` and `KV_REST_API_TOKEN` from the Vercel KV store. Call sites use the injected cache store; they do not choose a client themselves.
