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
- **Date:** 2026-10-31 · **Status:** active; the comparison superseded by D53
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
- **Date:** 2026-10-31 · **Status:** active; the chunk-size limit superseded by D39, the Forskel table by D57, "one button per bar" for a one-unit period's finer bars by D59
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
- **Date:** 2026-10-31 · **Status:** active; key list superseded by D35, D42, D44, D60 and D61
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
- **Date:** 2026-10-31 · **Status:** active; its Alle posteringer chip and "+ Filter" parts superseded by D60
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
- **Date:** 2026-10-31 · **Status:** active; the height below 600 px superseded by D28, the bars' height in full
  screen by D67
- **Decision:** The ring is as big as the room for its labels allows, between 46 % and 62 % of half the chart's
  shorter side, and is sized again when the chart is resized. Names are 14 px and amounts 12 px. The circle and the
  bars are 400 px high, the circle 560 px below 600 px.
- **Why:** At full screen the ring and its names were small beside the bars (Thomas). The bars share the height so the
  two halves stay level.
- **Source:** Thomas, 2026-10-31 ("the circel to the left can be bigger", "and bigger fonts on the cirkel")

### D28: A narrow circle lists its parts under the ring
- **Date:** 2026-10-31 · **Status:** active; the count superseded by D53
- **Decision:** On a chart narrower than 400 px the ring is 240 px high and has no labels beside it. Its parts are listed
  under it instead, with a colour dot, the name and the amount and share; a part is chosen from the list. Below 600 px
  the three key numbers stack. Pie labels keep 8 px between them.
