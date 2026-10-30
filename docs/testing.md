# Testing

The gates are in [`CLAUDE.md`](../CLAUDE.md#commands) → *Commands*; CI runs the same. What a test may check is
`CLAUDE.md` hard rule 5. This doc covers testing beyond the gates: the fast loop, the image check and the Chrome
check ([technical spec](superpowers/specs/2026-10-30-technical-design.md) §7.3).

## Fast loop

Every PR. The server and the page on the Mac, with nothing from Home Assistant.

1. `scripts/setup` once per clone, and after a dependency change.
2. `scripts/develop`. Claude starts it with the Bash tool's `run_in_background`; it stays in the foreground until it is
   stopped. It starts, each in the background with its log and pidfile in `local/`:
   - the server (`npm run dev` in `addon/server`, which restarts on a change) on port 8099, with `HA_SPENDING_DEV=1`,
     so the ingress check is off, and `HA_SPENDING_WEB_DIR` unset, so it serves no page at `/`: the default web
     directory `/opt/ha-spending/web` does not exist on the Mac (log `local/server.log`);
   - Vite's dev server with the page on `http://127.0.0.1:5173`, which passes `/api` to the server (log
     `local/web.log`).

   It waits until both answer, and stops with an error naming the log when one does not.
3. Check: `curl -s http://127.0.0.1:5173/api/health` gives the health JSON, and `curl -s http://127.0.0.1:5173/`
   holds `<hs-app>`.
4. Open `http://127.0.0.1:5173/` for the [Chrome check](#chrome-check).
5. `scripts/develop stop` (from another shell) stops both and waits until 8099 and 5173 are free.

To wait for the loop from a script, as `scripts/develop` does:
`curl -sf -o /dev/null --retry 30 --retry-delay 1 --retry-connrefused --retry-all-errors http://127.0.0.1:5173/`.

## Image check

For a change to `addon/Dockerfile`, `addon/config.yaml` or what the image holds. It runs the image as the add-on
would, on the Mac.

1. `docker build -t ha-spending:dev addon`.
2. `docker run -d --rm -p 8099:8099 --name hs ha-spending:dev`:
   `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/` gives `403` (the peer is not ingress), and
   `docker exec hs node -v` gives `v24.…`. Then `docker stop hs`.
3. `docker run -d --rm -p 8099:8099 -e HA_SPENDING_DEV=1 --name hs ha-spending:dev`:
   `curl -s http://127.0.0.1:8099/api/health` gives the health JSON with the version in `addon/config.yaml`, and
   `curl -s http://127.0.0.1:8099/` holds `<hs-app>`. Then `docker stop hs`.

## Chrome check

For every UI change, in the fast loop:

- A new Chrome tab at `http://127.0.0.1:5173/`. The window is **1440×960**, the mockups' size
  ([mockups](mockups/README.md)).
- Compare each screen and state the change touches with its mockup in the
  [UI spec](superpowers/specs/2026-10-30-ui-ux-design.md).
- No errors in the console.
- Screenshots go in `screenshots/<YYYY-MM-DD>-<topic>/` in the repo root. The folder is git-ignored. The PR
  description lists the screens checked and the folder. Screenshots show made-up data only, never the real Firefly III.
