import { NextResponse } from "next/server";
import { CatalogueUnavailableError } from "@/lib/catalogue/errors";
import { getCatalogueGateway } from "@/lib/catalogue/server";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const results = await getCatalogueGateway().search(query);
    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof CatalogueUnavailableError) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    throw error;
  }
}
