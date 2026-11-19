import { getCatalogueGateway } from "@/src/catalogue/composition";
import { searchCatalogue } from "@/src/catalogue/search-http";

export function GET(request: Request): Promise<Response> {
  return searchCatalogue(request, getCatalogueGateway());
}
