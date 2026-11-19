export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env["CATALOGUE_FIXTURES"] !== "1") return;
  const { installPokeApiFixtures } = await import("./e2e/fixtures/install-pokeapi-fixtures");
  installPokeApiFixtures();
}
