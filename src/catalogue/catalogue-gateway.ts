import { inject, injectable } from "@needle-di/core";
import { CacheStore } from "./cache-store";
import { Clock } from "./clock";
import { CatalogueUnavailableError, UnknownItemError, UnknownPokemonError } from "./errors";
import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
  type EvolutionLink,
  type FlingEffectPayload,
  type ItemPayload,
  type LocalizedName,
  type MachinePayload,
  type PokemonPayload,
  type SpeciesPayload,
  type TypePayload,
  type VersionGroupPayload,
} from "./poke-api";

export const LIST_PAGE_SIZE = 24;
export const POKEMON_PAGE_SIZE = LIST_PAGE_SIZE;
const FRESH_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export type PokemonListEntry = {
  nationalNumber: number;
  frenchName: string;
  spriteUrl: string | null;
  types: string[];
};

export type PokemonListPage = {
  total: number;
  entries: PokemonListEntry[];
};

export type ItemListEntry = {
  id: number;
  frenchName: string;
  spriteUrl: string | null;
  category: string;
};

export type ItemListPage = {
  total: number;
  entries: ItemListEntry[];
};

export type PokemonDetail = {
  nationalNumber: number;
  frenchName: string;
  spriteUrl: string | null;
  types: string[];
  stats: { name: string; value: number }[];
  abilities: { name: string; isHidden: boolean }[];
  moves: { name: string }[];
  evolutions: { nationalNumber: number; frenchName: string }[];
};

export type ItemPrice = {
  versions: string;
  purchasePrice: number | null;
  sellPrice: number | null;
};

export type VersionedText = {
  versions: string;
  text: string;
};

export type ItemMachine = {
  versions: string;
  move: string;
};

export type ItemHolder = {
  nationalNumber: number;
  frenchName: string;
  versions: string[];
};

export type ItemDetail = {
  id: number;
  frenchName: string;
  spriteUrl: string | null;
  category: string;
  prices: ItemPrice[];
  effect: string | null;
  flavorTexts: VersionedText[];
  flingPower: number | null;
  flingEffect: string | null;
  attributes: string[];
  machines: ItemMachine[];
  heldBy: ItemHolder[];
};

@injectable()
export class CatalogueGateway {
  constructor(
    private readonly cache = inject(CacheStore),
    private readonly upstream = inject(PokeApi),
    private readonly clock = inject(Clock),
  ) {}

