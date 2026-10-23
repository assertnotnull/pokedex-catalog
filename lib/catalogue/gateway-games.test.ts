import { describe, expect, test } from "bun:test";
import { MemoryCacheStore } from "@/lib/cache/memory-cache-store";
import { Clock } from "@/lib/catalogue/clock";
import { createCatalogueContainer } from "@/lib/catalogue/container";
import { CatalogueNotFoundError, UpstreamNotFoundError } from "@/lib/catalogue/errors";
import { CatalogueGateway } from "@/lib/catalogue/gateway";
import { UpstreamClient } from "@/lib/catalogue/upstream";

class ManualClock extends Clock {
  current = 1_700_000_000_000;

  override now(): number {
    return this.current;
  }
}

class FixtureUpstream extends UpstreamClient {
  readonly calls: string[] = [];

  async getJson(path: string): Promise<unknown> {
    this.calls.push(path);
    const body = this.route(path);
    if (body === undefined) throw new UpstreamNotFoundError(path);
    return structuredClone(body);
  }

  private route(path: string): unknown | undefined {
    if (path === "/version?limit=24&offset=0") {
      return {
        count: 25,
        results: [
          { name: "red", url: "https://pokeapi.co/api/v2/version/1/" },
          { name: "blue", url: "https://pokeapi.co/api/v2/version/2/" },
        ],
      };
    }
    if (path === "/version?limit=24&offset=24") {
      return {
        count: 25,
        results: [{ name: "yellow", url: "https://pokeapi.co/api/v2/version/3/" }],
      };
    }
    if (path === "/version/1") return versionFixture(1, "red", "Rouge", "Red", 1);
    if (path === "/version/2") return versionFixture(2, "blue", undefined, "Blue", 1);
    if (path === "/version/3") return versionFixture(3, "yellow", undefined, undefined, 2);
    if (path === "/version-group/1") {
      return { generation: { name: "generation-i", url: "https://pokeapi.co/api/v2/generation/1/" } };
    }
    if (path === "/version-group/2") {
      return { generation: { name: "generation-ii", url: "https://pokeapi.co/api/v2/generation/2/" } };
    }
    if (path === "/generation/1") {
      return {
        name: "generation-i",
        names: names("1re Génération", "Generation I"),
      };
    }
    if (path === "/generation/2") return { name: "generation-ii", names: [] };
    return undefined;
  }
}

function names(french: string | undefined, english: string | undefined) {
  const entries = [];
  if (french) entries.push({ name: french, language: { name: "fr" } });
  if (english) entries.push({ name: english, language: { name: "en" } });
  return entries;
}

function versionFixture(
  id: number,
  identifier: string,
  french: string | undefined,
  english: string | undefined,
  versionGroupId: number,
) {
  return {
    id,
    name: identifier,
    names: names(french, english),
    version_group: {
      name: `group-${versionGroupId}`,
      url: `https://pokeapi.co/api/v2/version-group/${versionGroupId}/`,
    },
  };
}

function setup() {
  const cache = new MemoryCacheStore();
  const upstream = new FixtureUpstream();
  const clock = new ManualClock();
  const gateway = createCatalogueContainer({ cache, upstream, clock }).get(CatalogueGateway);
  return { cache, upstream, clock, gateway };
}

const TILE_KEYS = ["artworkUrl", "generationLabel", "id", "name"];

describe("game catalogue gateway", () => {
  test("list DTOs keep only the v1 tile fields and request 24 per page", async () => {
    const { gateway, upstream } = setup();
    const page = await gateway.listGames(1);

    expect(upstream.calls[0]).toBe("/version?limit=24&offset=0");
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(24);
    expect(page.total).toBe(25);
    expect(page.items).toEqual([
      { id: 1, name: "Rouge", artworkUrl: null, generationLabel: "1re Génération" },
      { id: 2, name: "Blue", artworkUrl: null, generationLabel: "1re Génération" },
    ]);
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(TILE_KEYS);
    }

    const second = await gateway.listGames(2);
    expect(upstream.calls).toContain("/version?limit=24&offset=24");
    expect(second.items).toEqual([
      { id: 3, name: "yellow", artworkUrl: null, generationLabel: "generation-ii" },
    ]);
    expect(await gateway.listGames(0)).toMatchObject({ page: 1, items: page.items });
  });

  test("resolves French game names and falls back to English, then the identifier", async () => {
    const { gateway } = setup();
    const french = await gateway.getGame(1);
    const english = await gateway.getGame(2);
    const identifier = await gateway.getGame(3);

    expect(french).toEqual({
      id: 1,
      name: "Rouge",
      artworkUrl: null,
      generationLabel: "1re Génération",
    });
    expect(english.name).toBe("Blue");
    expect(english.generationLabel).toBe("1re Génération");
    expect(identifier.name).toBe("yellow");
    expect(identifier.generationLabel).toBe("generation-ii");
    for (const game of [french, english, identifier]) {
      expect(Object.keys(game).sort()).toEqual(TILE_KEYS);
    }
  });

  test("does not cache a missing game", async () => {
    const { gateway, cache, upstream } = setup();
    await expect(gateway.getGame(999)).rejects.toBeInstanceOf(CatalogueNotFoundError);
    await expect(gateway.getGame(0)).rejects.toBeInstanceOf(CatalogueNotFoundError);
    expect(cache.size).toBe(0);
    expect(upstream.calls).toEqual(["/version/999"]);
  });
});
