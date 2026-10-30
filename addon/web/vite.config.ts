import { defineConfig } from "vitest/config";

// The add-on serves `dist/index.html` at the page's root and `dist/web/*` at `web/`. Every URL is relative, so the
// page works under Ingress's changing prefix; `scripts/check-dist.mjs` checks that after each build.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "web",
    emptyOutDir: true,
    sourcemap: false,
  },
  // On macOS `localhost` resolves to `::1`; the proxy and the fast loop's checks use 127.0.0.1.
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8099" },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["test/setup.ts"],
    // One time zone for the tests, so a local date means the same on a Mac and in CI.
    env: { TZ: "Europe/Copenhagen" },
  },
});
