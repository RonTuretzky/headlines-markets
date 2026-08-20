import { defineConfig } from "@playwright/test";

// Records smooth videos of the core flows (converted to GIFs by scripts/make-gifs.sh).
// Reuses the e2e harness: its own anvil (8548) + vite (5198) on a fresh chain.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /record\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:5198",
    viewport: { width: 1200, height: 780 },
    deviceScaleFactor: 2,
    video: { mode: "on", size: { width: 1200, height: 780 } },
    launchOptions: { slowMo: 300 },
  },
  webServer: {
    command: "node scripts/sync-contracts.mjs && VITE_RPC_URL=http://localhost:8548 npx vite --port 5198 --strictPort",
    port: 5198,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
