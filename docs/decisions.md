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
- **Date:** 2026-10-30 · **Status:** active; port 8100 superseded by D29
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
  answer's `meta.pagination.total_pages`. The earliest posting date is the earliest withdrawal or deposit, also in an
  excluded main group; opening balances, reconciliations and transfers don't count. It takes two GETs per type, or one
  when there is at most one page: `limit=1` from `1900-01-01`, then the last page. The answer lists every asset
  account, active or not. The main group rule group is found by name and its active flag is ignored.
- **Why:**
  - The page size: 500 keeps the requests few, and 5 makes the integration tests read more than one page.
  - The paging: a server-side cap on the page size then does no harm.
  - The earliest date: Firefly III has no endpoint for it. A posting in an excluded main group is a real household
    posting, so data exists from then; the other types are not spending.
  - The accounts: a filter by account never drops a posting. A real Firefly III 6.7.9 lists inactive asset accounts,
    checked by the integration tests.
  - The rule group: the technical spec §3.1 names no active check.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md);
  [technical spec](superpowers/specs/2026-10-30-technical-design.md) §3.3; the earliest date: Claude's ruling after the
  branch review, 2026-10-31

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
- **Decision:** Firefly III answering 401 or 403: `502 {"error":"refused"}`. Any other failed or malformed answer:
  `502 {"error":"unreachable"}`. That is no answer, a timeout, a non-2xx status other than 401 and 403, a redirect, a
  body that is not JSON or has no `data`, or an unreadable amount. A bad query: `400 {"error":"bad-request"}`.
  Anything else: `500 {"error":"internal"}`.
- **Why:** The page shows "Firefly III svarer ikke" or "Firefly III afviser nøglen" from the code (plan 3), and no
  Danish text comes from the server.
- **Source:** Claude, [data plan](superpowers/plans/2026-10-31-data.md)

### D19: The charts are drawn by ECharts and named in the DOM
- **Date:** 2026-10-31 · **Status:** active
- **Decision:**
  - ECharts uses the SVG renderer and is bundled from `echarts/core` with only the parts used. The build is one JS
    chunk, with `chunkSizeWarningLimit` 700, because ECharts core and zrender dominate it.
  - The chart's element is `aria-hidden="true"`. Beside it, a visually hidden list of `<button>`s carries one button
    per piece and per bar, and a table carries the Forskel rows.
  - Focus on a button calls `highlight` on its piece or bar, and blur calls `downplay`. Hovering the chart uses
    ECharts' own emphasis. A click on a piece, its
    ECharts label or a bar calls the same handler as its button, and the component then calls `requestUpdate()`, so its
    props win over ECharts' own selection.
  - The wrapper `src/charts/echarts.ts` is mocked in the component tests, because happy-dom has no canvas and zrender
    measures text with one. The mock records calls: the `setOption` count, the highlight and downplay indexes and the
    click handlers. Focus, blur and chart clicks are tested through those calls, never through option contents.
- **Why:** SVG stays sharp at any zoom and has few elements here. UI spec §7 asks for an accessible name on every
  piece, which the DOM layer gives and the ECharts SVG cannot.
- **Source:** Claude, [page plan](superpowers/plans/2026-10-31-page.md)

### D20: The view state's hash
- **Date:** 2026-10-31 · **Status:** active
- **Decision:**
  - The keys are `period`, `from`, `to`, `by`, `accounts`, `group`, `category`, `unit`, `card`, `view`, `q`, `sort`,
    `min` and `max`, in a `URLSearchParams` string.
  - A default value is left out, so the opening view is the empty hash.
  - Uden hovedgruppe and Uden kategori are the key present with an empty value (`group=`). No filter is the key
    absent. All accounts is `accounts` absent, so a new account appears by itself; ticking every account sets it
    absent too.
  - A click pushes a history entry, so back steps one click. Typing in the search replaces the entry. Folding a group
    and "Vis ældre" are not in the state.
  - A value that does not parse, or that the answer does not know, falls back. Dates are checked with shared's
    `isDate`.
- **Why:** Back works without a router, and the state needs no store.
- **Source:** Claude, [page plan](superpowers/plans/2026-10-31-page.md)

### D21: A category implies its main group
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** Removing "Hovedgruppe: …" on Alle posteringer also removes the category, as a trail link drops the
  levels below it. Adding a category through "+ Filter" sets its main group.
- **Why:** A category belongs to one main group, so a category without its group would be a state that cannot be shown.
- **Source:** Claude, [page plan](superpowers/plans/2026-10-31-page.md)

