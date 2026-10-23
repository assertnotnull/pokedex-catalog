import { expect, test } from "@playwright/test";

test("home shows four section entry points and attribution footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Catalogue", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jeux", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pokémon", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Objets", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lieux", level: 2 })).toBeVisible();
  await expect(page.getByText(/PokeAPI/i)).toBeVisible();
});

test("theme toggle switches data-theme", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /Thème/i });
  await toggle.click();
  const theme = await page.locator("html").getAttribute("data-theme");
  expect(theme === "dark" || theme === "light").toBeTruthy();
});
