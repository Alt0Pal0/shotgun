import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", ...devices["Pixel 7"], trace: "retain-on-failure", permissions: ["geolocation"] },
  webServer: { command: "pnpm dev", url: "http://localhost:3000/sign-in", reuseExistingServer: true, timeout: 120_000, env: { BACKEND_MODE: "local", NEXT_PUBLIC_GPS_SIMULATOR: "1" } },
});