  async listItems(page: number): Promise<ItemListPage> {
    const offset = (page - 1) * LIST_PAGE_SIZE;
    const list = await this.load(`item-list:${LIST_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listItems(offset, LIST_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.itemListEntry(idFromUrl(result.url))),
    );
    return { total: list.count, entries };
  }

  async getItem(id: number): Promise<ItemDetail> {
    const item = await this.itemOrNotFound(id);
    const [category, attributes, heldBy, prices, flavorTexts, machines, flingEffect] =
      await Promise.all([
        this.described(`item-category`, item.category.url, (categoryId) =>
          this.upstream.getItemCategory(categoryId),
        ),
        Promise.all(
          item.attributes.map((attribute) =>
            this.described(`item-attribute`, attribute.url, (attributeId) =>
              this.upstream.getItemAttribute(attributeId),
            ),
          ),
        ),
        Promise.all(
          item.held_by_pokemon.map(async (held) => {
            const nationalNumber = idFromUrl(held.pokemon.url);
            const pokemon = await this.load<PokemonPayload>(`pokemon:${nationalNumber}`, () =>
              this.upstream.getPokemon(nationalNumber),
            );
            const species = await this.species(pokemon);
            const versions = await Promise.all(
              (held.version_details ?? []).map((detail) => this.versionName(detail.version.url)),
            );
            return { nationalNumber, frenchName: localizedName(species.names), versions };
          }),
        ),
        this.itemPrices(item),
        this.itemFlavorTexts(item),
        this.itemMachines(item),
        this.itemFlingEffect(item),
      ]);

    return {
      id: item.id,
      frenchName: localizedName(item.names),
      spriteUrl: item.sprites.default,
      category: localizedName(category.names),
      prices,
      effect: localizedEffect(item.effect_entries),
      flavorTexts,
      flingPower: item.fling_power ?? null,
      flingEffect,
      attributes: attributes.map((attribute) => localizedName(attribute.names)),
      machines,
      heldBy,
    };
  }

  async listPokemon(page: number): Promise<PokemonListPage> {
    const offset = (page - 1) * POKEMON_PAGE_SIZE;
    const list = await this.load(`pokemon-list:${POKEMON_PAGE_SIZE}:${offset}`, () =>
      this.upstream.listPokemon(offset, POKEMON_PAGE_SIZE),
    );
    const entries = await Promise.all(
      list.results.map((result) => this.listEntry(idFromUrl(result.url))),
    );
    return { total: list.count, entries };
  }

  async getPokemon(id: number): Promise<PokemonDetail> {
    const pokemon = await this.pokemonOrNotFound(id);
    const species = await this.species(pokemon);
    const chainUrl = species.evolution_chain?.url;
    let speciesRefs: EvolutionLink["species"][] = [];
    if (chainUrl) {
      const chainId = idFromUrl(chainUrl);
      const chain = await this.load<EvolutionChainPayload>(`evolution-chain:${chainId}`, () =>
        this.upstream.getEvolutionChain(chainId),
      );
      speciesRefs = flattenEvolution(chain.chain);
    }

    const [types, stats, abilities, moves, evolutions] = await Promise.all([
      this.frenchTypes(pokemon),
      Promise.all(
        pokemon.stats.map(async (stat) => {
          const described = await this.described(`stat`, stat.stat.url, (statId) =>
            this.upstream.getStat(statId),
          );
          return { name: localizedName(described.names), value: stat.base_stat };
        }),
      ),
      Promise.all(
        pokemon.abilities.map(async (ability) => {
          const described = await this.described(`ability`, ability.ability.url, (abilityId) =>
            this.upstream.getAbility(abilityId),
          );
          return { name: localizedName(described.names), isHidden: ability.is_hidden };
        }),
      ),
      Promise.all(
        pokemon.moves.map(async (move) => {
          const described = await this.described(`move`, move.move.url, (moveId) =>
            this.upstream.getMove(moveId),
          );
          return { name: localizedName(described.names) };
        }),
      ),
      Promise.all(
        speciesRefs.map(async (speciesRef) => {
          const evolutionId = idFromUrl(speciesRef.url);
          const evolution = await this.load<SpeciesPayload>(`species:${evolutionId}`, () =>
            this.upstream.getSpecies(evolutionId),
          );
          return {
            nationalNumber: evolutionId,
            frenchName: localizedName(evolution.names),
          };
        }),
      ),
    ]);

    return {
      nationalNumber: pokemon.id,
      frenchName: localizedName(species.names),
      spriteUrl: pokemon.sprites.front_default,
      types,
      stats,
      abilities,
      moves,
      evolutions,
    };
  }

  private async itemPrices(item: ItemPayload): Promise<ItemPrice[]> {
    const prices = await Promise.all(
      item.prices.map(async (price) => ({
        versions: price.version_group ? await this.versionGroupLabel(price.version_group.url) : "",
        purchasePrice: typeof price.purchase_price === "number" ? price.purchase_price : null,
        sellPrice: typeof price.sell_price === "number" ? price.sell_price : null,
      })),
    );
    return prices.filter((price) => price.purchasePrice !== null || price.sellPrice !== null);
  }

  private async itemFlavorTexts(item: ItemPayload): Promise<VersionedText[]> {
    const byGroup = new Map<string, ItemPayload["flavor_text_entries"]>();
    for (const entry of item.flavor_text_entries) {
      const key = entry.version_group?.url ?? "";
      const group = byGroup.get(key) ?? [];
      group.push(entry);
      byGroup.set(key, group);
    }

    const texts: VersionedText[] = [];
    for (const [url, entries] of byGroup) {
      const text = localizedProse(entries, "text");
      if (!text) {
        continue;
      }
      texts.push({ versions: url ? await this.versionGroupLabel(url) : "", text });
    }
    return texts;
  }

  private async itemMachines(item: ItemPayload): Promise<ItemMachine[]> {
    return Promise.all(
      (item.machines ?? []).map(async (row) => {
        const machineId = idFromUrl(row.machine.url);
        const machine = await this.load<MachinePayload>(`machine:${machineId}`, () =>
          this.upstream.getMachine(machineId),
        );
        const move = await this.described(`move`, machine.move.url, (moveId) =>
          this.upstream.getMove(moveId),
        );
        return {
          versions: await this.versionGroupLabel(row.version_group.url),
          move: localizedName(move.names),
        };
      }),
    );
  }

  private async itemFlingEffect(item: ItemPayload): Promise<string | null> {
    if (!item.fling_effect) {
      return null;
    }
    const effectId = idFromUrl(item.fling_effect.url);
    const effect = await this.load<FlingEffectPayload>(`item-fling-effect:${effectId}`, () =>
      this.upstream.getItemFlingEffect(effectId),
    );
    return localizedProse(
      effect.effect_entries.map((entry) => ({ text: entry.effect, language: entry.language })),
      "text",
    );
  }

  private async versionGroupLabel(url: string): Promise<string> {
    const groupId = idFromUrl(url);
    const group = await this.load<VersionGroupPayload>(`version-group:${groupId}`, () =>
      this.upstream.getVersionGroup(groupId),
    );
    const names = await Promise.all(group.versions.map((version) => this.versionName(version.url)));
    return names.join(" / ");
  }

  private async versionName(url: string): Promise<string> {
    const version = await this.described(`version`, url, (versionId) =>
      this.upstream.getVersion(versionId),
    );
    return localizedName(version.names);
  }

  private async itemListEntry(id: number): Promise<ItemListEntry> {
    const item = await this.load<ItemPayload>(`item:${id}`, () => this.upstream.getItem(id));
    const category = await this.described(`item-category`, item.category.url, (categoryId) =>
      this.upstream.getItemCategory(categoryId),
    );
    return {
      id: item.id,
      frenchName: localizedName(item.names),
      spriteUrl: item.sprites.default,
      category: localizedName(category.names),
    };
  }

  private async listEntry(id: number): Promise<PokemonListEntry> {
    const pokemon = await this.load<PokemonPayload>(`pokemon:${id}`, () =>
      this.upstream.getPokemon(id),
    );
    const species = await this.species(pokemon);
    return {
      nationalNumber: pokemon.id,
      frenchName: localizedName(species.names),
      spriteUrl: pokemon.sprites.front_default,
      types: await this.frenchTypes(pokemon),
    };
  }

  private async itemOrNotFound(id: number): Promise<ItemPayload> {
    try {
      return await this.load(`item:${id}`, () => this.upstream.getItem(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownItemError(id);
      }
      throw error;
    }
  }

  private async pokemonOrNotFound(id: number): Promise<PokemonPayload> {
    try {
      return await this.load(`pokemon:${id}`, () => this.upstream.getPokemon(id));
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw new UnknownPokemonError(id);
      }
      throw error;
    }
  }

  private species(pokemon: PokemonPayload): Promise<SpeciesPayload> {
    const speciesId = idFromUrl(pokemon.species.url);
    return this.load(`species:${speciesId}`, () => this.upstream.getSpecies(speciesId));
  }

  private frenchTypes(pokemon: PokemonPayload): Promise<string[]> {
    return Promise.all(
      [...pokemon.types]
        .sort((left, right) => left.slot - right.slot)
        .map(async (slot) => {
          const typeId = idFromUrl(slot.type.url);
          const type = await this.load<TypePayload>(`type:${typeId}`, () =>
            this.upstream.getType(typeId),
          );
          return localizedName(type.names);
        }),
    );
  }

  private described(
    kind: string,
    url: string,
    fetchBody: (id: number) => Promise<DescribedPayload>,
  ): Promise<DescribedPayload> {
    const id = idFromUrl(url);
    return this.load(`${kind}:${id}`, () => fetchBody(id));
  }

  private async load<T>(key: string, fetchBody: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached && this.clock.now() - cached.storedAt < FRESH_FOR_MS) {
      return cached.body as T;
    }

    try {
      const body = await fetchBody();
      await this.cache.set(key, body, this.clock.now());
      return body;
    } catch (error) {
      if (error instanceof UpstreamNotFound) {
        throw error;
      }
      if (cached) {
        return cached.body as T;
      }
      throw new CatalogueUnavailableError();
    }
  }
}

function localizedEffect(
  entries: { effect?: string; short_effect?: string; language: { name: string } }[],
): string | null {
  const full = localizedProse(
    entries.map((entry) => ({ text: entry.effect, language: entry.language })),
    "text",
  );
  if (full) {
    return full;
  }
  return localizedProse(entries, "short_effect");
}

function localizedProse(
  entries: { short_effect?: string; text?: string; language: { name: string } }[],
  field: "short_effect" | "text",
): string | null {
  const french = entries.find((entry) => entry.language.name === "fr");
  const english = entries.find((entry) => entry.language.name === "en");
  const raw = (french ?? english)?.[field];
  if (!raw) {
    return null;
  }
  const cleaned = raw.replace(/[\n\f]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function localizedName(names: LocalizedName[]): string {
  const french = names.find((entry) => entry.language.name === "fr");
  if (french) {
    return french.name;
  }
  const english = names.find((entry) => entry.language.name === "en");
  if (english) {
    return english.name;
  }
  throw new Error("No French or English name");
}

function flattenEvolution(link: EvolutionLink): EvolutionLink["species"][] {
  return [link.species, ...link.evolves_to.flatMap((next) => flattenEvolution(next))];
}

function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  if (!match) {
    throw new Error(`No id in ${url}`);
  }
  return Number(match[1]);
}
