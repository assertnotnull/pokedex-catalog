# Server Components as the only public data boundary

Pages and layouts load catalogue data via **Next.js Server Components** (and shared server-only modules they call). Those modules perform PokeAPI fetches, read/write the KV cache, and shape props for the UI. Route Handlers exist only where the browser must call in (e.g. **Search** autocomplete), not as the default way to render lists and details. Client Components are limited to interactivity (theme toggle, search input). This keeps secrets and cache logic off the client and matches the App Router model.
