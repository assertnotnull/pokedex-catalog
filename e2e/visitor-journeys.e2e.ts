import { expect, type Page, test } from "@playwright/test";
import { visitorFixtures } from "../src/catalogue/visitor-fixtures";

const upstreamHits = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const upstream: string[] = [];
  upstreamHits.set(page, upstream);
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("pokeapi.co") || url.includes("raw.githubusercontent.com/PokeAPI")) {
      upstream.push(url);
    }
  });
  await page.route(/pokeapi\.co|raw\.githubusercontent\.com\/PokeAPI/, (route) => route.abort());
});

test.afterEach(async ({ page }) => {
  expect(upstreamHits.get(page) ?? [], "the browser must not call PokeAPI").toEqual([]);
});

test("home shows the four sections, the footer, and the theme", async ({ page }) => {
  await page.goto("/");

  const main = page.getByRole("main");
  for (const section of [
    { href: "/jeux", name: "Jeux" },
    { href: "/pokemon", name: "Pokémon" },
    { href: "/objets", name: "Objets" },
    { href: "/lieux", name: "Lieux" },
  ]) {
    const tile = main.locator(`a[href="${section.href}"]`);
    await expect(tile).toBeVisible();
    await expect(tile).toContainText(section.name);
  }

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "PokeAPI" })).toHaveAttribute(
    "href",
    "https://pokeapi.co/",
  );
  await expect(footer).toContainText("Projet de fan non commercial");

  await page.getByRole("button", { name: "Thème sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "zubat-dark");
  await expect(page.getByRole("button", { name: "Thème clair" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "zubat-dark");
  await page.getByRole("button", { name: "Thème clair" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "zubat");
});

test("a visitor paginates the Pokémon list and opens a detail", async ({ page }) => {
  await openPokemonList(page);
  await expect(page.getByRole("heading", { level: 1, name: "Pokémon" })).toBeVisible();
  await expect(page.getByRole("link", { name: visitorFixtures.firstName })).toBeVisible();
  await expect(page.getByText(visitorFixtures.typeName).first()).toBeVisible();

  await page.getByRole("link", { name: "Page suivante" }).click();
  await expect(page).toHaveURL("/pokemon?page=2");
  await expect(page.getByRole("link", { name: visitorFixtures.secondPageName })).toBeVisible();
  await expect(page.getByRole("link", { name: visitorFixtures.firstName })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "1" }).click();
  await expect(page).toHaveURL("/pokemon");
  await page.getByRole("link", { name: visitorFixtures.firstName }).click();

  await expect(page).toHaveURL(`/pokemon/${visitorFixtures.firstId}`);
  await expect(page.getByRole("heading", { level: 1, name: visitorFixtures.firstName })).toBeVisible();
  await expect(page.getByText(visitorFixtures.statName)).toBeVisible();
  await expect(page.getByText(String(visitorFixtures.statValue))).toBeVisible();
  await expect(page.getByText(visitorFixtures.abilityName)).toBeVisible();
  await expect(page.getByText(visitorFixtures.moveName)).toBeVisible();
  await expect(page.getByRole("link", { name: visitorFixtures.midEvolutionName })).toBeVisible();
  await expect(page.getByRole("link", { name: visitorFixtures.finalEvolutionName })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("PokeAPI");
});

test("a visitor opens a game hub and sees its filtered Pokémon list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").locator('a[href="/jeux"]').click();
  await expect(page).toHaveURL("/jeux");
  await page.getByRole("link", { name: visitorFixtures.gameName }).click();
  await expect(page).toHaveURL(`/jeux/${visitorFixtures.gameId}`);

  await page
    .getByRole("navigation", { name: "Contenu du jeu" })
    .getByRole("link", { name: "Pokémon" })
    .click();
  await expect(page).toHaveURL(`/jeux/${visitorFixtures.gameId}/pokemon`);
  await expect(page.getByRole("heading", { level: 1, name: visitorFixtures.gameName })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Pokémon" })).toBeVisible();
  await expect(page.getByRole("link", { name: visitorFixtures.firstName })).toBeVisible();
  await expect(page.getByRole("link", { name: visitorFixtures.midEvolutionName })).toBeVisible();
  await expect(page.getByRole("link", { name: visitorFixtures.secondPageName })).toHaveCount(0);
});

test("a visitor searches for a Pokémon by its French name", async ({ page }) => {
  await openPokemonList(page);
  const search = page.getByRole("search");
  await search.getByRole("searchbox", { name: "Recherche" }).fill(visitorFixtures.firstName);
  const hit = search.getByRole("link", { name: visitorFixtures.firstName });
  await expect(hit).toHaveAttribute("href", `/pokemon/${visitorFixtures.firstId}`);
  await hit.click();
  await expect(page).toHaveURL(`/pokemon/${visitorFixtures.firstId}`);
  await expect(page.getByRole("heading", { level: 1, name: visitorFixtures.firstName })).toBeVisible();
});

async function openPokemonList(page: Page) {
  await page.goto("/");
  await page.getByRole("main").locator('a[href="/pokemon"]').click();
  await expect(page).toHaveURL("/pokemon");
}
