export class CatalogueUnavailableError extends Error {
  constructor() {
    super("Catalogue data is unavailable");
    this.name = "CatalogueUnavailableError";
  }
}

export class UnknownPokemonError extends Error {
  constructor(readonly nationalNumber: number) {
    super(`Pokémon ${nationalNumber} was not found`);
    this.name = "UnknownPokemonError";
  }
}
