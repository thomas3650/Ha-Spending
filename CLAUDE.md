# CLAUDE.md

## What this repo is

HA Spending is a Home Assistant add-on that shows a household's spending from Firefly III on a page in Home
Assistant's side menu. The repo is **public**. The server reads Firefly III (`GET /api/data`) and the page shows the
spending, through ingress. The design is in the [UI spec](docs/superpowers/specs/2026-10-30-ui-ux-design.md) and the
[technical spec](docs/superpowers/specs/2026-10-30-technical-design.md).

## Layout

- `addon/` — the add-on and the image's build context: `config.yaml`, `Dockerfile`, `DOCS.md`, changelog, icons, and
  the npm workspaces root (`package.json`, one `package-lock.json`)
  - `addon/shared/` — the types between the server and the page, and the money and date rules
  - `addon/dev/` — a fake Firefly III, the example data, and the compose file for a real one; test and dev only
  - `addon/server/` — the add-on server (TypeScript, Hono on Node)
  - `addon/web/` — the page (TypeScript, Lit, ECharts, Vite); its Danish texts in `src/i18n/da.ts`
  - `addon/translations/` — the option labels, `en.yaml` and `da.yaml`
- `docs/` — the docs; the map is `docs/README.md`
- `scripts/` — `setup`, the fast loop (`develop`), `integration` and the link check
- `.githooks/` — the git hooks that `scripts/setup` turns on
- `.github/` — CI, the release workflows, Dependabot, the PR and issue templates
- `.claude/` — project settings and the `reviewer` agent
- `repository.yaml`, `release-please-config.json`, `.release-please-manifest.json` — the add-on repository and
  release metadata

## Commands

Set up and run (not gates):

```bash
scripts/setup         # once per clone, and after a dependency change: npm ci in addon/ and the git hooks
scripts/develop       # fast loop: a fake Firefly III on :8091, the server on :8099 (ingress check off), Vite on :5173
scripts/develop stop  # stop the fast loop (from another shell)
scripts/integration   # the server against a real Firefly III in Docker; Docker must run; CI runs it as `integration`
```

The gates (as CI runs them; all pass before every commit):

```bash
npm run lint --prefix addon && npm test --prefix addon && npm run build --prefix addon
uvx --from actionlint-py==1.7.12.25 actionlint && uvx zizmor==1.31.1 --offline .github/workflows && node scripts/check-links.mjs
```

The add-on linter, the add-on image build and gitleaks over the whole history run in CI only. What
`scripts/integration` checks, and the rest of the testing beyond the gates:
[`docs/testing.md`](docs/testing.md).

## Hard rules

1. Never commit on or push to `main`. Every change reaches `main` through a squash-merged PR.
2. The repo is public. No token, hostname, IP, account name or posting from Thomas's Firefly III or Home Assistant in
   any file, commit, PR, issue or screenshot. Made-up data only. Home Assistant's documented ingress address
   `172.30.32.2` is not private ([D5](docs/decisions.md)).
3. Never committed: what `.gitignore` lists (`.env`, `local/`, `screenshots/`, `.superpowers/`, `node_modules/`,
   `dist/`), and anything from the real Home Assistant or Firefly III.
4. No changes to Thomas's real Home Assistant from this project. An install goes to the house session
   ([`docs/releasing.md`](docs/releasing.md#after-a-release)).
5. Tests check behaviour through public interfaces: HTTP answers, rendered text, roles and accessible names (technical
   spec §7.1). No snapshot, CSS-selector or exact-log-text tests. Made-up data only.
6. **English everywhere:** code, names, comments, docs, commit messages, PR titles and issues. The only Danish is the
   page's texts in `addon/web/src/i18n/da.ts`, the option labels in `addon/translations/da.yaml`, and
   `panel_title: Forbrug` in `addon/config.yaml` ([D8](docs/decisions.md)). Firefly III's own names are data
   ([D14](docs/decisions.md)).
7. **Comments kept to a minimum:** a comment says why, only where the code cannot. No comment tells how something
   worked before, what changed or what was tried: the history is in git and the decisions in `docs/decisions.md`.
8. **One source per fact in the docs,** linked, never restated. A doc that no longer matches the code is changed in the
   same PR as the code.
9. Never bypass a hook (`--no-verify`, `-n`). Never read `.env`. Subagents also never read anything under `local/`.
10. GitHub Actions: every `uses:` pinned to a full commit SHA with a version comment, least permissions per job,
    `persist-credentials: false` unless the job pushes, and a `timeout-minutes` on every job.

## Way of working

@docs/way-of-working.md

## Documentation map

@docs/README.md
