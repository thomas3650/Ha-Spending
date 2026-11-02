# The detail of a fixed expense, a subscription or a shop – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [detail view spec](../specs/2026-11-02-detail-view.md), in one PR that closes #76.

**Architecture:** the server adds the bill's id to `Posting.subscription`. The page gains a pure model
`model/detail.ts` that turns a detail key into what the panel shows, a `detail` field in the view state and the hash,
a component `<hs-detail>`, row buttons in `<hs-postings>` and `<hs-subscriptions>` that fire `detail-open`, and
layouts in `screens/overview.ts` and `screens/all-postings.ts`: the right card's body replaced on the normal page, and a
split list and detail in full screen and on Alle posteringer. `app.ts` keeps the history marks, the focus and Escape.

**Tech stack:** TypeScript; Hono on Node; Lit with Vitest, happy-dom and Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-02-detail-view.md`](../specs/2026-11-02-detail-view.md). Every task reads
its sections there; the plan does not repeat them. The mockups are in
[`docs/mockups/v5/`](../../mockups/v5/detalje.html); where they differ from the spec, the spec holds (spec §8).

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- No write to Firefly III. No new dependency. No new route. Tests and subagents never touch `local/`.
- Names, exactly:
  - Shared (`addon/shared/src/types.ts`): `Posting.subscription: { id: string; name: string; objectGroup: string } |
    null`.
  - `state/view.ts`: `export type DetailKey = { kind: "subscription"; id: string } | { kind: "posting"; id: string }`;
    `ViewState.detail: DetailKey | null`, default `null`; hash key `detail`, values `s:<id>` and `p:<id>`, written
    last by `toHash`.
  - `state/actions.ts`: `openDetail(s: ViewState, key: DetailKey): ViewState`, `closeDetail(s: ViewState): ViewState`,
    `detailResolves(s: ViewState, data: SpendingData, today: string): boolean`,
    `keepDetail(prev: ViewState, next: ViewState): ViewState` (returns `next` with `detail: null` when its `card` or
    `screen` differs from `prev`'s, else `next`); `normalise` sets `detail: null` when `detailResolves` is false.
    `app.ts`'s `apply` runs every user action's result through `keepDetail`, so `setCard`, `toggleSubscriptions`,
    `chooseUnit` (which shows Posteringer), `openShop` and the screen changes close a detail without each action
    knowing about it. The three links whose `href` is built from an action, which reach the state through
    `hashchange` and not through `apply`, build it as `toHash(keepDetail(state, action(state)))`: the first key
    number's (`openAllPostingsFresh`, `app.ts`), each object group's "N posteringer →" (`openObjectGroupPostings`,
    `app.ts`) and the trail's (`trailLevel`, `components/top-card.ts`).
  - `model/detail.ts`: `DetailView`, `DetailRow`, `DetailBar`, `DetailBox`, `detailView(key: DetailKey, ctx:
    ViewContext): DetailView | null` (Task 2).
  - Events (bubbling, composed, through `fire` in `components/chip.ts`): `detail-open` (detail a `DetailKey`) from the
    row buttons; `detail-close` (no detail) from `<hs-detail>`'s "Luk" and the "←" button.
  - `<hs-detail>` (`components/detail.ts`, styles exported as `detailStyles`) takes `view: DetailView` and `closable:
    boolean` (true in the split, where it shows "Luk"; false on the normal page, where the card's "←" closes).
  - `da` gains, exactly: `backTo: (title: string) => \`Tilbage til ${title}\``, `close: "Luk"`,
    `shopContext: "Butik"`, `inPeriod: (range: string) => \`I perioden · ${range}\``,
    `detailPer: (g: Grouping) => \`Pr. ${da.groupings[g].one} i perioden\``,
    `noDetailRows: "Ingen posteringer i perioden"`, `openInFirefly: "Åbn i Firefly III"`, `noAccount: "–"`.
  - `format.ts` gains `detailAmount(ore: number): string` (to the øre, spending positive, a refund with a minus:
    `"2.480,00 kr."`, `"-150,00 kr."`) for the head and the rows, and `detailKr(ore: number): string` (whole kroner,
    the same sign rule: `"5.140 kr."`, `"-150 kr."`) for the boxes and the bars' labels. `kr` drops the sign and
    `postingAmount` has the opposite one, so neither is used in the detail. The
    rest reuses `da.subscriptionColumns.perYear` ("Om året"), `da.columns.account` ("Konto"), `da.columns.category`
    ("Kategori"), `da.showAllShops(n)` ("Vis alle N"), `da.showFewer`, `count(n)` ("N posteringer"), `kr`,
    `rangeText`, `tableDate`.

