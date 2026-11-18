import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "e2e",
  testMatch: "visitor.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...(process.env.CI ? {} : { channel: "chrome" }),
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bash -c 'bun run dev --hostname 127.0.0.1 --port ${port} || bun run dev --hostname 127.0.0.1 --port ${port}'`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CATALOGUE_UPSTREAM: "fixture",
    },
  },
});
