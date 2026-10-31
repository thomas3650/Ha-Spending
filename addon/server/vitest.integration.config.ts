import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test-integration/**/*.test.ts"],
    testTimeout: 60_000,
    // Seeding a fresh Firefly III takes some forty writes before the first test.
    hookTimeout: 120_000,
    env: { TZ: "UTC" },
  },
});
