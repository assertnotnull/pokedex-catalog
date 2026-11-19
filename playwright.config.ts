import { defineConfig, devices } from "@playwright/test";

const port = 3108;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Next may stop the first `build` in an agent session to show a security
    // upgrade reminder, then allow the same command to continue. One retry
    // keeps that reminder from failing the suite. A real build error fails both.
    command: `(bun run build || bun run build) && bun run start -- -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      CATALOGUE_FIXTURES: "1",
    },
  },
});
