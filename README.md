# Pokédex catalogue

French, read-only catalogue of Pokémon reference data. Pages load through a server-side catalogue gateway. The browser does not call PokeAPI.

## Prerequisites

- [Bun](https://bun.sh)
- Docker, for local Redis

## Local development

```bash
cp .env.example .env.local
docker compose up -d
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

`CACHE_BACKEND=redis` selects the local Redis adapter. The gateway is the only place that talks to Redis; call sites do not choose a backend.

## Tests

```bash
bun test
```

Gateway tests use an in-memory cache and a fake upstream. They do not need Redis.

## Environment

| Variable | Required when | Purpose |
| --- | --- | --- |
| `CACHE_BACKEND` | always | `redis` for local development, `vercel-kv` in production |
| `REDIS_URL` | `CACHE_BACKEND=redis` | Redis connection string, for example `redis://localhost:6379` |
| `KV_URL` | `CACHE_BACKEND=vercel-kv` | Vercel KV Redis protocol URL (`rediss://...`) |

Both backends use the same Redis client. The composition root picks the URL from `CACHE_BACKEND`. Do not put these values in client code.

## Production

On Vercel, set `CACHE_BACKEND=vercel-kv` and `KV_URL` to the KV store's Redis URL. No separate REST token is required.
