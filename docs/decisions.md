# Decisions

Lasting decisions, newest last. Each entry is short and points to where the reasoning is. Entries aren't edited, except
to set their status to `superseded by D<n>`, or to name a part a later decision superseded. How to add one:
[`way-of-working.md`](way-of-working.md) §5.

### D1: An add-on with its page in the side menu, TypeScript on both sides
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** HA Spending is a Home Assistant add-on whose page is in the side menu through ingress. The server and
  the page are both TypeScript.
- **Why:** Thomas wants the overview on the computer, in Home Assistant's side menu, with nothing to build himself;
  one language lets the server and the page share their types.
- **Source:** Thomas, [#1](https://github.com/thomas3650/Ha-Spending/issues/1);
  [technical spec](superpowers/specs/2026-10-30-technical-design.md) header

### D2: npm workspaces rooted in `addon/`
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** The code is npm workspaces (`shared`, `server`, `web`) rooted in `addon/`, with one
  `package-lock.json`.
- **Why:** They share one TypeScript version and import the types instead of copying them. The image is built from
  `addon/` alone, so the Dockerfile must see `shared/` and the lockfile.
- **Source:** [technical spec](superpowers/specs/2026-10-30-technical-design.md) §2

### D3: Hono on `@hono/node-server`
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** The add-on server is Hono on `@hono/node-server`.
- **Why:** Small and typed; it serves the API and the page's static files.
- **Source:** [technical spec](superpowers/specs/2026-10-30-technical-design.md) §5

### D4: `node:24-alpine` pinned by digest, the server bundled into one file
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** The image is `node:24-alpine`, pinned by digest, with the server bundled by esbuild into one file and
  the page's build beside it; no `node_modules` in the image. `init` is left at its default (true), so Docker's init
  passes signals to Node; with no s6-overlay the container's environment (`TZ`) reaches Node as it is. Node 24, not
  the spec's Node 22: the active LTS, and what Ha-Fitness builds with. Dependabot has no `docker` ecosystem here, so
  the digest is bumped by hand ([`releasing.md`](releasing.md#bumping-pins)).
- **Why:** One explicit Node version for build and run, and the smallest runtime.
- **Source:** Claude, [skeleton plan](superpowers/plans/2026-10-30-skeleton.md);
  [technical spec](superpowers/specs/2026-10-30-technical-design.md) §2, §5

### D5: Ingress only, by the peer address
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** The server answers only the peer address `172.30.32.2`, also in its IPv4-mapped IPv6 form
  `::ffff:172.30.32.2`; everything else gets 403. `HA_SPENDING_DEV=1` turns the check off, for the fast loop. The
  port is 8099, not published.
- **Why:** The page is reached through Home Assistant's ingress only, and Node reports the Supervisor's address in the
  mapped form behind a dual-stack listener.
- **Source:** [technical spec](superpowers/specs/2026-10-30-technical-design.md) §5;
  [skeleton plan](superpowers/plans/2026-10-30-skeleton.md), Review Focus

### D6: Git hooks as plain scripts, the tools through pinned `uvx`
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** The git hooks are plain scripts in `.githooks/`, set with `git config core.hooksPath .githooks` by
  `scripts/setup`. actionlint and zizmor run through pinned `uvx`; the link check is a Node script.
- **Why:** No Python toolchain in the repo, and the same tools as Ha-Fitness.
- **Source:** Claude, [skeleton plan](superpowers/plans/2026-10-30-skeleton.md)

### D7: `addon-image` asks GHCR with `GITHUB_TOKEN`
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** `addon-image` asks GHCR whether the version's image exists with `GITHUB_TOKEN` (`packages: read`),
  not anonymously. The version `0.0.0` is never built. That the package is public is checked by hand
  ([`releasing.md`](releasing.md#ghcr-visibility)).
- **Why:** With the token a package that does not exist yet reads as missing (404), so the first image builds;
  anonymously GHCR answers 403 for it (checked 2026-10-30).
- **Source:** Claude, [skeleton plan](superpowers/plans/2026-10-30-skeleton.md)

### D8: `panel_title: Forbrug` is Danish
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** `panel_title` in `addon/config.yaml` is the Danish "Forbrug".
- **Why:** The UI spec names the side-menu entry, and where the two specs meet the UI spec wins over the technical
  spec's English-only rule.
- **Source:** [UI spec](superpowers/specs/2026-10-30-ui-ux-design.md) §3.1;
  [technical spec](superpowers/specs/2026-10-30-technical-design.md) header and §2

### D9: One release component, `addon/`
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** release-please has one component, `addon/`, tagged `vX.Y.Z`; the first release is `0.1.0`.
- **Why:** The add-on is the only thing released; Ha-Fitness's workflows trimmed to one component.
- **Source:** [technical spec](superpowers/specs/2026-10-30-technical-design.md) §9

### D10: The page's state is in the frame's hash, for back only; a view cannot be bookmarked
- **Date:** 2026-10-30 · **Status:** active
- **Decision:** The page keeps its state ([UI spec](superpowers/specs/2026-10-30-ui-ux-design.md) §5) in its own
  frame's hash, so back works; a view cannot be bookmarked. This settles the open question of the
  [technical spec](superpowers/specs/2026-10-30-technical-design.md) §6; the bookmark promise of the UI spec §5 falls.
- **Why:** Checked under a real Supervisor (HA 2026.10, apps dev container): setting the frame's hash leaves Home
  Assistant's address unchanged; an outer address `/app/<slug>/<path>#<hash>` passes neither the path nor the hash
  into the frame; back inside the frame restores the previous hash.
- **Source:** Claude's ingress check, 2026-10-30, [skeleton plan](superpowers/plans/2026-10-30-skeleton.md) "After
  the tasks" step 5

### D11: The fake Firefly III is a fourth workspace, `addon/dev/`
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** The fake Firefly III is the npm workspace `addon/dev/` (`@ha-spending/dev`). The compose file and the
  token script for a real Firefly III sit beside it in `addon/dev/firefly/`. `scripts/` holds only entry scripts.
- **Why:** [Technical spec](superpowers/specs/2026-10-30-technical-design.md) §2 puts it in `addon/dev/` and §7.1 "in
  `scripts/`"; §2 wins, and the server's tests can import the fake and its data.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md)

### D12: How Firefly III is read
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** The client takes a page size: 500 in the add-on, 5 in the integration tests. Paging follows each
  answer's `meta.pagination.total_pages`. The earliest posting date takes two GETs: `limit=1` from `1900-01-01`, then
  the last page. The answer lists every asset account, active or not. The main group rule group is found by name and
  its active flag is ignored.
- **Why:** The technical spec §3.1 names no active check. A server-side cap on the page size then does no harm, and a filter by account never drops a posting. A real
  Firefly III 6.7.9 lists inactive asset accounts, checked by the integration tests.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md); [technical spec](superpowers/specs/2026-10-30-technical-design.md) §3.3

### D13: The fast loop's server binds `127.0.0.1`; the options file is `HA_SPENDING_OPTIONS`
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** With `HA_SPENDING_DEV=1` the server binds `127.0.0.1` only. In the add-on it binds all addresses, as
  before. The options file is `HA_SPENDING_OPTIONS`, `/data/options.json` by default.
- **Why:** The server holds a token now, and the dev switch turns the ingress check off.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md)

### D14: Firefly III's own names are data, not text
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** Rule groups, main groups and categories of Firefly III may be Danish in option defaults, fixtures and
  seeds. Hard rule 6 governs the add-on's own words. The option labels are in `addon/translations/da.yaml`.
- **Why:** The names are the household's data, and the default `Hovedgrupper` has to match it.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md) (the technical spec's English-only rule against
  the Danish defaults)

### D15: A posting's category is its name; the missing ones are `null`
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** A posting's `category` is the category's name, because the rules match categories by name. Uden
  hovedgruppe and Uden kategori are `null` in `addon/shared/` and the answer. Their texts belong to `da.ts`.
- **Why:** No Danish sentence comes from the server, and a name cannot clash with a label.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md)

### D16: The unit rules where the UI spec leaves a choice
- **Date:** 2026-10-31 · **Status:** active
- **Decision:**
  - Only the running unit is partial. A unit clipped at the period's start or end is shown clipped, but counts as a
    whole unit in averages and comparisons.
  - A period with at most one whole unit is a one-unit period.
  - The unit compared is the last whole unit, or the last unit when there is none. The unit before it, when it lies
    inside the period, is the clipped unit; before the period it is the full unit, so the number matches its bar.
  - A unit whose last day is before the earliest posting has no data: it is left out of every average and makes a
    comparison `null`.
  - Colours come from the period's totals, so a part keeps its colour when a unit is chosen. Positive parts take the
    palette in circle order, then greys from `#8a8a8a` to `#c4c4c4`. Parts of 0 or less get `#c4c4c4` and no piece.
- **Why:** The specs' plain reading of "partial" is "still running"; the controller ruled so on 2026-10-31.
- **Source:** Claude with the controller's rulings, [data plan](superpowers/plans/2026-10-31-data.md);
  [UI spec](superpowers/specs/2026-10-30-ui-ux-design.md) §3.1

### D17: The integration user and token come from a PHP script in the container
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** `addon/dev/firefly/mktoken.php` makes the user and the token inside the Firefly III container. The
  token stays in the environment of the `scripts/integration` run.
- **Why:** The image has no `tinker`, and `system:create-first-user` refuses outside testing, so the technical spec
  §7.2's `php artisan` route does not exist.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md)

### D18: `/api/data` answers errors as codes
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** Firefly III unreachable, timed out, answering 5xx or not JSON: `502 {"error":"unreachable"}`. Answering
  401 or 403: `502 {"error":"refused"}`. A bad query: `400 {"error":"bad-request"}`. Anything else:
  `500 {"error":"internal"}`.
- **Why:** The page shows "Firefly III svarer ikke" or "Firefly III afviser nøglen" from the code (plan 3), and no
  Danish text comes from the server.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md)
