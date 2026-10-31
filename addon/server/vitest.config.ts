import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // UTC, unlike Firefly III's Copenhagen offsets, so a date read through the machine's zone fails.
    env: { TZ: "UTC" },
  },
});
