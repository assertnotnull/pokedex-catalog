import {
  PokeApi,
  UpstreamNotFound,
  type DescribedPayload,
  type EvolutionChainPayload,
  type GenerationPayload,
  type ItemPayload,
  type LocationAreaPayload,
  type LocationPayload,
  type PokedexPayload,
  type PokemonPage,
  type PokemonPayload,
  type RegionPayload,
  type SpeciesPayload,
  type TypePayload,
  type VersionGroupPayload,
  type VersionPayload,
} from "./poke-api";

const POKEMON_COUNT = 25;

function resource(kind: string, id: number) {
  return { name: `${kind}-${id}`, url: `https://pokeapi.co/api/v2/${kind}/${id}/` };
}

function frenchName(id: number): string {
  return id === 1 ? "Évoli" : `Pokémon ${id}`;
}

export class FixturePokeApi extends PokeApi {
  listPokemon(offset: number, limit: number): Promise<PokemonPage> {
    return Promise.resolve(this.page(POKEMON_COUNT, offset, limit, (id) => resource("pokemon", id)));
  }

  getPokemon(id: number): Promise<PokemonPayload> {
    this.knownPokemon(id);
    return Promise.resolve({
      id,
      sprites: { front_default: null },
      types: [],
      stats: [],
      abilities: [],
      moves: [],
      species: resource("pokemon-species", id),
    });
  }

  getSpecies(id: number): Promise<SpeciesPayload> {
    this.knownPokemon(id);
    return Promise.resolve({
      id,
      names: [
        { name: `Pokemon ${id}`, language: { name: "en" } },
        { name: frenchName(id), language: { name: "fr" } },
      ],
    });
  }

  getType(id: number): Promise<TypePayload> {
    return this.missing(`type ${id}`);
  }

  getEvolutionChain(id: number): Promise<EvolutionChainPayload> {
    return this.missing(`evolution chain ${id}`);
  }

  getAbility(id: number): Promise<DescribedPayload> {
    return this.missing(`ability ${id}`);
  }

  getMove(id: number): Promise<DescribedPayload> {
    return this.missing(`move ${id}`);
  }

  getStat(id: number): Promise<DescribedPayload> {
    return this.missing(`stat ${id}`);
  }

  listItems(offset: number, limit: number): Promise<PokemonPage> {
    return Promise.resolve(
      this.page(1, offset, limit, () => resource("item", 4)),
    );
  }

  getItem(id: number): Promise<ItemPayload> {
    if (id !== 4) {
      return this.missing(`item ${id}`);
    }
    return Promise.resolve({
      id,
      prices: [],
      sprites: { default: null },
      category: resource("item-category", 1),
      attributes: [],
      effect_entries: [],
      flavor_text_entries: [],
      names: [{ name: "Poké Ball", language: { name: "fr" } }],
      held_by_pokemon: [],
      game_indices: [{ generation: resource("generation", 1) }],
    });
  }

  getItemCategory(id: number): Promise<DescribedPayload> {
    if (id !== 1) {
      return this.missing(`item category ${id}`);
    }
    return Promise.resolve({
      id,
      names: [{ name: "Poké Balls", language: { name: "fr" } }],
    });
  }

  getItemAttribute(id: number): Promise<DescribedPayload> {
    return this.missing(`item attribute ${id}`);
  }

  listVersions(offset: number, limit: number): Promise<PokemonPage> {
    return Promise.resolve(this.page(1, offset, limit, () => resource("version", 1)));
  }

  getVersion(id: number): Promise<VersionPayload> {
    if (id !== 1) {
      return this.missing(`version ${id}`);
    }
    return Promise.resolve({
      id,
      names: [{ name: "Rouge", language: { name: "fr" } }],
      version_group: resource("version-group", 1),
    });
  }

  getVersionGroup(id: number): Promise<VersionGroupPayload> {
    if (id !== 1) {
      return this.missing(`version group ${id}`);
    }
    return Promise.resolve({
      id,
      generation: resource("generation", 1),
      regions: [resource("region", 1)],
      pokedexes: [resource("pokedex", 2)],
    });
  }

  getGeneration(id: number): Promise<GenerationPayload> {
    if (id !== 1) {
      return this.missing(`generation ${id}`);
    }
    return Promise.resolve({
      id,
      names: [{ name: "1re Génération", language: { name: "fr" } }],
    });
  }

  listRegions(offset: number, limit: number): Promise<PokemonPage> {
    return Promise.resolve(this.page(1, offset, limit, () => resource("region", 1)));
  }

  getRegion(id: number): Promise<RegionPayload> {
    if (id !== 1) {
      return this.missing(`region ${id}`);
    }
    return Promise.resolve({
      id,
      names: [{ name: "Kanto", language: { name: "fr" } }],
      locations: [resource("location", 1)],
    });
  }

  getLocation(id: number): Promise<LocationPayload> {
    if (id !== 1) {
      return this.missing(`location ${id}`);
    }
    return Promise.resolve({
      id,
      names: [{ name: "Bourg Palette", language: { name: "fr" } }],
      region: resource("region", 1),
      areas: [],
    });
  }

  getLocationArea(id: number): Promise<LocationAreaPayload> {
    return this.missing(`location area ${id}`);
  }

  getEncounterMethod(id: number): Promise<DescribedPayload> {
    return this.missing(`encounter method ${id}`);
  }

  getPokedex(id: number): Promise<PokedexPayload> {
    if (id !== 2) {
      return this.missing(`pokedex ${id}`);
    }
    return Promise.resolve({
      id,
      pokemon_entries: [
        { entry_number: 1, pokemon_species: resource("pokemon-species", 1) },
      ],
    });
  }

  private knownPokemon(id: number) {
    if (id < 1 || id > POKEMON_COUNT) {
      throw new UpstreamNotFound(`pokemon ${id}`);
    }
  }

  private page(
    count: number,
    offset: number,
    limit: number,
    at: (id: number) => { name: string; url: string },
  ): PokemonPage {
    const results = [];
    for (let index = offset; index < Math.min(count, offset + limit); index += 1) {
      results.push(at(index + 1));
    }
    return { count, results };
  }

  private missing(resourceName: string): Promise<never> {
    return Promise.reject(new UpstreamNotFound(resourceName));
  }
}