- **Why:** At about 420 px the column beside the ring was some 55 px wide, so names broke inside words and labels
  overlapped (#28). The list was the hidden button list already there for keyboard and screen readers. The margin
  leaves room for a chosen piece's label, which moves out with its piece after the labels are spread.
- **Source:** Claude, for #28 (Thomas: "Yes, fix #28", 2026-10-31)

### D29: The sorter's endpoint: MCP on port 8100, behind a key
- **Date:** 2026-10-31 · **Status:** active; its list of two tools superseded by D34
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
- **Date:** 2026-10-31 · **Status:** active; the way into Alle posteringer that keeps the search superseded by D57, leaving it through the trail by D60
- **Decision:** The search is one of the shared choices. `q` is in the hash on every screen, and typing replaces the
  entry wherever it is typed. Opening Alle posteringer and leaving it through the trail keep the search.
- **Why:** Thomas looks for a store's cost on the overview and expects the search to stay when he switches cards.
- **Source:** Thomas, 2026-10-31, [the postings search spec](superpowers/specs/2026-10-31-postings-search.md).

### D32: The sorter writes a posting's shop
- **Date:** 2026-10-31 · **Status:** active; only a withdrawal, and only expense accounts, superseded by D50
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
- **Date:** 2026-11-01 · **Status:** active; the key number superseded by D41
- **Decision:** The overview shows Firefly III's subscriptions as a fourth key number (the cost per year) and a fourth
  choice on the right card, `card=subscriptions` in the hash ([D20](decisions.md)). A subscription's category, main
  group and account are those of its last payment, and a failed read of the subscriptions or of a payment's posting
  fails the whole answer.
- **Why:** The last payment's posting is the only link from a subscription to a category. One answer has one error
  path, and a page with the subscriptions silently missing would read as "none".
- **Source:** Thomas, 2026-11-01: the year, the amount as paid and the "Om året" column;
  [the subscriptions spec](superpowers/specs/2026-11-01-subscriptions.md); the other calls: Claude

### D34: The chat's four tools on the sorter's endpoint
- **Date:** 2026-11-01 · **Status:** active
- **Decision:** The sorter's endpoint also serves `find_postings`, `get_posting`, `spending` and `move_posting`, under
  the same key; the calling add-on's gate tells the chat's tools from the sorter's by name. `move_posting` moves one
  posting, given with its amount, and writes only the category, the main group's tag as D30, the tag in the option
  `moved_tag` and one more line of notes with the date, both categories and the household's reason. It refuses a
  transfer, a posting in a group of several, a posting or a category in an excluded main group, and a category the
  sorter could not choose. The reads take at most 400 days and answer at most 50 rows; `spending` counts as the page
  does, with the page's `classify` and `parts`. `find_postings` has no account filter, by choice: the household asks
  by shop, text, category and period, and the answer names no account. The contract is in
  [`addon/DOCS.md`](../addon/DOCS.md#the-chats-tools).
- **Why:** The household asks the chat about spending and to fix a wrong category, and the chat must not hold the
  Firefly III token or be able to change an amount, a date, an account or a description. The narrowness is in this
  code, not in the chat's prompt; the tag and the note let a move be found and undone by hand. A split posting is
  left to Firefly III itself, because a move of one part changes what the group means. One endpoint needs no second
  key or port; the price is that the endpoint does not tell the sorter from the chat, so the separation between them
  lives only in the calling add-on's gate, and D29's bound of at worst a wrong category or shop holds only behind it.
- **Source:** Thomas, 2026-11-01, the design of a more helpful assistant in the house session (the tools, the tag, the
  note); the names, the limits and the refusals: Claude

### D35: The chosen shop is a shared choice
- **Date:** 2026-11-01 · **Status:** active; the way into Alle posteringer that keeps the shop superseded by D57, "before `sort`" by D60
- **Decision:** The chosen shop belongs with the search: one of the shared choices, kept and changed as the search is.
  It is the hash key `shop`, written right after `q` and before `sort` on every screen ([D20](decisions.md)); an empty
  value is no shop.
- **Why:** Thomas wants a shop's postings and cost in the chosen period, and the link keeps what he chose.
- **Source:** Thomas, 2026-11-01; [the shop search spec](superpowers/specs/2026-11-01-shop-search.md) §4

### D36: The page calls subscriptions "faste udgifter"
- **Date:** 2026-11-01 · **Status:** active
- **Decision:** The page calls Firefly III's bills "faste udgifter". The code keeps `subscription`
  ([D33](decisions.md) stays active).
- **Why:** The bills include rent, loans, insurance and utilities, not only subscriptions, and a main group can itself
  be named "Abonnementer".
- **Source:** Thomas, 2026-11-01

### D37: Full screen stays out of the hash
- **Date:** 2026-11-01 · **Status:** superseded by D60
- **Decision:** The right card's full screen is a layout setting of the page load, held by the app and not in the hash.
  It adds no history entry; the button or Escape on the overview turns it off, and a reload starts with it off.
- **Why:** A shared link should show the normal page, and a layout setting is not a choice of what to look at.
- **Source:** Thomas, 2026-11-01, [the card full-screen spec §1](superpowers/specs/2026-11-01-card-full-screen.md)

### D38: Firefly III's object groups decide which bills show and how they are marked
- **Date:** 2026-11-01 · **Status:** active
- **Decision:** The Faste udgifter card shows only the bills that have an object group in Firefly III. Each row, each
  sum and the mark on a linked posting take the object group's title as Firefly III gives it. The page keeps no names,
  colours or rules of its own for object groups.
- **Why:** Firefly III is the one place that says which bill is which, and a new object group then needs no change
  to the page.
- **Source:** Thomas, 2026-11-01, [the object groups spec](superpowers/specs/2026-11-01-object-groups.md) §1 and §2

### D39: The custom period uses Vanilla Calendar Pro
- **Date:** 2026-11-02 · **Status:** active
- **Decision:** The period's custom interval is one calendar from Vanilla Calendar Pro, mounted inline in the menu,
  with Fra and Til fields for typing. The one chunk's `chunkSizeWarningLimit` is 800 kB.
- **Why:** Safari would not take a typed year in the date field, and the browsers' date fields differ. A library gives
  one behaviour everywhere. It replaces the two `<input type="date">` fields and is a runtime dependency beside Lit and
  ECharts (technical spec §6). It takes the one chunk past D19's 700 kB.
- **Source:** Thomas, 2026-11-02, [the lists spec](superpowers/specs/2026-11-02-lists-period-postings.md) §1.2

### D40: Tables sort by their headers
- **Date:** 2026-11-02 · **Status:** active; Alle posteringer's `sort` in the hash and the why that rests on D37 superseded by D60
- **Decision:** The postings tables and Faste udgifter sort by their column headers, and there is no sort dropdown.
  Alle posteringer keeps its sort in the hash as `sort`; the two cards' sort is held by the app and not in the hash.
- **Why:** A header is where a reader looks to sort. A card's sort is a view setting, like full screen
  ([D37](decisions.md)), and a shared link should not carry it.
- **Source:** Thomas, 2026-11-02, [the lists spec](superpowers/specs/2026-11-02-lists-period-postings.md) §2

### D41: Key numbers for the object groups, and a link to all postings
- **Date:** 2026-11-02 · **Status:** active; the period's payments with the sum per month superseded by D56, the first key number's link to Alle posteringer by D60
- **Decision:** There is one key number per Firefly III object group, showing the period's payments with the sum per
  month and the count of bills; they replace "Faste udgifter om året" ([D33](decisions.md)). The first key number links
  to Alle posteringer and clears the search and the chosen shop, an exception to [D31](decisions.md) and
  [D35](decisions.md).
- **Why:** The object groups' names are Firefly III's ([D38](decisions.md)), so the page keeps no fixed two. The link
  shows the count that Alle posteringer will list.
- **Source:** Thomas, 2026-11-02, [the lists spec](superpowers/specs/2026-11-02-lists-period-postings.md) §3 and §4

### D42: The object group is a filter of Alle posteringer
- **Date:** 2026-11-02 · **Status:** superseded by D62
- **Decision:** The object group is a filter of Alle posteringer, in the hash as `og` after `max`, reached from the link
  under its key number. An object group that no posting carries still filters, an exception to [D20](decisions.md)'s
  fallback. The link clears the search and the shop, as [D41](decisions.md) does (an exception to
  [D31](decisions.md) and [D35](decisions.md)), and the chosen unit, an exception to the [UI spec](superpowers/specs/2026-10-30-ui-ux-design.md) §5.
- **Why:** The link shows the count of the key number's value, which is not the chosen unit's. Dropping an unknown group
  silently would change the list without a word.
- **Source:** Thomas, 2026-11-02, [the object group postings spec](superpowers/specs/2026-11-02-object-group-postings.md)
  §1 to §3

### D43: The hidden shops are a file of the add-on's own
- **Date:** 2026-11-02 · **Status:** active
- **Decision:** The page keeps the shops hidden from the Butikker card in `/data/hidden-shops.json`, written by one
  `POST /api/hidden-shops`: one shop per request, its name in the body, never anything in Firefly III. The narrowness
  is in the code: the content type, a 1 kB body, a 200-character name and at most 500 shops. It replaces the technical
  spec's promises that the add-on never writes (§1), that no route writes (§5) and that the page fetches nothing else
  on a click (§6), as D29 did for §1 and §5.
- **Why:** The hidden shops are the same on the phone and the computer, and they are the household's choice, not
  Firefly III's data. One shop per request means two devices cannot undo each other's change with a stale list.
- **Source:** Thomas, 2026-11-02, [the top shops spec](superpowers/specs/2026-11-02-top-shops.md) §3 and §4; the
  route's shape and limits: Claude

### D44: The open detail is in the hash
- **Date:** 2026-11-02 · **Status:** active; "on Alle posteringer" superseded by D60
- **Decision:** The detail of a fixed expense or a posting is the hash key `detail`, `s:<id>` or `p:<id>`, written last.
  It resolves on the overview's Posteringer and Faste udgifter cards and on Alle posteringer; anywhere else it is left
  out. Opening a detail adds a history entry, a click on another row replaces it, and closing goes back one entry only
  when the current entry is the one the open pushed.
- **Why:** Back closes the detail, and a shared link or a reload opens it, as for the other choices ([D20](decisions.md)).
  Closing by going back keeps Back from reopening a detail that was just closed.
- **Source:** Claude, 2026-11-02, [the detail view spec](superpowers/specs/2026-11-02-detail-view.md) §5

### D45: The reviewer runs the Chrome check last in every branch review
- **Date:** 2026-11-02 · **Status:** active
- **Decision:** `reviewer` stays without edits or commands, but gains Claude in Chrome. Last in every branch review it
  runs the [Chrome check](testing.md#chrome-check) itself, in the fast loop the dispatching session has started, on
  made-up data only. This replaces the
  [technical spec](superpowers/specs/2026-10-30-technical-design.md) §10's reviewer with only `Read`, `Grep` and `Glob`.
- **Why:** The first real use of the detail view found a sign that read wrong beside the list and rows that could not be
  clicked, which a review of the diff did not see.
- **Source:** Thomas, 2026-11-02, "the review agent must always test the changes in Chrome at the end, also in future"

### D46: The detail writes amounts as Posteringer does, and its rows open Firefly III
- **Date:** 2026-11-02 · **Status:** active
- **Decision:** In the detail, a shop's head amount and every row's amount use Posteringer's sign: spending with a
  minus, a refund with a plus. A fixed expense's head stays as the Faste udgifter table writes it, and the sums in the
  boxes and the bars stay positive for spending. Each row's date links to its
  posting in Firefly III, and a click anywhere on the row opens it once. This replaces the
  [detail view spec](superpowers/specs/2026-11-02-detail-view.md) §2.6's one sign.
- **Why:** Beside the list, an opposite sign read as wrong, and a row was expected to open its posting.
- **Source:** Thomas, 2026-11-02, from the detail in use

### D47: Amount bounds are whole øre, and the hash writes øre after a dot
- **Date:** 2026-11-03 · **Status:** active
- **Decision:** The Beløb fields take Danish numbers (a dot groups thousands, a comma starts one or two decimals) and
  hold each bound as a whole number of øre. The hash keeps `min` and `max` in kroner: digits, optionally a dot and one
  or two digits; it writes digits only for whole kroner and a dot with two digits otherwise (`max=1000.50`).
- **Why:** A Danish number such as "1.000,50" was refused, and a bound with øre could not be given. Kroner with a dot
  in the hash read old links with whole kroner as before.
- **Source:** Thomas, 2026-11-03 (approved [UI polish spec](superpowers/specs/2026-11-03-ui-polish.md) §3.2)

### D48: The add-on's user docs say app, the repo's docs add-on
- **Date:** 2026-11-03 · **Status:** active
- **Decision:** `addon/DOCS.md` and `addon/README.md` say "app" where they mean what Home Assistant now calls an app
  (*Settings → Apps*). The product name "HA Spending" stays. The repo's own docs and the code keep "add-on".
- **Why:** The users of the docs see "app" in Home Assistant; the repo's names (`addon/`, the add-on repository) are
  the established ones.
- **Source:** Thomas, 2026-11-03 ([UI polish spec](superpowers/specs/2026-11-03-ui-polish.md) §5.9)

### D49: The server keeps the span-free parts per day and reads a list's pages 4 at a time
- **Date:** 2026-11-03 · **Status:** active
- **Decision:** The main-group rules, the categories, the asset accounts, the earliest posting date and the
  subscriptions are read under their own signal and kept 5 minutes per day (`today`), so a new span reads only its
  postings and a new day reads them again. A list's pages after the first are read at most 4 at a time. This replaces
  the pages "one after another" of the [technical spec](superpowers/specs/2026-10-30-technical-design.md) §3.3.
- **Why:** About 1.4 s of every uncached load went to the parts that do not depend on the span, and about 0.7 s to
  each page of postings read in turn.
- **Source:** Thomas, 2026-11-03; [UI polish spec](superpowers/specs/2026-11-03-ui-polish.md) §1.1

### D50: The sorter writes a refund's shop
- **Date:** 2026-11-03 · **Status:** active
- **Decision:** `set_category` may also write a deposit's shop, by setting its source to a revenue account named like
  the shop, only when the source is the revenue account `(no name)`, and may make that revenue account. A revenue
  account of a shop's name does not make a purchase's shop `name-taken`. The name rules and the lookup are D32's, in
  [`addon/DOCS.md`](../addon/DOCS.md#the-shops-name).
- **Why:** A refund imported from a bank file lands on `(no name)`, so the page counted it under "Uden butik"; the
  page already reads a deposit's shop from its revenue account. A revenue account is never a withdrawal's
  destination, so its name cannot point a purchase at a liability.
- **Source:** Thomas, 2026-11-03, [issue #96](https://github.com/thomas3650/Ha-Spending/issues/96); a new account's
  spelling taken from the shop's account of the other type: Claude

### D51: A one-month period draws its days
- **Date:** 2026-11-03 · **Status:** active; the detail's bars, the one-unit Uge, Kvartal and År periods and the name below zero superseded by D54, the month's Forskel reachable by D57, the click on a day bar by D59
- **Decision:**
  - By Måned, a period inside one calendar month draws one bar per day on the Søjler card, decided by `dayUnits` in
    `model/context.ts`; its title is "Pr. dag", with no average line. "Denne måned" draws on to the month's last day,
    the days after today as empty slots; other periods, "I år" among them, still end where they end.
  - The grouping, the hash, the key numbers, Posteringer, the detail and the chosen unit stay the month's. A click on a
    day bar chooses the month (`BarItem.choose`), and the chosen month marks every day bar.
  - A bar below zero is named with a leading "+" in its button and tooltip, unless it rounds to 0.
- **Why:** A one-month period's single bar said nothing the key numbers do not. Keeping the state the month's keeps
  every old link meaning what it meant (D20), and the month's Forskel reachable.
- **Source:** Thomas, 2026-11-03 ("let's start with all the month's days"); the controller's rulings on the click and
  the sign; [month days spec](superpowers/specs/2026-11-03-month-days.md)

### D52: "Vis alle" only in full screen
- **Date:** 2026-11-03 · **Status:** superseded by D57
- **Decision:** In the normal right card, Posteringer has no "Vis alle"; Alle posteringer is reached from the key
  numbers' links. In full screen, where the key numbers are not shown, "Vis alle" stays and keeps the search (D31, D35
  unchanged).
- **Why:** Thomas found the button unneeded beside the key number's link in the 0.11.0 walkthrough; full screen has no
  other way in.
- **Source:** Thomas, 2026-11-03; [walkthrough fixes spec](superpowers/specs/2026-11-03-walkthrough-fixes.md) §1

### D53: The key numbers have no comparisons
- **Date:** 2026-11-03 · **Status:** active
- **Decision:**
  - No key number compares. Without a chosen unit the row is the period's sum and the average per unit; with one, the
    unit's sum. No key number shows ▲, ▼, a signed percentage or red.
  - At 1024 px and wider the row has five columns, each card a fifth of the row, starting at the left, with the rest of
    the row empty. From 600 to 1023 px it has two columns, and below 600 px one column, whatever the number of cards.
  - A period with more than one unit is fetched without the unit before it. A one-unit period still gets the 12 units
    before it for its average.
  - This replaces UI spec §3 (the third key number and its rule) and §4.4 (the comparisons), and technical spec §4 (the
    comparison rules, the widened fetch and the "–" for a comparison with no data). Of D16, its third bullet and the
    comparison halves of its first and fourth bullets go; its other rules hold. D28's count of the stacked key numbers
    is superseded.
- **Why:** Thomas did not use the comparisons in the 0.11.0 walkthrough, and #118 showed "–" with a red ▲ when the
  earlier amount was 0 or less.
- **Source:** Thomas, 2026-11-03: "i dont need i, if it is needed it needs a new design" and "B but remove the eamplty
  cards"; [remove comparison spec](superpowers/specs/2026-11-03-remove-comparison.md) §1 and §2

### D54: A one-unit period draws finer bars
- **Date:** 2026-11-03 · **Status:** active; "a click on a finer bar chooses the period's unit" and its one-unit Uge, Kvartal and År periods superseded by D59
- **Decision:**
  - A period with one unit draws finer units on the Søjler card and in the detail, decided by `finerUnits` in
    `model/context.ts`: days for a week or a month, months for a quarter or a year, stepping on while there is still
    one unit, down to days. A preset that ends today ("Denne måned", "I år", "Alt") draws on to the earlier of its own
    last day and the end of its one unit, the units after today as empty slots.
  - The grouping, the hash, the key numbers and the chosen unit stay the period's. A click on a finer bar chooses the
    period's unit.
  - A bar below zero is named "+… kr. retur", and the y-axis ticks below zero have no sign.
- **Why:** One bar that fills the card says nothing the key numbers do not. Keeping the state the period's keeps every
  old link meaning what it meant (D20). The name "+200 kr." read as an addition beside an axis that wrote the same
  value with a minus.
- **Source:** Thomas, 2026-11-03, issues #100, #101 and #103;
  [finer bars spec](superpowers/specs/2026-11-03-finer-bars.md)

### D55: The trail is the overview's filter
- **Date:** 2026-11-04 · **Status:** active; the step order (the period first), "plain text" for the main group and category steps, and its Alle posteringer part superseded by D59 and D60
- **Decision:**
  - On the overview the top card's trail names the chosen unit, main group and category, in that order, whatever order
    they were chosen in. Each has a × that removes it; the × on the main group removes its category too. "Alt forbrug"
    is a link when something is chosen, and clears all three.
  - The overview has no chips for the unit and the category. While the answer loads, and on an error, the trail leaves
    out the unit's step.
  - Alle posteringer keeps its chips and its plain trail "Alt forbrug › Alle posteringer", and "+ Filter" there gets a
    section for the period's units (from 2 to 62 units). The object groups' heading there reads "Faste betalinger".
  - This supersedes UI spec §3.1's trail, §4.2's category chip at the right card's title, §4.3's list of what
    "+ Filter" adds, §4.4's unit chip at the right card's title and its "a unit is chosen from a bar only", and §5's
    trail.
- **Why:** Thomas had to find the bars to get back and wanted one filter that looks the same everywhere.
- **Source:** Thomas, 2026-11-03 and 2026-11-04; [one filter spec](superpowers/specs/2026-11-04-one-filter.md) §1 and §3

### D56: The key-number cards follow the chosen unit and are not buttons
- **Date:** 2026-11-04 · **Status:** active; "the card's link keeps the unit" superseded by D62
- **Decision:**
  - With a unit chosen, an object group's card shows the unit's payments and the bill count, labelled "<group> i
    <unit>". The set of cards stays the period's.
  - The card's link keeps the unit: Alle posteringer opens with the object group and the chosen unit as filters.
  - No key-number card is a button. Only the link can be clicked.
  - This supersedes D41's "the period's payments with the sum per month" and D42's exception "and the chosen unit".
- **Why:** A card that ignored the chosen unit contradicted the trail, and the toggle on the card was not used.
- **Source:** Thomas, 2026-11-04; [one filter spec](superpowers/specs/2026-11-04-one-filter.md) §2

### D57: No Forskel and no "Vis alle"
- **Date:** 2026-11-04 · **Status:** active; its Alle posteringer reach superseded by D60
- **Decision:**
  - The right card has no Forskel tab, and an old `card=difference` shows Søjler. Alle posteringer is reached from the
    key numbers' links only: "Vis alle" goes from Posteringer in full screen too.
  - Full screen's Posteringer has the Kategori column and its sort when the viewport is at least 600 px wide. Narrower,
    and in the normal card, it has no column and shows the default sort while the sort is by Kategori.
  - This supersedes D52, D31's and D35's way into Alle posteringer that keeps the search and the shop, D19's Forskel
    table, D51's "the month's Forskel reachable", UI spec §4.2's and §4.4's Forskel, §7's sign of the Forskel view and
    the technical spec's Forskel bars.
- **Why:** Thomas did not use the Forskel view, and full screen then needed no button that the key numbers' links
  already replace.
- **Source:** Thomas, 2026-11-03 and 2026-11-04; [one filter spec](superpowers/specs/2026-11-04-one-filter.md) §4 and §5

### D58: No phone layout
- **Date:** 2026-11-04 · **Status:** active
- **Decision:** The page is made for a computer's screen. It has no phone layout, and a problem seen only at phone
  width, such as a table that scrolls sideways at 420 px, is not fixed. The two halves still stack on a narrow page
  (D24).
- **Why:** Thomas uses the page on a computer, full screen, and phone support is not a feature the add-on offers.
- **Source:** Thomas, 2026-11-04; it closes #49, #93 and #133.

### D59: The trail holds the period, and the grouping follows it
- **Date:** 2026-11-04 · **Status:** active
- **Decision:** There is no Periode or Gruppér pr. field. The period is the trail's first chosen step and opens the
  Periode panel. At most 24 months group by Måned, longer by År. A one-unit period's finer bars are not buttons. The
  main group and category steps open lists of the circle's pieces, and a dashed button offers the next level.
- **Why:** The page said which data it shows in several places, and they could disagree. One year gives months and
  several years give years, so the grouping needs no choice.
- **Source:** Thomas, 2026-11-04; [top filter spec](superpowers/specs/2026-11-04-top-filter.md) §2. The 24-month
  limit and the finer bars without buttons are Claude's call.

### D60: One full-screen list, in the hash
- **Date:** 2026-11-04 · **Status:** active
- **Decision:** Alle posteringer goes. "N posteringer →" opens the Posteringer tab in full screen and clears the quick
  filter and the detail. Full screen is `view=full` and closes as spec §3.2 says. The sort is not in the hash.
- **Why:** Two full-screen lists had different filters, and a view in the address makes Back and a reload work.
- **Source:** Thomas, 2026-11-04; [top filter spec](superpowers/specs/2026-11-04-top-filter.md) §3. How full screen
  closes and what happens to the sort are Claude's call.

### D61: The quick filter is the search and the Beløb pill
- **Date:** 2026-11-04 · **Status:** active
- **Decision:** The Posteringer tab has the search and the Beløb pill, with the kinds Omkring, Under, Over and Mellem.
  The amount is a shared choice, in the hash as `about`, `under`, `over`, or `min` and `max`, in D47's number format.
- **Why:** The quick filter finds postings and never changes the key numbers, the circle or the bars. Thomas chose the
  pill from the mockups.
- **Source:** Thomas, 2026-11-04; [top filter spec](superpowers/specs/2026-11-04-top-filter.md) §4. Omkring's rounding
  is Claude's call.

### D62: The object-group links open the Faste udgifter tab
- **Date:** 2026-11-04 · **Status:** active
- **Decision:** The link under each object-group key number reads "Vis faste udgifter →" and opens the Faste udgifter
  tab in the normal card. The object-group filter (`og`) goes.
- **Why:** Fixed payments are seen under their own tab, not as a filter of the postings.
- **Source:** Thomas, 2026-11-04; [top filter spec](superpowers/specs/2026-11-04-top-filter.md) §5. The text and the
  normal card are Claude's call.

### D63: A fixed expense has risen from 1 kr., and its amount is the latest payment
- **Date:** 2026-11-04 · **Status:** active
- **Decision:**
  - A payment at least 1 kr. above the range's top is a rise, "Steget". A smaller difference is no rise.
  - Whole kroner show the rise on the page. No amount in Faste udgifter has øre.
  - When the latest payment is a rise, it is the amount per payment. The amount per year, the group sums and the
    detail count from it.
  - This changes subscriptions spec §1.2, §2.1 and §2.3, and supersedes UI polish spec §5.4.
- **Why:** A rise of a few øre showed as a whole krone, or needed øre, and the Beløb column disagreed with
  the status.
- **Source:** Claude, 2026-11-04, under the controller session's brief, and the
  [small walkthrough fixes spec](superpowers/specs/2026-11-04-walkthrough-small-fixes.md) §1

### D64: A due payment says Forfalden
- **Date:** 2026-11-04 · **Status:** active
- **Decision:**
  - A Forventes whose date is before today reads "Forfalden {date}". On today and later it reads "Forventes {date}".
  - Such a row shows no "næste {date}" under its name.
  - The status keeps its kind, colour and place in the order.
  - This changes subscriptions spec §2.3 and UI polish spec §5.5.
- **Why:** "Forventes" with a past date read like a mistake.
- **Source:** Claude, 2026-11-04, under the controller session's brief, and the
  [small walkthrough fixes spec](superpowers/specs/2026-11-04-walkthrough-small-fixes.md) §5

### D65: A share above zero reads < 1 %
- **Date:** 2026-11-04 · **Status:** active
- **Decision:**
  - A share that rounds to 0 % while the amount is not 0 reads "< 1 %". A share of exactly 0 reads "0 %".
  - When the base's total is not above zero, a shop shows no share.
  - This changes top-shops spec §2.
- **Why:** "0 %" beside a real amount read as nothing.
- **Source:** Claude, 2026-11-04, under the controller session's brief, and the
  [small walkthrough fixes spec](superpowers/specs/2026-11-04-walkthrough-small-fixes.md) §7

### D67: The bars fill the window's height in full screen
- **Date:** 2026-11-04 · **Status:** active
- **Decision:** In full screen the Søjler chart grows so the page reaches the window's bottom edge, and it is never
  shorter than 400 px. The normal card keeps 400 px.
- **Why:** At full-screen width the chart filled only a third of the screen (#152).
- **Source:** Thomas, 2026-11-04;
  [full-screen bars spec](superpowers/specs/2026-11-04-full-screen-bars-and-follow-ups.md) §1. The height rule is
  Claude's call.
