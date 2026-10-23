export class CatalogueUnavailableError extends Error {
  constructor() {
    super("Catalogue data is unavailable");
    this.name = "CatalogueUnavailableError";
  }
}
