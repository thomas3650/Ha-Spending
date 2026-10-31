# Testing

The gates are in [`CLAUDE.md`](../CLAUDE.md#commands) → *Commands*; CI runs the same. What a test may check is
`CLAUDE.md` hard rule 5. This doc covers testing beyond the gates: the fast loop, the image check and the Chrome
check ([technical spec](superpowers/specs/2026-10-30-technical-design.md) §7.3), and the
[integration tests](#integration-tests).

## Fast loop

Every PR. The server and the page on the Mac, with a fake Firefly III and nothing from Home Assistant.

1. `scripts/setup` once per clone, and after a dependency change.
2. `scripts/develop`. Claude starts it with the Bash tool's `run_in_background`; it stays in the foreground until it is
   stopped. It starts, each in the background with its log and pidfile in `local/`:
   - the fake Firefly III (`addon/dev`) on port 8091 with generated data (log `local/fake.log`). Set
     `FAKE_FIREFLY_FAULT` to `refused`, `error` or `slow` before `scripts/develop` to see the error states;
   - the server (`npm run dev` in `addon/server`, which restarts on a change) on port 8099, with `HA_SPENDING_DEV=1`,
     so the ingress check is off, `HA_SPENDING_OPTIONS` set to `addon/dev/options.json`, which points at the fake, and
     `HA_SPENDING_WEB_DIR` unset, so it serves no page at `/`: the default web
     directory `/opt/ha-spending/web` does not exist on the Mac (log `local/server.log`);
   - Vite's dev server with the page on `http://127.0.0.1:5173`, which passes `/api` to the server (log
     `local/web.log`).

   It waits until the fake and both others answer, and stops with an error naming the log when one does not.
3. Check: `curl -s http://127.0.0.1:5173/api/health` gives the health JSON, and `curl -s http://127.0.0.1:5173/`
   holds `<hs-app>`. `curl -s 'http://127.0.0.1:5173/api/data?start=2026-01-01&end=2026-01-31'` gives the postings
   of the made-up data.
4. Open `http://127.0.0.1:5173/` for the [Chrome check](#chrome-check).
5. `scripts/develop stop` (from another shell) stops all three and waits until 8091, 8099 and 5173 are free.

To wait for the loop from a script, as `scripts/develop` does:
`curl -sf -o /dev/null --retry 30 --retry-delay 1 --retry-connrefused --retry-all-errors http://127.0.0.1:5173/`.

## Image check

For a change to `addon/Dockerfile`, `addon/config.yaml` or what the image holds. It runs the image as the add-on
would, on the Mac.

1. `docker build -t ha-spending:dev addon`.
2. `docker run --name hs ha-spending:dev` without options exits 1, and `docker logs hs` names `/data/options.json`,
   `firefly_url` and `firefly_token`. Then `docker rm hs`.
3. With options and the ingress check on, `docker run -d --rm -p 8099:8099 -e HA_SPENDING_OPTIONS=/opt/options.json
   -v "$PWD/addon/dev/options.json:/opt/options.json:ro" --name hs ha-spending:dev`:
   `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/` gives `403` (the peer is not ingress), and
   `docker exec hs node -v` gives `v24.…`. Then `docker stop hs`.
4. The same with `-e HA_SPENDING_DEV=1`, which binds `127.0.0.1` inside the container:
   `docker exec hs wget -qO- http://127.0.0.1:8099/api/health` gives the health JSON with the version in
   `addon/config.yaml`. The fake is not reachable from the container, so the server logs that Firefly III is
   unreachable. That is harmless. Then `docker stop hs`.

## Integration tests

For a change to the Firefly III client, the mapping or the options. `scripts/integration` starts a real Firefly III
from `addon/dev/firefly/compose.yaml`, makes a user and a token in it, seeds it with the example data, runs the
server's integration tests against it and removes it, also on failure. Docker must run. It listens on port 8090;
`FIREFLY_PORT` changes that. The token lives only in the run's environment and is never written or printed. CI runs the
script as the `integration` job ([`releasing.md`](releasing.md#the-workflows)). The design is technical spec §7.2
([technical spec](superpowers/specs/2026-10-30-technical-design.md)); the token script is
[D17](decisions.md).

## Chrome check

For every UI change, in the fast loop:

- A new Chrome tab at `http://127.0.0.1:5173/`. The window is **1440×960**, the mockups' size
  ([mockups](mockups/README.md)).
- Compare each screen and state the change touches with its mockup in the
  [UI spec](superpowers/specs/2026-10-30-ui-ux-design.md).
- No errors in the console.
- Screenshots go in `screenshots/<YYYY-MM-DD>-<topic>/` in the repo root. The folder is git-ignored. The PR
  description lists the screens checked and the folder. Screenshots show made-up data only, never the real Firefly III.
