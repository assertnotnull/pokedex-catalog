export class CatalogueNotFoundError extends Error {
  constructor(readonly resource: string) {
    super(`Ressource introuvable: ${resource}`);
    this.name = "CatalogueNotFoundError";
  }
}

export class CatalogueUnavailableError extends Error {
  constructor() {
    super("Catalogue indisponible");
    this.name = "CatalogueUnavailableError";
  }
}

export class UpstreamNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`Upstream 404 for ${path}`);
    this.name = "UpstreamNotFoundError";
  }
}

export class UpstreamRequestError extends Error {
  constructor(readonly path: string, readonly status: number | null) {
    super(`Upstream request failed for ${path}`);
    this.name = "UpstreamRequestError";
  }
}
