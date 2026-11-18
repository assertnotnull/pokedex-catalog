import { getCatalogueGateway } from "@/src/catalogue/composition";
import { searchResponse } from "@/src/catalogue/search-response";

export async function GET(request: Request): Promise<Response> {
  const gateway = getCatalogueGateway();
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query !== "") {
    await gateway.warmSearchIndexes();
  }
  return searchResponse(request, gateway);
}
