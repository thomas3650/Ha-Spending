# The spending overview: technical – design

- **Date:** 2026-10-30 · **Status:** draft, for Thomas to approve
- **Why:** how the page in the [UI and UX spec](2026-10-30-ui-ux-design.md) is built, tested, released and installed.
  That spec decides what the page shows and does; where the two meet, it wins.
- **Decided with Thomas** (2026-10-30, [#1](https://github.com/thomas3650/Ha-Spending/issues/1)): a small Home
  Assistant add-on with the page in the side menu through ingress; TypeScript; build and test in GitHub workflows;
  releases from the PR title with squash merges only; its own public repo. Everything else below is **Claude's call**
  (Thomas left the server's language and the rest to Claude), unless marked otherwise.
- **The template** is Thomas's [Ha-Fitness](https://github.com/thomas3650/Ha-Fitness): its add-on website, its
  workflows, its docs layout and its hard rules, without the Python, the integration, the cards, hassfest and HACS.
- **Needs an update on the real Home Assistant:** yes, once: the add-on repository added, the add-on installed, its
  options set (§8). Nothing else in the house changes.

## 1. The parts

```
browser (HA side menu, ingress) ──► add-on server (Node, TypeScript) ──► Firefly III API (read only)
        the page (Lit, ECharts)          normalises, caches                 /api/v1/...
```

- **The page** asks the add-on server for the postings of a date range and the lists it needs (accounts, main groups,
  categories), and does every sum, grouping, average and comparison itself, in the browser.
- **The server** holds Firefly III's token, reads Firefly III's API, turns its answers into one simple list of
  postings, keeps them for a few minutes, and serves the page's files. It never writes to Firefly III.
- **Why the sums are in the browser:** one period is at most a few thousand postings, so the page can hold them all;
  then every click (a category, a bar, the toggle, a new grouping) is answered at once without a round trip, and the
  sums and the postings come from the same list, so they always agree (UI spec §1, anti-goal).

## 2. The repo

```
addon/         the image's build context (the builder action and the Supervisor build from it), so all code is here
  config.yaml  Dockerfile  CHANGELOG.md  DOCS.md  README.md  icon.png  logo.png  translations/
  package.json  package-lock.json   the npm workspaces root
  shared/      the types between server and page, and the money rules (§4), used by both
  server/      the add-on server (TypeScript, Node)
  web/         the page (TypeScript, Lit, ECharts, Vite)
  dev/         the fake Firefly III (§7)
docs/          as Ha-Fitness: README.md (the map), decisions.md, architecture.md, releasing.md, testing.md,
               way-of-working.md, domain-language.md, mockups/, superpowers/specs/ and plans/
scripts/       the fast loop (§7.2) and the link check
.github/       workflows (§9), Dependabot, the PR template, issue templates
CLAUDE.md  README.md  LICENSE  SECURITY.md  repository.yaml  release-please-config.json  .release-please-manifest.json
```

- **npm workspaces** rooted in `addon/` (`shared`, `server`, `web`, `dev`), one `package-lock.json`, so they share one
  TypeScript version and the types are imported, not copied. The root is in `addon/` because the image is built from
  that folder alone (Ha-Fitness's workflows use `context: ./addon`), and the Dockerfile must see `shared/` and the
  lockfile.
- **TypeScript strict**, ES modules, Node 22 or newer. ESLint with typescript-eslint, as Ha-Fitness's web.
- **Hard rules** in `CLAUDE.md`, from Ha-Fitness: never commit to `main`; the repo is public, so no token, hostname,
  IP, account name or posting from Thomas's Firefly III in any file, commit, issue or screenshot; made-up data only;
  never bypass a hook; actions pinned to a commit SHA, least permissions per job. And Thomas's (2026-10-30):
  - **English everywhere:** code, names, comments, docs, commit messages, PR titles and issues. The only Danish is the
    page's own texts in `web/src/i18n/da.ts` and the option labels in `addon/translations/da.yaml`.
  - **Comments kept to a minimum:** a comment says why, only where the code cannot. No comment tells how something
    worked before, what changed or what was tried: the history is in git and the decisions in `docs/decisions.md`.
  - **One source per fact in the docs,** linked, never restated; a doc that no longer matches the code is changed in
    the same PR as the code.

## 3. Reading Firefly III

All reads go to Firefly III's API v1 with the token as a bearer token (`Authorization: Bearer …`,
`Accept: application/vnd.api+json`). Checked against the API docs of Firefly III 6.7.8 (Context7, 2026-10-30); the
Yellow runs 6.7.9.

| What | Endpoint | Used for |
| --- | --- | --- |
| Postings | `GET /api/v1/transactions?start=…&end=…&type=all`, paged (`limit`, `page`, `meta.pagination.total_pages`) | everything |
| Accounts | `GET /api/v1/accounts?type=asset` | the Konti dropdown and "own account" |
| Categories | `GET /api/v1/categories` | names, and categories with no postings yet |
| Main groups | `GET /api/v1/rule-groups`, then `GET /api/v1/rule-groups/{id}/rules` | which category belongs to which main group (§3.1) |

### 3.1 Main groups

A main group is read from **the rules**, not from the postings' tags, so a change of rules shows at once, also on
postings imported before it (UI spec: "a change of rules is followed").

- The rule group is named in the add-on's options (`main_group_rule_group`, default `Hovedgrupper`).
- Each active rule in it that has a trigger `category_is <category>` and an action `add_tag <tag>` maps that category
  to the main group `<tag>`. Other triggers and actions are ignored.
- A category no rule maps belongs to **Uden hovedgruppe**; a posting without a category to **Uden kategori** in it.
- **When two rules map one category to two main groups,** the later rule in the group's order wins (Firefly III runs
  them in that order and both tags are set; the page has to pick one so the sums add up), and the server logs a
  warning naming the category.
- If the rule group does not exist, every category is in Uden hovedgruppe, and the page says so once (UI spec §6).

### 3.2 Turning splits into postings

Firefly III returns transaction groups, each with one or more splits. The server makes **one posting per split**:

```ts
interface Posting {
  id: string;            // the split's transaction_journal_id
  groupId: string;       // the transaction group's id, for the link to Firefly III
  date: string;          // YYYY-MM-DD, the split's date in Europe/Copenhagen (the add-on's TZ)
  text: string;          // description
  account: string;       // the household's asset account id (source of a withdrawal, destination of a deposit)
  category: string | null;
  kind: 'spending' | 'refund';
  amount: number;        // øre, as an integer: spending positive, a refund negative
}
```

- **Main groups that are not spending** are named in the options (`excluded_main_groups`, default `Penge ind og ud`):
  every posting whose category is in one of them is left out, withdrawals and deposits alike. In Thomas's Firefly III
  that group holds Indskud, Indtægt (andet), Opsparing and Overførsel til egen konto: money paid into the household
  account arrives as a deposit with the category Indskud, and savings leave as withdrawals (found by the builder check,
  2026-10-30). They belong to the later money-in-and-savings view (issue #9).
- Then: a **withdrawal** from an asset account → `spending`.
- A **deposit** into an asset account **with a category** → `refund` (UI spec §2: refunds are subtracted). A deposit
  without a category is income, and is left out (UI spec §9, issue #9).
- A **transfer** → left out, whichever accounts are chosen. Opening balances and reconciliations → left out.
- Amounts become integers in øre at the edge, so no sum is a floating-point sum. Foreign-currency amounts use the
  split's amount in the account's currency (Danish kroner); the foreign amount is ignored.
- The server sends the postings of the asked range and the accounts, categories and main groups in one answer; the
  page filters by account itself.

### 3.3 Cache and load

- The server keeps the answer for a date range **5 minutes** (data changes only at the monthly import), in memory, at
  most 20 ranges. A new add-on start clears it.
- Firefly III is asked with `limit=500` per page, the pages one after another; a year is a handful of requests.
- **Timeouts:** 30 s for a range. An error from Firefly III (unreachable, 401, 5xx) becomes one error the page shows
  (UI spec §6): "Firefly III svarer ikke" or "Firefly III afviser nøglen". The token never appears in an error, a log
  line or an answer.

## 4. The money rules, in `shared/`

The rules of the UI spec as pure functions with no I/O, used by the page and tested on their own (§7.1):

- grouping into units (day, ISO week Monday first, month, quarter, year), clipped to the period; which unit is partial
  (still running on the day the data was read);
- sums per level and unit (spending less refunds), shares, averages over whole units, the last whole unit against the
  one before, a chosen unit against the average of the other whole units, one-unit periods against the 12 units
  before;
- the circle's order and colours (the eight largest in the palette, then greys).

**The date range the page asks for** is the period widened to cover what the comparisons need: the unit before the
last whole unit, and for a one-unit period the 12 units before it. Postings outside the period feed only those numbers.

**Before the data begins:** the server sends the date of the earliest posting in Firefly III. A unit before it is not
counted as zero but left out: an average over the units before a one-unit period counts only units with data, and its
label says how many ("gns. af 7 måneder før"); with none, the average shows "–". A comparison with a unit before the
data shows "–" too.

## 5. The server

- **Node 22, TypeScript, Hono** (`@hono/node-server`): small, typed, serves the API and the static files.
- **Routes:** `GET /api/data?start=YYYY-MM-DD&end=YYYY-MM-DD` (the answer of §3.2, typed in `shared/`), `GET
  /api/health`, and the page's built files on `/`. Nothing else, and no route writes.
- **Ingress only:** it listens on the ingress port and answers only `172.30.32.2` (Home Assistant's ingress); any other
  address gets 403. The fast loop on the Mac turns that check off with a development setting the add-on never sets. No port is published in `config.yaml`. The page uses relative URLs, so it works under the ingress
  path.
- **Options** (`/data/options.json`, schema in `config.yaml`):

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `firefly_url` | url | none | Firefly III's API as the add-on reaches it, e.g. `http://<firefly add-on host>:8080` |
| `firefly_token` | password | none | a Personal Access Token from Firefly III |
| `firefly_link_url` | url? | empty | Firefly III's own page as the browser reaches it; when set, a posting opens there in a new tab (`/transactions/show/{groupId}`), when empty, postings are not links |
| `main_group_rule_group` | str | `Hovedgrupper` | §3.1 |
| `excluded_main_groups` | list of str | `Penge ind og ud` | §3.2: main groups that are not spending |

- **The token is read only by the server.** Firefly III's Personal Access Tokens cannot be made read-only, so the read
  only promise is the code's: the Firefly client has a `get` and nothing else, and a test fails if any other method
  appears.
- **Logs:** start, the Firefly III version read from `GET /api/v1/about` at start, errors without the token, and the
  §3.1 warnings. No postings or amounts are logged.

## 6. The page

- **Lit + TypeScript, built with Vite**, as Ha-Fitness's website; **Apache ECharts** for the circle, the bars and the
  Forskel bars, bundled into the build (only the parts used), no CDN.
- **The state** (UI spec §5) is one object, written to and read from the address's hash. Back works, as hash changes
  inside the ingress frame go into the browser's history. **Not known:** whether Home Assistant carries the frame's
  hash into its own address, which a bookmark needs; plan 1 checks it on the Yellow, and if it does not, the UI spec's
  promise of bookmarks falls and only back remains.
- The page fetches `/api/data` for the widened range (§4) when the period changes, and nothing else on a click.
- **Texts** in one Danish language file; numbers and dates through `Intl` with `da-DK`.
- Light theme only; the colours as CSS custom properties, so a theme can come later without a rewrite.

## 7. Tests

### 7.1 The gates (as CI runs them)

- `npm run lint` (ESLint and `tsc --noEmit`) and `npm test` (Vitest) in every workspace; `npm run build`.
- **`shared/`**: the money rules against made-up postings: refunds net, transfers out, income out, Uden hovedgruppe
  and Uden kategori, partial units, ISO weeks across a new year, one-unit periods, averages without the partial unit,
  every level adding up to its parent.
- **The server**: against a **fake Firefly III** (a small HTTP server in `scripts/`, serving made-up answers in Firefly
  III's shapes): paging, splits, the rule mapping and its warnings, the cache, the error mapping, the 403 for other
  addresses, and that the client sends nothing but GETs.
- **The page**: components with Vitest and happy-dom, by role and accessible name (UI spec §7), not by CSS selector.

### 7.2 Integration tests against a real Firefly III (Thomas, 2026-10-30)

The fake Firefly III answers in the shapes we believe Firefly III uses; the integration tests prove them against the
real thing.

- **A real Firefly III in Docker:** the official image `fireflyiii/core`, pinned to the version on the Yellow (6.7.9
  today), with SQLite, no other services, started by a compose file in `addon/dev/` on the Mac and in CI alike.
- **Set up headless:** a script makes the first user and a Personal Access Token with Firefly III's own command line
  (`php artisan` in the container), so no browser and no real login is involved. The exact commands are the plan's to
  find and pin; the token lives only in the test run.
- **Seeded through the API** with made-up data that covers the rules: two asset accounts; categories in several main
  groups; the rule group `Hovedgrupper` with `category_is` → `add_tag` rules, including two rules on one category and a
  category no rule maps; the group `Penge ind og ud` (Indskud, Opsparing); withdrawals, refunds, Indskud deposits,
  savings withdrawals, a transfer between the two accounts, a split transaction, a posting in a foreign currency, an
  uncategorised posting; across a new year and more than one page of results.
- **What they check:** the server's Firefly III client and normalisation (§3) against the real answers; `/api/data`
  for a few periods against sums worked out by hand for the seed; the rule mapping (§3.1); a refused token and an
  unreachable Firefly III. The page is not part of them.
- **In CI:** a job `integration` on every PR and push to `main`, a required check. Locally: `scripts/integration`.
- **When the Yellow's Firefly III is updated,** the pinned version is bumped in the same change, so the tests run
  against the version in use (a note in `docs/releasing.md`).

### 7.3 Beyond the gates

- **The fast loop:** the fake Firefly III, the server and Vite's dev server on the Mac (`scripts/develop`).
- **The Chrome check** before a screen is called done: a screenshot of each screen and state of the UI spec at
  1440×960 against the fake Firefly III's data, compared with the mockups, no console errors (as Ha-Fitness's
  `testing.md`).
- Real data is seen only on the Yellow, by Thomas or the house's development session, never in this repo.

## 8. Install on the Yellow

Done by the house repo's development session, each step at Thomas's yes (the house's rules):

1. Add `https://github.com/thomas3650/Ha-Spending` as an add-on repository, install "HA Spending", and turn on "Show
   in sidebar" (an ingress add-on is not in the side menu until then).
2. **Thomas** makes a Personal Access Token in Firefly III (Options → Profile → OAuth) and puts it into the add-on's
   `firefly_token`; the session never sees it.
3. Set `firefly_url` to the Firefly III add-on's internal address, `firefly_link_url` to its page, start the add-on,
   and check the page in Chrome with real data.

## 9. CI and releases

From Ha-Fitness, trimmed to one component:

- **`pr-title`:** the PR title must be a Conventional Commit: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `ci`.
- **`ci`** on every PR and push to `main`: lint, types, tests and build per workspace; the integration tests (§7.2); the add-on linter; the add-on
  image built per architecture without pushing, with one `addon-build` check that gates them; `actionlint`, `zizmor`
  and the link check over the docs.
- **`release-please`:** one component (`addon/`), release type simple, the version also in `addon/config.yaml`; a
  merged release PR tags and drafts the release.
- **`addon-image`:** on a version change in `addon/config.yaml`, builds and pushes `ghcr.io/thomas3650/ha-spending` for
  each architecture and the multi-arch manifest, only if that version is missing; then Home Assistant offers the update
  with its changelog.
- **`gitleaks`** on every PR and push; **Dependabot** monthly for actions and npm, grouped.
- **Architectures:** `aarch64` (the Yellow) and `amd64`, as Ha-Fitness.
- **GitHub settings,** set once with `gh` at Thomas's yes: squash merge only, the PR title as the commit message, the
  branch deleted after merge; `main` protected with the required checks `pr-title`, `ci`'s jobs (`integration` among them), `addon-build`
  and `gitleaks`.
- **Thomas's steps,** as in Ha-Fitness's `releasing.md`: the `RELEASE_PLEASE_TOKEN` secret (so CI runs on release PRs),
  and making the GHCR package public after the first image.

## 10. The reviewer (Thomas, 2026-10-30)

A Claude Code agent, `.claude/agents/reviewer.md`, made in plan 1:

- **Read only:** its tools are `Read`, `Grep` and `Glob`. It cannot edit a file, run a test or run any command; the
  session that dispatches it hands it what to read: the spec, the plan, and for a branch a diff written to a file
  (`git diff BASE..HEAD`), with the test and CI results as the session ran them.
- **When:** each spec and plan before it is approved, and each branch before its PR merges. It returns **Ready** or
  **Needs changes**, with findings as file and line, what is wrong, and why it matters, most severe first.
- **Its focus, in this order:**
  1. **Security and privacy:** no token, hostname, IP, account name or real posting anywhere in the public repo; the
     token never reaches the browser, a log line or an answer; the Firefly III client sends GETs only; the server
     answers ingress only.
  2. **Correctness against the specs:** the money rules (every level adds up to its parent; refunds net; transfers,
     income and the excluded main groups out; partial units, ISO weeks, averages), the rule mapping, the state and
     the clicks of the UI spec.
  3. **Tests:** they check behaviour through public interfaces with made-up data, can fail, are not skipped, and cover
     what §7.1 and §7.2 list; a change in behaviour comes with a test.
  4. **Docs:** nothing duplicated (one source per fact, linked); nothing stale (a file, option, command or behaviour
     the docs name that no longer exists or no longer works so); a lasting decision has a `docs/decisions.md` entry.
  5. **Comments:** only where the code cannot say why; any comment about how it worked before, what changed or what
     was tried is a finding.
  6. **Language:** English in code, names, comments, docs, commits and PR titles; Danish only in the two language
     files.
  7. **CI and releases:** actions pinned to a SHA, least permissions, the PR title's type matches the change
     (`docs/releasing.md`).
  8. **Simplicity:** no code or option the specs do not ask for; the template's way where it has one.

## 11. The order of the work

Each a plan of its own, in this order:

1. **The skeleton:** the repo layout, the docs, `CLAUDE.md` with the hard rules, the reviewer (§10), the workflows
   and settings, and an add-on whose page says "Hej" through ingress, released once and installed on the Yellow, so the whole path is proven before any feature.
2. **The data:** `shared/` with the money rules, the server with the Firefly III client, the cache, the fake Firefly
   III, and the integration tests against a real Firefly III in Docker (§7.2).
3. **The page:** screens 1 to 4 of the UI spec, with the Chrome check.
4. **The first real release**, installed and checked on the Yellow with real data.

## 12. What is left to the builder

- Library versions, the exact ESLint rules, the Vite and ECharts configuration.
- The fake Firefly III's and the integration seed's made-up data, as long as they cover §7.1 and §7.2.
- The add-on's icon and logo (a neutral one of our own, as HA-NortecGo's).
