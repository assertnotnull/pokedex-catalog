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
  constructor(readonly regionId: number) {
    super(`Region ${regionId} was not found`);
    this.name = "UnknownRegionError";
  }
}

export class UnknownLocationError extends Error {
  constructor(readonly locationId: number) {
    super(`Location ${locationId} was not found`);
    this.name = "UnknownLocationError";
  }
}
