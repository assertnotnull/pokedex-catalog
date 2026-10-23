import { describe, expect, test } from "bun:test";
import { MemoryCacheStore } from "@/lib/cache/memory-cache-store";
import { Clock } from "@/lib/catalogue/clock";
import { createCatalogueContainer } from "@/lib/catalogue/container";
import { CatalogueNotFoundError, UpstreamNotFoundError } from "@/lib/catalogue/errors";
import { CatalogueGateway } from "@/lib/catalogue/gateway";
import { UpstreamClient } from "@/lib/catalogue/upstream";

class ManualClock extends Clock {
  override now(): number {
    return 1_700_000_000_000;
  }
}

class FixtureUpstream extends UpstreamClient {
  readonly calls: string[] = [];

  async getJson(path: string): Promise<unknown> {
    this.calls.push(path);
    const body = route(path);
    if (body === undefined) throw new UpstreamNotFoundError(path);
    return structuredClone(body);
  }
}

function setup() {
  const cache = new MemoryCacheStore();
  const upstream = new FixtureUpstream();
  const clock = new ManualClock();
  const gateway = createCatalogueContainer({ cache, upstream, clock }).get(CatalogueGateway);
  return { cache, upstream, clock, gateway };
}

describe("region and location catalogue", () => {
  test("lists regions with French names and falls back to English, then the identifier", async () => {
    const { gateway, upstream } = setup();
    const regions = await gateway.listRegions();

    expect(upstream.calls[0]).toBe("/region?limit=100&offset=0");
    expect(regions).toEqual([
      { id: 1, name: "Kanto" },
      { id: 2, name: "Johto" },
      { id: 3, name: "hoenn" },
      { id: 4, name: "Kalos" },
    ]);
    for (const region of regions) {
      expect(Object.keys(region).sort()).toEqual(["id", "name"]);
    }
    expect(upstream.calls.some((path) => path.startsWith("/location"))).toBe(false);
  });

  test("lists a region's locations, 24 per page, with French name and region", async () => {
    const { gateway, upstream } = setup();
    const page = await gateway.listLocations(1, 1);

    expect(upstream.calls[0]).toBe("/region/1");
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(24);
    expect(page.total).toBe(25);
    expect(page.region).toEqual({ id: 1, name: "Kanto" });
    expect(page.items).toHaveLength(24);
    expect(page.items[0]).toEqual({ id: 1, name: "Céladopole", region: "Kanto" });
    expect(page.items[1]).toEqual({ id: 2, name: "Cerulean City", region: "Kanto" });
    expect(page.items[2]).toEqual({ id: 3, name: "lavender-town", region: "Kanto" });
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(["id", "name", "region"]);
    }
    expect(upstream.calls).not.toContain("/location/25");

    const second = await gateway.listLocations(1, 2);
    expect(second.items).toEqual([{ id: 25, name: "Bourg Palette", region: "Kanto" }]);
    expect(await gateway.listLocations(1, 0)).toMatchObject({ page: 1 });

    const english = await gateway.listLocations(2, 1);
    expect(english.region).toEqual({ id: 2, name: "Johto" });
    expect(english.items).toEqual([{ id: 100, name: "Canalave City", region: "Johto" }]);

    const identifier = await gateway.listLocations(3, 1);
    expect(identifier.region).toEqual({ id: 3, name: "hoenn" });
    expect(identifier.items).toEqual([{ id: 101, name: "oreburgh-gate", region: "hoenn" }]);
  });

  test("returns encounters on the location detail when the source provides them", async () => {
    const { gateway } = setup();
    const location = await gateway.getLocation(1, 1);

    expect(Object.keys(location).sort()).toEqual(["encounters", "id", "name", "region"]);
    expect(location.id).toBe(1);
    expect(location.name).toBe("Céladopole");
    expect(location.region).toEqual({ id: 1, name: "Kanto" });
    expect(location.encounters).toEqual([
      {
        zone: "Zone de Céladopole",
        pokemon: { id: 16, name: "Roucool" },
        version: "Rouge",
        method: "En marchant",
        minLevel: 2,
        maxLevel: 4,
        chance: 50,
      },
      {
        zone: "Zone de Céladopole",
        pokemon: { id: 19, name: "Rattata" },
        version: "Blue",
        method: "Surfing",
        minLevel: 5,
        maxLevel: 5,
        chance: 10,
      },
      {
        zone: "secret-garden",
        pokemon: { id: 20, name: "raticate" },
        version: "yellow",
        method: "headbutt",
        minLevel: 3,
        maxLevel: 6,
        chance: 20,
      },
    ]);
    expect(Object.keys(location.encounters[0] ?? {}).sort()).toEqual([
      "chance",
      "maxLevel",
      "method",
      "minLevel",
      "pokemon",
      "version",
      "zone",
    ]);
  });

  test("returns an empty encounter list when the location has none", async () => {
    const { gateway, upstream } = setup();
    const withoutAreas = await gateway.getLocation(1, 4);
    expect(withoutAreas.name).toBe("Safrania");
    expect(withoutAreas.encounters).toEqual([]);
    expect(upstream.calls.some((path) => path.startsWith("/location-area"))).toBe(false);

    const emptyArea = await gateway.getLocation(1, 5);
    expect(emptyArea.encounters).toEqual([]);

    const english = await gateway.getLocation(2, 100);
    expect(english).toEqual({
      id: 100,
      name: "Canalave City",
      region: { id: 2, name: "Johto" },
      encounters: [],
    });

    const identifier = await gateway.getLocation(3, 101);
    expect(identifier.name).toBe("oreburgh-gate");
    expect(identifier.region).toEqual({ id: 3, name: "hoenn" });
    expect(identifier.encounters).toEqual([]);
  });

  test("rejects a missing region or a location outside that region", async () => {
    const { gateway, upstream } = setup();
    await expect(gateway.listLocations(99, 1)).rejects.toBeInstanceOf(CatalogueNotFoundError);
    await expect(gateway.listLocations(0, 1)).rejects.toBeInstanceOf(CatalogueNotFoundError);
    await expect(gateway.getLocation(1, 100)).rejects.toBeInstanceOf(CatalogueNotFoundError);
    expect(upstream.calls).not.toContain("/location/100");
    await expect(gateway.getLocation(4, 999)).rejects.toBeInstanceOf(CatalogueNotFoundError);
    await expect(gateway.getLocation(1, 0)).rejects.toBeInstanceOf(CatalogueNotFoundError);
  });
});

