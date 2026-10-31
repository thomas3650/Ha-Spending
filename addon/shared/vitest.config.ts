import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // A far-off zone with summer time, so a date that depends on the machine's zone fails.
    env: { TZ: "Pacific/Auckland" },
  },
});
