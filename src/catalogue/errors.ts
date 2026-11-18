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

export class UnknownItemError extends Error {
  constructor(readonly id: number) {
    super(`Item ${id} was not found`);
    this.name = "UnknownItemError";
  }
}

export class MissingLocalizedNameError extends Error {
  constructor() {
    super("No French or English name");
    this.name = "MissingLocalizedNameError";
  }
}

export class UnknownGameError extends Error {
  constructor(readonly id: number) {
    super(`Game ${id} was not found`);
    this.name = "UnknownGameError";
  }
}