## Review focus

1. **Back after closing** never reopens the detail, and closing after a later choice (a piece of the circle, the
   period) keeps that choice. Test in Task 3.
2. **A shared link with `detail`** for a posting outside the period or on an unticked account opens no detail and
   breaks nothing. Test in Task 3.
3. **A refund in a shop's or a subscription's rows** lowers the sum, counts as a row, and reads with a minus in the head
   and the row alike. Test in Task 2 and Task 4.
4. **The keyboard alone** opens a detail, lands on its heading, closes it with Escape and comes back to the row's
   button. Test in Task 4.
5. **Below 1024 px** the detail takes the list's place, never both squeezed side by side, and the page does not
   scroll sideways. Chrome check at 1000 and 420 px, after the branch review.

---

## Task 1: The bill's id on a posting

Model: sonnet · Review: yes

**Files:** modify `addon/shared/src/types.ts`, `addon/server/src/firefly/subscriptions.ts` (`subscriptionLinks`),
`addon/server/test/subscriptions.test.ts` (or the test that covers `subscriptionLinks` today; find it with
`grep -rn subscriptionLinks addon/server/test`), `addon/server/test-integration/firefly.test.ts`,
`addon/web/test/fixture.ts` (the Pizzeria Roma link gains the id of the fixture's Pizzaabonnement in `SUBSCRIPTIONS`;
read it there), and any other place `lint` flags.

**Produces:** `Posting.subscription.id`, the bill's id as Firefly III gives it (spec §4).

- [ ] **Step 1: Write the failing tests.** Server: `"a posting linked to a bill with an object group carries the
  bill's id, name and object group"`, and `"a posting whose bill has no object group carries null"` (extend the
  existing link test). Integration (`firefly.test.ts`, `"gives the same bill links on postings as the fake does, ids
  apart"`): `links()` maps `subscription` to `{ name, objectGroup }` only; a new assertion that every posting's
  `subscription.id` is the `id` of the subscription in `actual.subscriptions` with the same name, for those whose
  bill is kept.
- [ ] **Step 2: Run** `npm test --workspace server` in `addon/`. Expected: the new unit test fails.
- [ ] **Step 3: Implement.** `subscriptionLinks` stores `{ id: bill.id, name, objectGroup }`.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Expected: all pass. The integration
  test runs only under `scripts/integration` (Docker); run it when Docker is up, else say in the report that it was
  type-checked only.
- [ ] **Step 5: Commit** `feat(server): a posting's subscription carries the bill's id`.

---

## Task 2: The detail's model

Model: opus · Review: yes

**Files:** create `addon/web/src/model/detail.ts`, `addon/web/test/detail-model.test.ts`; modify `state/view.ts`
(only the `DetailKey` type, so the model can import it), `i18n/da.ts`, `format.ts`, `addon/web/test/format.test.ts`.

**Consumes:** Task 1's `subscription.id`.

**Produces:**

```ts
export interface DetailBox { label: string; value: string; count?: string } // count: "4 posteringer"
export interface DetailBar { name: string; amount: number; label: string } // øre net; label: "<unit>: <kr>"
export interface DetailRow { id: string; date: string; account: string; amount: string; marked: boolean }
export interface DetailView {
  kind: "subscription" | "shop";
  key: DetailKey; // what opened it, for the row marks and the focus
  context: string;
  title: string;
  amount: string;
  status: { kind: SubscriptionStatus["kind"]; text: string } | null; // subscription only
  aside: string | null; // shop only: the date and, with a shop, the bank's text
  boxes: [DetailBox, DetailBox, DetailBox];
  per: string; // da.detailPer(grouping)
  bars: DetailBar[]; // one per ctx.units entry, in order; amount ≤ 0 draws no bar
  rows: DetailRow[]; // newest first, all of them; the component shows 10 and "Vis alle N"
  href: string | null;
}
export function detailView(key: DetailKey, ctx: ViewContext): DetailView | null;
```

- The span is `ctx.timeline.period`, never `ctx.chosen`; the rows come from `ctx.postings` (the ticked accounts, every
  level) within it (spec §3).
