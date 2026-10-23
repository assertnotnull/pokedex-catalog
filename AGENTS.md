<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `assertnotnull/pokedex-catalog`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles map 1:1 to GitHub labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Cursor Cloud specific instructions

- Use Bun `1.4.3` (`packageManager` in `package.json`, lockfile `bun.lock`). Install with `bun install --frozen-lockfile`.
- Dev server: `bun run dev` (Next.js 16, port 3000). Lint: `bun run lint`. Production build: `bun run build`.
- Route types such as `LayoutProps` are generated under `.next`. Run `bun next typegen` before `bun x tsc --noEmit` when those types are missing.
- The current app does not need secrets or a local database. Redis / Vercel KV caching described in `docs/adr/0001-live-pokeapi-with-kv-cache.md` is not implemented in this tree.
