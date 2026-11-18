const ROOT = "https://pokeapi.co/api/v2";

/** Fixed catalogue the visitor journeys assert against. Names are not live PokeAPI copy. */
export const visitorFixtures = {
  total: 25,
  firstId: 1,
  firstName: "Brunelle",
  secondPageId: 25,
  secondPageName: "Sentinelle",
  midEvolutionName: "Herbelle",
  finalEvolutionName: "Florielle",
  typeName: "Type d'essai",
  statName: "Endurance d'essai",
  abilityName: "Talent d'essai",
  moveName: "Capacité d'essai",
  statValue: 45,
} as const;

type Named = { name: string; url: string };

type FixtureResponse = { status: number; body: unknown };

function frenchName(id: number): string {
  if (id === visitorFixtures.firstId) return visitorFixtures.firstName;
  if (id === 2) return visitorFixtures.midEvolutionName;
  if (id === 3) return visitorFixtures.finalEvolutionName;
  if (id === visitorFixtures.secondPageId) return visitorFixtures.secondPageName;
  return `Espèce ${id}`;
}

function resource(kind: string, id: number): Named {
  return { name: `${kind}-${id}`, url: `${ROOT}/${kind}/${id}/` };
}

function names(french: string): { name: string; language: { name: string } }[] {
  return [
    { name: french, language: { name: "fr" } },
    { name: french, language: { name: "en" } },
  ];
}

/**
 * Fixed PokeAPI payload for a catalogue URL.
 * Returns null when the URL is not PokeAPI. Unknown PokeAPI paths are 404 so the
 * server never falls through to the network.
 */
export function pokeApiFixture(rawUrl: string): FixtureResponse | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.hostname !== "pokeapi.co") return null;

  const path = url.pathname.replace(/^\/api\/v2\//, "").replace(/\/$/, "");
  const [kind, idPart] = path.split("/");
  if (!kind) return missing(path);
  if (!idPart) return listFixture(kind, url.searchParams);

  const id = Number(idPart);
  if (!Number.isInteger(id) || id < 1) return missing(path);
  const body = entityFixture(kind, id);
  if (!body) return missing(path);
  return { status: 200, body };
}

function missing(path: string): FixtureResponse {
  return { status: 404, body: { message: `No catalogue fixture for ${path}` } };
}

function listFixture(kind: string, params: URLSearchParams): FixtureResponse {
  if (kind !== "pokemon") return missing(kind);
  const offset = numberParam(params.get("offset"), 0);
  const limit = numberParam(params.get("limit"), 24);
  const results: Named[] = [];
  const last = Math.min(visitorFixtures.total, offset + limit);
  for (let id = offset + 1; id <= last; id += 1) {
    results.push({ name: frenchName(id).toLowerCase(), url: `${ROOT}/pokemon/${id}/` });
  }
  return { status: 200, body: { count: visitorFixtures.total, results } };
}

function numberParam(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  return Number(value);
}

function entityFixture(kind: string, id: number): unknown {
  switch (kind) {
    case "pokemon":
      return pokemon(id);
    case "pokemon-species":
      return species(id);
    case "type":
      return id === 1 ? { id, names: names(visitorFixtures.typeName) } : undefined;
    case "stat":
      return id === 1 ? { id, names: names(visitorFixtures.statName) } : undefined;
    case "ability":
      return id === 1 ? { id, names: names(visitorFixtures.abilityName) } : undefined;
    case "move":
      return id === 1 ? { id, names: names(visitorFixtures.moveName) } : undefined;
    case "evolution-chain":
      return id === 1 ? evolutionChain() : undefined;
    default:
      return undefined;
  }
}

function pokemon(id: number): unknown {
  if (id > visitorFixtures.total) return undefined;
  return {
    id,
    sprites: { front_default: null },
    types: [{ slot: 1, type: resource("type", 1) }],
    stats: [{ base_stat: visitorFixtures.statValue, stat: resource("stat", 1) }],
    abilities: [{ is_hidden: false, ability: resource("ability", 1) }],
    moves: [{ move: resource("move", 1) }],
    species: resource("pokemon-species", id),
  };
}

function species(id: number): unknown {
  if (id > visitorFixtures.total) return undefined;
  return {
    id,
    names: names(frenchName(id)),
    ...(id <= 3 ? { evolution_chain: { url: `${ROOT}/evolution-chain/1/` } } : {}),
  };
}

function evolutionChain(): unknown {
  return {
    id: 1,
    chain: link(1, [link(2, [link(3, [])])]),
  };
}

function link(id: number, evolvesTo: unknown[]): unknown {
  return {
    species: resource("pokemon-species", id),
    evolves_to: evolvesTo,
  };
}