- `p:<id>` with a `subscription` whose id is in `ctx.data.subscriptions` gives the subscription's view with that
  posting's row marked; otherwise the shop's view (by `shop`, or by `text` when `shop` is null), with that row marked.
  `s:<id>` gives the subscription's view with no row marked. An id that is not found gives `null`.
- Subscription: `context`, `amount` and `status` as spec §2.1, reusing the Faste udgifter row's amount and status texts
  (factor them out of `model/subscriptions.ts` rather than copying them); `href` as that row's. Shop: `context` is
  `da.shopContext`, `amount` the clicked posting's, `aside` its `tableDate` and, when it has a shop, its `text`;
  `href` the posting's link as `model/postings.ts` builds it.
- Every amount follows spec §2.6 through `detailAmount` (head, rows) and `detailKr` (boxes, bars).
- The first box: `label` `da.inPeriod(rangeText(period))`, `value` `detailKr(net)`, `count` `count(rows.length)`. The others
  as spec §2.2, with `da.noAccount` and `da.noCategory`.

- [ ] **Step 1: Write the failing tests** in `detail-model.test.ts`, through `viewContext(answer, state, today)` with
  the fixture and small made-up answers:
  - `"a subscription's rows are its postings in the period on the ticked accounts"`, and `"not narrowed by the level,
    a chosen unit, the search, the shop, the amount or the object group"` (the same rows with each set);
  - `"the sum is net: a refund lowers it, counts as a row and reads with a minus"`;
  - `"a shop's rows are those with the same shop"`; `"a posting with no shop gives the rows with no shop and the same
    text"` (fixture: Kiosken);
  - `"p: of a linked posting gives the subscription with that row marked"`; `"p: whose bill is not in subscriptions
    gives the shop"`; `"s: marks no row"`; `"an unknown id gives null"`;
  - `"one bar per unit of the period, none drawn at zero or below"` (month and week groupings; the bars' labels);
  - `"the context line: main group · object group, Uden hovedgruppe, and only the object group with no last payment"`;
  - `"Konto is – with no last payment, and Kategori is Uden kategori for a posting with none"`;
  - `"the head's amount and the marked row read the same for one posting"`;
  - `format.test.ts`: `"detailAmount writes øre, spending positive and a refund with a minus"` (`248000` →
    `"2.480,00 kr."`, `-15000` → `"-150,00 kr."`); `"detailKr writes whole kroner with the same sign"` (`514000` →
    `"5.140 kr."`, `-15000` → `"-150 kr."`);
  - `"href is the bill for a subscription and the posting for a shop, and null without fireflyLinkUrl"`.
- [ ] **Step 2: Run** `npm test --workspace web` in `addon/`. Expected: the new tests fail.
- [ ] **Step 3: Implement** `detailView` and the `da` texts of Global constraints.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): the model of a fixed expense's, a subscription's or a shop's detail`.

---

## Task 3: The detail in the view state, the hash and the history

Model: opus · Review: yes

**Files:** modify `state/view.ts`, `state/actions.ts`, `app.ts`; tests in `addon/web/test/view.test.ts`,
`actions.test.ts`, and a new `addon/web/test/detail-history.test.ts` (through `mount`).

**Consumes:** `DetailKey` (Task 2).

- `parseHash` reads `detail`: `s:` or `p:` followed by a non-empty id, else `null`. `toHash` writes it last. Update
  `toHash`'s comment to name D44.
- `detailResolves` is spec §5's "Where it resolves", on the raw data: the period from `periodOf`, the ticked accounts
  from the state. `normalise` drops what does not resolve.
- `app.ts`:
  - `apply(next, mode)` stays for every other choice, passes `next` through `keepDetail(this.state, next)`, and
    writes `history.state` `null`.
  - `openDetail` from `detail-open`: when no detail is open, `pushState({ detail: true }, …)`; when one is open,
    `replaceState({ detail: true }, …)` only if `history.state?.detail === true`, else `replaceState(null, …)`.
  - `detail-close`, and Escape when a detail is open: when `history.state?.detail === true`, `history.back()`;
    otherwise `replaceState(null, …)` with `closeDetail(this.state)`.
  - `onKey`: Escape closes an open detail first (both screens); only with no detail open does it leave full screen.
    The dropdowns and the suggestions already stop their Escape; keep it so.
