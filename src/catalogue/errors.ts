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

export class UnknownRegionError extends Error {
  constructor(readonly id: number) {
    super(`Region ${id} was not found`);
    this.name = "UnknownRegionError";
  }
}

export class UnknownLocationError extends Error {
  constructor(readonly id: number) {
    super(`Location ${id} was not found`);
    this.name = "UnknownLocationError";
  }
}

export class UnknownGameError extends Error {
  constructor(readonly id: number) {
    super(`Game ${id} was not found`);
    this.name = "UnknownGameError";
  }
}

export class UnknownItemError extends Error {
  constructor(readonly id: number) {
    super(`Item ${id} was not found`);
    this.name = "UnknownItemError";
  }
}
