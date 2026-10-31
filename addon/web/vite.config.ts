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
    // ECharts core and zrender are most of the one chunk; ingress serves it over the local network, and one chunk
    // keeps check-dist simple.
    chunkSizeWarningLimit: 700,
  },
  // The fast loop's server listens on 127.0.0.1 only, and `localhost` may resolve to `::1` first, so the proxy and
  // the fast loop's checks name 127.0.0.1.
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
