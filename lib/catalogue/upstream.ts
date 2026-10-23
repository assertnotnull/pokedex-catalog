import { UpstreamNotFoundError, UpstreamRequestError } from "@/lib/catalogue/errors";

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";

export abstract class UpstreamClient {
  abstract getJson(path: string): Promise<unknown>;
}

export class PokeApiUpstream extends UpstreamClient {
  async getJson(path: string): Promise<unknown> {
    const url = `${POKEAPI_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "fetch failed";
      throw new UpstreamRequestError(`${path} (${message})`, null);
    }
    if (response.status === 404) throw new UpstreamNotFoundError(path);
    if (!response.ok) throw new UpstreamRequestError(path, response.status);
    return response.json() as Promise<unknown>;
  }
}