### D22: The halves stack below 960 px of frame width
- **Date:** 2026-10-31 · **Status:** active; stack point superseded by D24
- **Decision:** The two halves stack when the page's frame is narrower than 960 px.
- **Why:** With Home Assistant's side menu open, a 1280 px window leaves the frame about 1024 px. Two halves still fit
  there, so UI spec §8's 1280 px holds.
- **Source:** Claude, [page plan](superpowers/plans/2026-10-31-page.md)

### D23: Dates follow the UI spec, and a unit after today is empty
- **Date:** 2026-10-31 · **Status:** active
- **Decision:**
  - Short month names come without a dot, from `da.months`, so a range reads "1. jan – 30. okt 2026". `Intl` stays
    for numbers, long month names and table dates.
  - A unit that starts after today is an empty slot, not "i gang". Only a partial unit that has begun is running
    (`BarItem.running`).
- **Why:** The UI spec's wording wins over technical spec §6 where they meet. A unit that has not begun is not running.
- **Source:** the controller's rulings, [page plan](superpowers/plans/2026-10-31-page.md);
  [D16](decisions.md) for the partial unit

### D24: The halves stack below 1024 px, and are equal below 1280 px
- **Date:** 2026-10-31 · **Status:** active; ring and name size superseded by D27
- **Decision:**
  - The two halves stack when the page's frame is narrower than 1024 px.
  - From 1024 px to 1279 px they are equal, `minmax(0, 1fr) minmax(0, 1fr)`. From 1280 px they are 5 : 7.
  - The circle's ring is 34–46 % with 12 px names, so its names fit beside it.
- **Why:** At a 1024 px frame the 5 : 7 circle half left no room for the names, and they ran into each other. Equal
  halves fit them there. Below 1024 px even equal halves are too narrow for a long name such as Uden hovedgruppe.
- **Source:** the controller's ruling after the Chrome check of the
  [page plan](superpowers/plans/2026-10-31-page.md)