- The panel and the row buttons come in Task 4, so this task's page tests open a detail by dispatching `detail-open`
  (a bubbling `CustomEvent` with a `DetailKey`) on the app element, close it with `detail-close` or an Escape
  `keydown` on `window`, and read `location.hash` and `history.length`.

- [ ] **Step 1: Write the failing tests.**
  - `view.test.ts`: `"detail round-trips and is written last"` (`card=subscriptions&detail=s%3Ab1`, and with
    `view=all-postings`); `"a bad detail is left out"` (`detail=x:1`, `detail=s:`, `detail=`).
  - `actions.test.ts`: `"normalise keeps a detail that resolves"` for each case of spec §5; `"and drops it"` for: an
    unknown id; `s:` with `card=postings`; `p:` with `card=bars`, `difference` and `shops`; `p:` of an unlinked
    posting with `card=subscriptions`; a posting before the period; a posting on an unticked account. `"keepDetail
    closes the detail when the card or the screen changes"` (through `setCard`, `toggleSubscriptions`, `chooseUnit`
    from another card, `openAllPostings`, `openShop`); `"the period, the accounts, the level, the unit, the search and
    the sort keep it"`.
  - `detail-history.test.ts`: `"open, then Back, shows the list"`; `"two rows then Back shows the list"`; `"open,
    close, then Back does not reopen it"`; `"open, change the level, then close: the level stays and the detail is
    closed"`; `"a detail from a reload closes by replacing"` (mount with `detail` in the hash, close, `history.length`
    unchanged); `"Escape closes the detail and not full screen, and a second Escape leaves full screen"`;
    `"Escape with the period dropdown open, or the search's suggestions open, closes only that and keeps the
    detail"`; `"the first key number's link, an object group's N posteringer link and the trail back from Alle
    posteringer each leave no detail in the hash"` (three cases; follow each `href` with a `p:` detail open).
- [ ] **Step 2: Run** `npm test --workspace web`. Expected: the new tests fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): the open detail is in the hash and the history`.

---

## Task 4: The detail panel and the normal page

Model: opus · Review: yes

**Files:** create `addon/web/src/components/detail.ts`, `addon/web/test/detail.test.ts`; modify
`components/postings.ts`, `components/subscriptions.ts`, `screens/overview.ts`, `app.ts` (styles, events, focus),
`model/postings.ts` and `model/subscriptions.ts` if a row field becomes unused; update the existing tests that click a
row's Firefly link (`postings.test.ts`, `subscriptions.test.ts`, `all-postings.test.ts`).

**Consumes:** Tasks 2 and 3.

- `<hs-detail>` renders spec §2 from `DetailView`: the context line, the name as `h3` with `tabindex="-1"`, the
  amount with the status (as the Faste udgifter table's status pill) or the aside; three boxes; `per` and the bars as a
  `role="list"` of items whose accessible text is the bar's `label` (plain elements sized by CSS, not ECharts; heights
  against the biggest positive amount); the rows as a table, the marked one `aria-current="true"`; at most 10 rows
  with `da.showAllShops(n)` and `da.showFewer` kept in the component; `noDetailRows` when there are none; the link
  `da.openInFirefly` with an `aria-hidden` "↗" (`target="_blank" rel="noopener noreferrer"`) when `href` is set;
  `da.close` ("Luk") at the top right when `closable`. When `view.key`'s `kind` or `id` differs from the last one
  (compare the two fields, never the object, since `parseHash` makes a new key on every hash change), it resets "Vis
  alle" and focuses its `h3`.
- Row buttons: in `<hs-postings>` and `<hs-subscriptions>`, the shown name becomes a `<button type="button">` (accessible
  name the name); one click handler on the row fires `detail-open` once, with `{ kind: "posting", id }` or
  `{ kind: "subscription", id }`, whether the click lands on the button or elsewhere on the row. The Firefly link
  on the row goes. The object-group pill stays. The lists take a
  `marked: DetailKey | null` and set `aria-current="true"` on that row.
- The normal page (`fullScreen` false): when `detailView(state.detail, ctx)` is not null, the right card's body is
  `<hs-detail .closable=${false}>`; the head shows before the `h2` a button "←" with `aria-label` `da.backTo(title)`
  firing `detail-close`, hides `chips()`, and keeps the switch and the full-screen button.
- Focus after a close: `app.ts` remembers the key that was open; after the render it focuses the row button for that
  key when shown (find it by a `data-detail` attribute on the button holding `s:<id>` or `p:<id>`), else the right
  card's `h2` (give it `tabindex="-1"`) or Alle posteringer's heading.
- At 420 px the normal page needs nothing new: the detail is the card's body.

- [ ] **Step 1: Write the failing tests** in `detail.test.ts`, through `mount` with the fixture and
  `withSubscriptions`:
  - `"a Faste udgifter row opens its detail and the focus is on its heading"`; the heading, the context line, the
    status, the three boxes' texts and the rows;
  - `"Tilbage til Faste udgifter closes it and the focus is back on the row's button"`;
  - `"a Posteringer row of a linked posting opens the subscription, with the row marked"`;
  - `"another posting opens its shop; Kiosken opens the rows with no shop and its text"`;
  - `"a refund reads with a minus in the head and in its row"`;
  - `"the bars' text alternatives name each unit and its sum"`;
  - `"10 rows and Vis alle N, then Vis færre"` (a made-up answer with 12 postings at one shop);
  - `"Ingen posteringer i perioden"` for a subscription not paid in the period, and 0 kr. in the first box;
  - `"Konto reads – with no last payment"`;
  - `"Åbn i Firefly III links the bill or the posting, and is absent without fireflyLinkUrl"`;
  - `"the keyboard alone: Enter on a row's button opens, Escape closes, the focus is back on the button"`;
  - `"the period and the accounts change the sums; the search does not"`.
- [ ] **Step 2: Run** `npm test --workspace web`. Expected: the new tests fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): a click on a fixed expense or a posting shows its detail`.

