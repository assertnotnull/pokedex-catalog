import { pokeApiFixture } from "../../src/catalogue/visitor-fixtures";

const MARKER = "__pokedexCatalogueFixtures";

type FixtureGlobal = typeof globalThis & { [MARKER]?: boolean };

/** Serves the fixed catalogue for pokeapi.co and refuses every other call to that host. */
export function installPokeApiFixtures(): void {
  if (process.env["CATALOGUE_FIXTURES"] !== "1") return;

  const scope = globalThis as FixtureGlobal;
  if (scope[MARKER]) return;
  scope[MARKER] = true;

  const upstream = globalThis.fetch.bind(globalThis);
  const fixtureFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = requestUrl(input);
    if (raw) {
      const fixture = pokeApiFixture(raw);
      if (fixture) {
        return Response.json(fixture.body, { status: fixture.status });
      }
      if (isPokeApi(raw)) {
        return Response.json(
          { message: `Blocked live PokeAPI request: ${raw}` },
          { status: 599 },
        );
      }
    }
    return upstream(input, init);
  };
  globalThis.fetch = fixtureFetch as typeof fetch;

  console.info("Catalogue fixtures installed; PokeAPI is not contacted");
}

function requestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return null;
}

function isPokeApi(raw: string): boolean {
  try {
    return new URL(raw).hostname === "pokeapi.co";
  } catch {
    return false;
  }
}