function route(path: string): unknown | undefined {
  if (path === "/region?limit=100&offset=0") {
    return {
      count: 4,
      next: null,
      results: [1, 2, 3, 4].map(regionRef),
    };
  }
  if (path === "/region/1") return regionBody(1, "kanto", names("Kanto", "Kanto"), range(1, 25));
  if (path === "/region/2") return regionBody(2, "johto", names(undefined, "Johto"), [100]);
  if (path === "/region/3") return regionBody(3, "hoenn", [], [101]);
  if (path === "/region/4") return regionBody(4, "kalos", names("Kalos", "Kalos"), [999]);
  const location = locationBody(path);
  if (location) return location;
  const area = areaBody(path);
  if (area) return area;
  const pokemon = pokemonBody(path);
  if (pokemon) return pokemon;
  const species = speciesBody(path);
  if (species) return species;
  const version = versionBody(path);
  if (version) return version;
  const method = methodBody(path);
  if (method) return method;
  return undefined;
}

function regionRef(id: number) {
  return { name: `region-${id}`, url: `https://pokeapi.co/api/v2/region/${id}/` };
}

function regionBody(id: number, name: string, regionNames: ReturnType<typeof names>, locationIds: number[]) {
  return {
    id,
    name,
    names: regionNames,
    locations: locationIds.map((locationId) => ({
      name: `location-${locationId}`,
      url: `https://pokeapi.co/api/v2/location/${locationId}/`,
    })),
  };
}

function locationBody(path: string): unknown | undefined {
  const id = numberedPath(path, "/location/");
  if (id === null || id === 999) return undefined;
  if (id === 1) {
    return locationRecord(id, "celadon-city", names("Céladopole", "Celadon City"), [10, 11]);
  }
  if (id === 2) return locationRecord(id, "cerulean-city", names(undefined, "Cerulean City"), []);
  if (id === 3) return locationRecord(id, "lavender-town", [], []);
  if (id === 4) return locationRecord(id, "saffron-city", names("Safrania", "Saffron City"), []);
  if (id === 5) return locationRecord(id, "lavender-radio", names("Lavanville", "Lavender"), [50]);
  if (id === 25) return locationRecord(id, "pallet-town", names("Bourg Palette", "Pallet Town"), []);
  if (id === 100) return locationRecord(id, "canalave-city", names(undefined, "Canalave City"), []);
  if (id === 101) return locationRecord(id, "oreburgh-gate", [], []);
  if (id >= 6 && id <= 24) return locationRecord(id, `place-${id}`, names(`Lieu ${id}`, `Place ${id}`), []);
  return undefined;
}

