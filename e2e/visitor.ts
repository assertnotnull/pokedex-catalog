import { expect, test } from "@playwright/test";

test("a visitor browses the catalogue, searches, and opens a filtered game hub", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: /Les titres de la série/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Espèces, types et évolutions/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ce que l'on utilise dans les jeux/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Régions et endroits/ })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("PokeAPI");
  await expect(page.getByRole("contentinfo")).toContainText("Projet de fan non commercial");

  await page.getByRole("link", { name: /Espèces, types et évolutions/ }).click();
  await expect(page.getByRole("heading", { name: "Pokémon" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Évoli/ })).toBeVisible();

  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "2" }).click();
  await expect(page).toHaveURL(/\/pokemon\?page=2/);
  await expect(page.getByRole("link", { name: /Pokémon 25/ })).toBeVisible();
  await page.getByRole("link", { name: /Pokémon 25/ }).click();
  await expect(page.getByRole("heading", { name: "Pokémon 25" })).toBeVisible();

  await page.getByRole("button", { name: "Thème sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "zubat-dark");
  await expect(page.getByRole("button", { name: "Thème clair" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Recherche" }).fill("evoli");
  await page.getByRole("link", { name: "Évoli", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Évoli" })).toBeVisible();

  await page.goto("/jeux/1/pokemon");
  await expect(page.getByRole("heading", { level: 1, name: "Rouge" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Évoli/ })).toBeVisible();
  await expect(page.getByText("Cette page ne contient aucun Pokémon")).toHaveCount(0);
});
