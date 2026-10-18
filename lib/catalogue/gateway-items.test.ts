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
    if (path === "/item?limit=24&offset=0") {
      return {
        count: 30,
        results: [
          { name: "master-ball", url: "https://pokeapi.co/api/v2/item/1/" },
          { name: "potion", url: "https://pokeapi.co/api/v2/item/2/" },
        ],
      };
    }
    if (path === "/item?limit=24&offset=24") {
      return {
        count: 30,
        results: [{ name: "bright-powder", url: "https://pokeapi.co/api/v2/item/3/" }],
      };
    }
    if (path === "/item/1") return itemFixture(1, "master-ball", "rich");
    if (path === "/item/2") return itemFixture(2, "potion", "english");
    if (path === "/item/3") return itemFixture(3, "bright-powder", "identifier");
    if (path === "/item-category/34") return { names: names("Balls standard", "Standard balls") };
    if (path === "/item-category/27") return { names: names("Soin", "Healing") };
    if (path === "/item-category/99") return { names: [] };
    if (path === "/item-attribute/5") return { names: names("Tenable", "Holdable") };
    if (path === "/item-fling-effect/3") {
      return {
        names: [],
        effect_entries: [{ effect: "Active immédiatement l’effet de la baie.", language: { name: "fr" } }],
      };
    }
    if (path === "/pokemon/143") {
      return {
        id: 143,
        name: "snorlax",
        sprites: { front_default: null },
        species: { name: "snorlax", url: "https://pokeapi.co/api/v2/pokemon-species/143/" },
      };
    }
    if (path === "/pokemon-species/143") return { names: names("Ronflex", "Snorlax") };
    if (path === "/machine/2") {
      return {
        id: 2,
        move: { name: "mega-punch", url: "https://pokeapi.co/api/v2/move/5/" },
        version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
      };
    }
    if (path === "/move/5") return { names: names("Méga-Poing", "Mega Punch") };
    if (path === "/version-group/1") return { names: [] };
    return undefined;
  }
}

function names(french: string | undefined, english: string) {
  const entries = [];
  if (french) entries.push({ name: french, language: { name: "fr" } });
  entries.push({ name: english, language: { name: "en" } });
  return entries;
}

function itemFixture(id: number, name: string, kind: "rich" | "english" | "identifier") {
  const french = kind === "rich" ? "Master Ball" : undefined;
  const english = kind === "identifier" ? undefined : kind === "rich" ? "Master Ball" : "Potion";
  return {
    id,
    name,
    names: kind === "identifier" || !english ? [] : names(french, english),
    sprites: { default: kind === "english" ? null : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png` },
    category:
      kind === "rich"
        ? { name: "standard-balls", url: "https://pokeapi.co/api/v2/item-category/34/" }
        : kind === "english"
          ? { name: "healing", url: "https://pokeapi.co/api/v2/item-category/27/" }
          : { name: "key-items", url: "https://pokeapi.co/api/v2/item-category/99/" },
    prices:
      kind === "rich"
        ? [
            {
              purchase_price: 200,
              sell_price: 100,
              currency: { name: "poke-dollar" },
              version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
            },
            {
              purchase_price: null,
              sell_price: 0,
              currency: { name: "poke-dollar" },
              version_group: { name: "sword-shield", url: "https://pokeapi.co/api/v2/version-group/20/" },
            },
          ]
        : [],
    effect_entries:
      kind === "rich"
        ? [{ short_effect: "Capture un Pokémon sauvage à chaque fois.", effect: "Long.", language: { name: "fr" } }]
        : [],
    flavor_text_entries:
      kind === "rich"
        ? [
            { text: "Ancienne description.", language: { name: "fr" } },
            { text: "La meilleure Ball.", language: { name: "fr" } },
          ]
        : [],
    attributes: kind === "rich" ? [{ name: "holdable", url: "https://pokeapi.co/api/v2/item-attribute/5/" }] : [],
    fling_power: kind === "english" ? 30 : null,
    fling_effect:
      kind === "english" ? { name: "berry-effect", url: "https://pokeapi.co/api/v2/item-fling-effect/3/" } : null,
    held_by_pokemon:
      kind === "rich"
        ? [{ pokemon: { name: "snorlax", url: "https://pokeapi.co/api/v2/pokemon/143/" } }]
        : [],
    machines:
      kind === "rich"
        ? [
            {
              machine: { url: "https://pokeapi.co/api/v2/machine/2/" },
              version_group: { name: "red-blue", url: "https://pokeapi.co/api/v2/version-group/1/" },
            },
          ]
        : [],
    baby_trigger_for: kind === "english" ? { url: "https://pokeapi.co/api/v2/evolution-chain/90/" } : null,
  };
}

function setup() {
  const cache = new MemoryCacheStore();
  const upstream = new FixtureUpstream();
  const clock = new ManualClock();
  const gateway = createCatalogueContainer({ cache, upstream, clock }).get(CatalogueGateway);
  return { cache, upstream, clock, gateway };
}

describe("catalogue gateway items", () => {
  test("list DTOs keep only the v1 tile fields and request 24 per page", async () => {
    const { gateway, upstream } = setup();
    const page = await gateway.listItems(1);

    expect(upstream.calls[0]).toBe("/item?limit=24&offset=0");
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(24);
    expect(page.total).toBe(30);
    expect(page.items).toEqual([
      {
        id: 1,
        name: "Master Ball",
        iconUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png",
        category: "Balls standard",
      },
      {
        id: 2,
        name: "Potion",
        iconUrl: null,
        category: "Soin",
      },
    ]);
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(["category", "iconUrl", "id", "name"]);
    }

    const second = await gateway.listItems(2);
    expect(upstream.calls).toContain("/item?limit=24&offset=24");
    expect(second.items).toEqual([
      {
        id: 3,
        name: "bright-powder",
        iconUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/bright-powder.png",
        category: "key-items",
      },
    ]);
    expect(await gateway.listItems(0)).toMatchObject({ page: 1, items: page.items });
  });

  test("resolves French item names and falls back to English, then the identifier", async () => {
    const { gateway } = setup();

    const french = await gateway.getItem(1);
    const english = await gateway.getItem(2);
    const identifier = await gateway.getItem(3);

    expect(french.name).toBe("Master Ball");
    expect(french.category).toBe("Balls standard");
    expect(french.effect).toBe("Capture un Pokémon sauvage à chaque fois.");
    expect(french.flavorText).toBe("La meilleure Ball.");
    expect(french.attributes).toEqual(["Tenable"]);
    expect(french.price).toEqual({ purchase: null, sell: 0 });
    expect(french.heldBy).toEqual([{ id: 143, name: "Ronflex" }]);
    expect(french.machines).toEqual([{ move: "Méga-Poing", versionGroup: "red-blue" }]);
    expect(french.triggersBabyEvolution).toBe(false);
    expect(english.name).toBe("Potion");
    expect(english.iconUrl).toBeNull();
    expect(english.price).toBeNull();
    expect(english.flingPower).toBe(30);
    expect(english.flingEffect).toBe("Active immédiatement l’effet de la baie.");
    expect(english.triggersBabyEvolution).toBe(true);
    expect(identifier.name).toBe("bright-powder");
    expect(identifier.category).toBe("key-items");
  });

  test("does not cache a missing item", async () => {
    const { gateway, cache } = setup();
    await expect(gateway.getItem(999)).rejects.toBeInstanceOf(CatalogueNotFoundError);
    expect(cache.size).toBe(0);
  });
});
