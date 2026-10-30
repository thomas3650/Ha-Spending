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