### D25: Release PRs from `github.token`, CI started by hand
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** "Allow GitHub Actions to create and approve pull requests" is on and no `RELEASE_PLEASE_TOKEN` is set,
  as in `ha-claude-addon`. The release PR's CI is started by closing and reopening it with Thomas's login
  ([`releasing.md`](releasing.md#the-release-prs-ci)).
- **Why:** No token to create and renew. A PR opened with `github.token` triggers no workflows, so the reopen keeps the
  required checks without an admin merge.
- **Source:** Thomas, 2026-10-31 ("Do like ha-claude-addon")

### D26: The closed Konti field counts the accounts
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** With some accounts ticked, the closed "Konti" field shows "4 af 5 konti", not the names. This replaces
  "or the chosen names" in the UI spec's top card.
- **Why:** The names made the field four times as wide and moved the toolbar (#23). The names are in the open panel.
- **Source:** [first-test fixes spec §3](superpowers/specs/2026-10-31-first-test-fixes.md#3-the-fields-keep-their-width-23),
  from the first test of 0.1.0.

### D27: A bigger circle with bigger names
- **Date:** 2026-10-31 · **Status:** active; the height below 600 px superseded by D28
- **Decision:** The ring is as big as the room for its labels allows, between 46 % and 62 % of half the chart's
  shorter side, and is sized again when the chart is resized. Names are 14 px and amounts 12 px. The circle and the
  bars are 400 px high, the circle 560 px below 600 px.
- **Why:** At full screen the ring and its names were small beside the bars (Thomas). The bars share the height so the
  two halves stay level.
- **Source:** Thomas, 2026-10-31 ("the circel to the left can be bigger", "and bigger fonts on the cirkel")

### D28: A narrow circle lists its parts under the ring
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** On a chart narrower than 400 px the ring is 240 px high and has no labels beside it. Its parts are listed
  under it instead, with a colour dot, the name and the amount and share; a part is chosen from the list. Below 600 px
  the three key numbers stack. Pie labels keep 8 px between them.
- **Why:** At about 420 px the column beside the ring was some 55 px wide, so names broke inside words and labels
  overlapped (#28). The list was the hidden button list already there for keyboard and screen readers. The margin
  leaves room for a chosen piece's label, which moves out with its piece after the labels are spread.
- **Source:** Claude, for #28 (Thomas: "Yes, fix #28", 2026-10-31)

### D29: The sorter's endpoint: MCP on port 8100, behind a key
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** When `sorter_key` is set, the server also listens on port 8100, unpublished and without the ingress
  check, for an MCP endpoint with two tools, `start` and `set_category`. Every request needs the key, compared as
  SHA-256 digests in constant time, and a key under 32 characters stops the add-on. It answers JSON-RPC as plain JSON,
  written by hand, with no MCP SDK. `start` leaves the inbox category out of
  the categories that must be listed, and a list that names it is a problem. `set_category` takes 1 to 100
  assignments per call. With D30 it replaces the technical spec's promises that the add-on never writes to Firefly III
  (§1) and that nothing but the page's routes is served and no route writes (§5).
- **Why:** An AI sorter in another add-on sets categories without holding the Firefly III token, and the limits are in
  this code, not in its prompt. A hand-written JSON answer needs no new dependency. The inbox is never chosen, but the
  rule group may map it to a tag of its own. The batch keeps a backlog of over a thousand postings within the agent's
  turns.
- **Source:** Thomas, 2026-10-31, the design of the AI sorting agreed in the house session; the batch: the house
  session, 2026-10-31; the inbox rule and the key's length: Claude

### D30: The sorter's one write
- **Date:** 2026-10-31 · **Status:** active; what is written superseded by D32
- **Decision:** `set_category` re-reads the posting's whole group right before it writes, and writes with one PUT of
  the group: the posting's `category_id` and `tags`, only `transaction_journal_id` for every other split, the
  `group_title` of a split group, and `apply_rules: false`. The tags lose every tag an active rule of the rule group adds,
  also the losing tag of a conflict, and gain the category's main group. A failed write stops the batch. It replaces the technical spec's promise that the Firefly client has a
  `get` and nothing else (§5). Firefly III has no conditional update, so a hand change in the moment between the
  re-read and the PUT can still be overwritten.
- **Why:** Firefly III's update deletes the splits it does not list, refuses a split group without its title, and
  would run its rules. The integration tests check on 6.7.9 that the other split, the amount, the date and the notes
  stay. The re-read keeps a hand correction made since `start`.
- **Source:** Claude, for D29; the re-read and the fields written: Thomas, 2026-10-31, the design of the AI sorting

### D31: The search is a shared choice
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** The search is one of the shared choices. `q` is in the hash on every screen, and typing replaces the
  entry wherever it is typed. Opening Alle posteringer and leaving it through the trail keep the search.
- **Why:** Thomas looks for a store's cost on the overview and expects the search to stay when he switches cards.
- **Source:** Thomas, 2026-10-31, [the postings search spec](superpowers/specs/2026-10-31-postings-search.md).

### D32: The sorter writes a posting's shop
- **Date:** 2026-10-31 · **Status:** active
- **Decision:** `set_category` may also write a withdrawal's shop, by the account's id, in the same PUT as D30's, and
  only on a withdrawal whose destination is the expense account `(no name)`; it replaces D30's list of what is written.
  For that the endpoint may make expense accounts, through the client's `post`, used for nothing else; the name check,
  the lookup order, the 12,000-character cap on `start`'s shops and the failure answer are in
  [`addon/DOCS.md`](../addon/DOCS.md#the-sorters-endpoint).
- **Why:** Postings imported from a bank file land on `(no name)` with the shop only in the bank text, and the sorter
  already works out the shop. Writing by id keeps a name from pointing a purchase at a liability and the outcome
  independent of the database's collation.
- **Source:** Thomas, 2026-10-31, the design of the shop on every posting;
  [the shop spec](superpowers/specs/2026-11-01-sorter-shop.md); the limits: Claude

### D33: Subscriptions on the overview
- **Date:** 2026-11-01 · **Status:** active
- **Decision:** The overview shows Firefly III's subscriptions as a fourth key number and a fourth choice on the right
  card, `card=subscriptions` in the hash ([D20](decisions.md)). The key number is the cost per year. A row shows the
  amount as it is paid, with its repeat, and beside it the amount per year. The amount is the middle of the amount
  range; the due dates, the next date and the status follow the rules in the spec (§2), from the day the data was read.
  A subscription's category, main group and account are those of its last payment, as Firefly III gives it none of its
  own. A failed read of the subscriptions or of a payment's posting fails the whole answer.
- **Why:** The year makes the rows comparable. The last payment's posting is the only link from a subscription to a
  category. One answer has one error path: the same Firefly III and token serve every read, and a page with the
  subscriptions silently missing would read as "none".
- **Source:** Thomas, 2026-11-01: the year, the amount as paid and the "Om året" column;
  [the subscriptions spec](superpowers/specs/2026-11-01-subscriptions.md); the other calls: Claude