function locationRecord(id: number, name: string, locationNames: ReturnType<typeof names>, areaIds: number[]) {
  return {
    id,
    name,
    names: locationNames,
    areas: areaIds.map((areaId) => ({
      name: `area-${areaId}`,
      url: `https://pokeapi.co/api/v2/location-area/${areaId}/`,
    })),
  };
}

function areaBody(path: string): unknown | undefined {
  const id = numberedPath(path, "/location-area/");
  if (id === 10) {
    return {
      id,
      name: "celadon-zone",
      names: names("Zone de Céladopole", "Celadon Zone"),
      pokemon_encounters: [
        encounter(16, "pidgey", 1, "red", 1, "walk", 2, 4, 50),
        encounter(19, "rattata", 2, "blue", 2, "surf", 5, 5, 10),
      ],
    };
  }
  if (id === 11) {
    return {
      id,
      name: "secret-garden",
      names: [],
      pokemon_encounters: [encounter(20, "raticate", 3, "yellow", 3, "headbutt", 3, 6, 20)],
    };
  }
  if (id === 50) return { id, name: "empty-area", names: [], pokemon_encounters: [] };
  return undefined;
}

function encounter(
  pokemonId: number,
  pokemonName: string,
  versionId: number,
  versionName: string,
  methodId: number,
  methodName: string,
  minLevel: number,
  maxLevel: number,
  chance: number,
) {
  return {
    pokemon: { name: pokemonName, url: `https://pokeapi.co/api/v2/pokemon/${pokemonId}/` },
    version_details: [
      {
        version: { name: versionName, url: `https://pokeapi.co/api/v2/version/${versionId}/` },
        max_chance: chance,
        encounter_details: [
          {
            min_level: minLevel,
            max_level: maxLevel,
            chance,
            method: { name: methodName, url: `https://pokeapi.co/api/v2/encounter-method/${methodId}/` },
          },
        ],
      },
    ],
  };
}

function pokemonBody(path: string): unknown | undefined {
  const id = numberedPath(path, "/pokemon/");
  if (id !== 16 && id !== 19 && id !== 20) return undefined;
  const name = id === 16 ? "pidgey" : id === 19 ? "rattata" : "raticate";
  return {
    id,
    name,
    height: 3,
    weight: 18,
    sprites: { front_default: null },
    types: [],
    abilities: [],
    stats: [],
    moves: [],
    species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
    held_items: [],
  };
}

function speciesBody(path: string): unknown | undefined {
  const id = numberedPath(path, "/pokemon-species/");
  if (id === 16) return { names: names("Roucool", "Pidgey") };
  if (id === 19) return { names: names(undefined, "Rattata") };
  if (id === 20) return { names: [] };
  return undefined;
}

function versionBody(path: string): unknown | undefined {
  const id = numberedPath(path, "/version/");
  if (id === 1) return { names: names("Rouge", "Red") };
  if (id === 2) return { names: names(undefined, "Blue") };
  if (id === 3) return { names: [] };
  return undefined;
}

function methodBody(path: string): unknown | undefined {
  const id = numberedPath(path, "/encounter-method/");
  if (id === 1) return { names: names("En marchant", "Walking") };
  if (id === 2) return { names: names(undefined, "Surfing") };
  if (id === 3) return { names: [] };
  return undefined;
}

function names(french: string | undefined, english: string) {
  const entries = [];
  if (french) entries.push({ name: french, language: { name: "fr" } });
  entries.push({ name: english, language: { name: "en" } });
  return entries;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function numberedPath(path: string, prefix: string): number | null {
  if (!path.startsWith(prefix)) return null;
  const id = Number(path.slice(prefix.length));
  if (!Number.isInteger(id)) return null;
  return id;
}