---

## Task 5: The split in full screen and on Alle posteringer

Model: opus · Review: yes

**Files:** modify `screens/overview.ts`, `screens/all-postings.ts`, `components/subscriptions.ts` (the object-group
sums, today inside `<hs-subscriptions>`, render apart from the table, so the overview can place them above the split),
`app.ts` (styles); tests in
`addon/web/test/detail.test.ts`, `full-screen.test.ts`, `all-postings.test.ts`.

**Consumes:** Task 4.

- One layout helper (a small function or a `.detail-split` class pair, the builder's choice) used by both screens:
  the rows above the list keep the whole width; under them a two-column grid, the list about 60 %, a 1 px line
  `var(--hs-line)` between, no border on the detail; `<hs-detail .closable=${true}>` on the right. With no detail the
  list takes the whole width as today.
- Full screen on the overview: Faste udgifter's sums, and Posteringer's search row and summary, stay above the split.
- Alle posteringer: the search row and the chips row stay above the split.
- At `max-width: 1023px`, where the halves stack (D24, `app.ts`), an open detail hides the list column and takes
  the whole width; a four-column table does not fit beside it below that.

- [ ] **Step 1: Write the failing tests:**
  - `full-screen.test.ts`: `"in full screen the list and the detail are both shown, the row is aria-current, another
    row changes the detail, and Luk closes it"`; `"turning full screen off and on keeps the detail"`.
  - `all-postings.test.ts`: `"a row splits Alle posteringer into the list and the detail, and Luk closes it"`;
    `"the search and the chips stay while the detail is open"`.
- [ ] **Step 2: Run** `npm test --workspace web`. Expected: the new tests fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): full screen and Alle posteringer split into the list and the detail`.

---

## Task 6: The docs and the Chrome check

Model: sonnet · Review: no

**Files:** `docs/decisions.md`, `docs/domain-language.md`, `docs/architecture.md`, `addon/DOCS.md`,
`addon/translations/en.yaml`, `addon/translations/da.yaml`, `docs/mockups/README.md`, `docs/testing.md`,
`docs/README.md`.

Each change as spec §7 lists it. D44 in the decision log's format (`docs/way-of-working.md` §5), dated 2026-11-02,
source "Claude, 2026-11-02, `docs/superpowers/specs/2026-11-02-detail-view.md` §5"; D20's status line
becomes `active; key list superseded by D35, D42 and D44`, nothing else in D20. The mockups README gains a section
"Detail" for `v5/` in the style of its other sections. `docs/README.md` adds the spec and this plan to its two lists.

- [ ] **Step 1: Edit the docs.**
- [ ] **Step 2: Run** `node scripts/check-links.mjs` in the repo root. Expected: no broken link.
- [ ] **Step 3: Commit** `docs: the detail of a fixed expense, a subscription or a shop`.

The Chrome check itself (spec §6) is run by the controller after the branch review, in the fast loop.
