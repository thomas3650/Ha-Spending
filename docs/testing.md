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
     so the ingress check is off, `HA_SPENDING_OPTIONS` set to `addon/dev/options.json`, which points at the fake (a
     value already set wins, so a copy of that file in `local/` can replace it), and `HA_SPENDING_WEB_DIR` unset, so it
     serves no page at `/`: the default web directory `/opt/ha-spending/web` does not exist on the Mac (log
     `local/server.log`);
   - Vite's dev server with the page on `http://127.0.0.1:5173`, which passes `/api` to the server (log
     `local/web.log`).

   It waits until the fake and both others answer, and stops with an error naming the log when one does not.
3. Check: `curl -s http://127.0.0.1:5173/api/health` gives the health JSON (the page itself calls `api/data`), and `curl -s http://127.0.0.1:5173/`
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
server's integration tests against it and removes it, also on failure. They also run the sorter's two tools against
it, so its search and its write, a shop's expense account included, are checked on a real Firefly III
([D30](decisions.md), [D32](decisions.md)). Docker must run. It listens on port 8090;
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

### The screens and states

The page's list. Every screenshot is at 1440×960 with the console free of errors, compared with the mockup named
(files in `docs/mockups/v2/`).

1. `01-alt-forbrug`: the opening view, with every main group in the circle, the eight largest in colour and the rest
   grey. Compare `1-alt-forbrug.png`.
2. `02-hover`: the mouse on a small group's name. The name has a light blue background, the line is blue and the piece
   is out.
3. `03-focus-piece`, `04-focus-bar`: Tab to a circle name, then to a bar. Each shows the highlight from the keyboard.
4. Clicks, each with a screenshot after it: `05-click-piece` (on a piece), `06-click-label` (on an ECharts label) and
   `07-click-bar` (on a bar). Each does what its button does.
5. `08-periode`, `09-gruppering`, `10-konti`: the three dropdowns open. Compare `1-alt-forbrug-period.png`,
   `1-alt-forbrug-grain.png` and `1-alt-forbrug-konti.png`. Load the page once with `#by=week` and check that the
   Gruppér pr. select shows Uge on the first render.
6. `11-uge`: Gruppér pr. Uge. The first bar is clipped and the last is light, with "i gang".
7. `12-denne-maaned`: Denne måned. The average reads "gns. … før".
8. `13-posteringer`: screen 1 on Posteringer.
9. `14-link`: a click on a posting opens a new tab at the fake's `/transactions/show/<id>`. `addon/dev/options.json`
   sets `firefly_link_url` to the fake, so the tab may show the fake's 404; the URL is what is checked.
10. `15-hovedgruppe`, `16-kategori-soejler`, `17-kategori-posteringer`: Mad, then a category with bars, then with
    postings. Compare `2-hovedgruppe*.png`.
11. `18-uden-hovedgruppe`: Uden hovedgruppe as a screen, with its categories and Uden kategori.
12. `19-alle-posteringer`, `20-stoerste-foerst`, `21-filter`, `22-ingen-match`: screen 3 with chips; sorted by size as a
    flat list; the "+ Filter" panel open; a search nothing matches (`da.noMatch`). Compare `3-posteringer.png`.
13. `23-soejle`, `24-soejle-kategori`: a click on a bar opens Posteringer for that month; press Forskel. A chosen month
    with Forskel at all spending, then in Mad with a category chosen, with both chips. Compare `4-soejle.png`.
14. `25-loading` (`FAKE_FIREFLY_FAULT=slow`), `26-refused` (`refused`), `27-unreachable` (`error`), `28-empty` (Vælg
    periode in 2020).
15. `29-ingen-regelgruppe`: `scripts/develop` with `HA_SPENDING_OPTIONS` pointing at a copy of `addon/dev/options.json`
    in `local/` whose `main_group_rule_group` names a group that does not exist. The page shows `da.noRuleGroup` once.
16. `30-1024`: the window at 1024×960 (four key numbers in a row). The frame is 1024 px or wider, so the
    halves sit side by side, equal ([D24](decisions.md)). The circle's names neither overlap nor are cut.
17. `31-900`: the window at 900×960. The halves stack, and the four key numbers sit two by two.
18. `32-420`: the window at 420×900. The circle's chart is narrower than 400 px, so Alt forbrug and Mad show their parts
    as a list under the ring, with no names beside it and no name broken inside a word, and the four key
    numbers stack ([D28](decisions.md)). Hover and Tab on a row bring its piece out; a click on a row chooses it, and
    the other rows fade.
19. Back: three clicks, then back three times returns to the opening view.
20. `33-posteringer-soeg`: screen 1 on Posteringer with a search typed. The search row, with "Vis alle" on its line,
    sits under the title; the count and the sum follow the search; the circle and the key numbers do not. Also at
    1728 and 420 px. Back after typing returns to the view before the first key.
21. `34-posteringer-ingen-match`: a search nothing matches on the overview: the summary at 0 and `da.noMatch`, with
    the search row still there.
22. `35-abonnementer`, `36-abonnementer-hovedgruppe`: the key number Faste udgifter om året pressed, so the card shows
    on Alt forbrug, then on a main group. Every status shows, the order is Ikke set, Steget, Forventes, Betalt, and the
    names link to the fake. Also at 1728 and 420 px, where the head wraps; compare `docs/mockups/v3/`.
