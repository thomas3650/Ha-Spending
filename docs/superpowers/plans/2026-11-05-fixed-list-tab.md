# The fixed-expenses list as a tab in the view, ended fixed expenses, and one top bar – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [fixed list tab spec](../specs/2026-11-05-fixed-list-tab.md), in one PR that closes #179.

**Architecture:** the server keeps a bill that ended inside the asked range. The shared package gets the due dates
between two days and the status of a bill in a past time. The page's model builds the tab's rows for "the tab's
time", and the key numbers count them. The view state gets one field and one hash key. The list moves from the
overview into the fixed-expenses view's right card, and the top bar loses its ← for an "Alt forbrug" link. No new
route, option or runtime dependency.

**Tech stack:** TypeScript; Hono on Node; Lit with Vitest, happy-dom and Testing Library; ECharts behind the chart
mock.

**Approved:** by Claude, 2026-11-05, after `reviewer` rated it Ready.

**Spec:** [`docs/superpowers/specs/2026-11-05-fixed-list-tab.md`](../specs/2026-11-05-fixed-list-tab.md). Every task
reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name, description and text; made-up data; English code;
  Danish only in `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass at every commit; `node scripts/check-links.mjs` in
  the repo root. The task order keeps every commit green: the view's tab is built (Task 5) before the overview's tab
  and the `"subscriptions"` card go (Task 6).
- The web fixture (`addon/web/test/fixture.ts`) is not changed. Tests make their own bills, as `fixed-view.test.ts`
  does with `bill(…)`, and set `today` the way the file they join does.
- Tests do not read the chart's options ([D68](../../decisions.md)).
- Every new Danish text goes in `da.ts` and is used from there, in code and tests.
- An existing test that a task changes on purpose is named in the task and in its report. A test whose meaning
  turns round is renamed to say what it checks now.
- "Today" in the model is `ctx.data.today`, the answer's today, as `model/subscriptions.ts` uses it. The units and the
  span use `ctx.today`, as `fixedUnits` does now.
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. One count: the key number's "X stk.", the object-group step's count and the tab's rows come from one function and
   one time, also when the overview's units end today and the view's run to 31 December (Tasks 3 and 6, spec §5).
2. The past status: matching windows, "not judged" at the fetched range's edges, Sluttet only at or after the end, and
   the "Poster i perioden" agreement for an ended bill in a time that holds today (Task 2, spec §3.4).
3. History: a tab change with a detail open leaves no detail entry. "Alt forbrug" from a detail over full screen over
   the view goes back three entries in one click, and replaces when any entry since the open is unmarked (Tasks 5 and
   7, spec §3.1, §6.1).
4. The old `card=subscriptions` hash: each row of spec §2.1's table, and no state keeps a card that is gone (Task 6).
5. The greyed parts on Til overs are reachable by Tab, do not open, and carry their description (Task 7, spec §6.2).

---

## Task 1: The server keeps a bill that ended in the range, and the fast loop has three such bills

Model: sonnet · Review: yes

**Spec:** §4.1, §7 (the fake's three bills).

**Files:** modify `addon/server/src/firefly/subscriptions.ts` (`keepSubscriptions`), `addon/server/src/firefly/read.ts`
(its call), `addon/dev/src/generate.ts`; tests in `addon/server/test/subscriptions.test.ts` and
`addon/dev/test/generate.test.ts`.

**Interfaces:**

- Produces: `keepSubscriptions(raw: RawSubscription[], mainGroupOf: (category: string | null) => string | null,
  excluded: ReadonlySet<string>, today: string, rangeStart: string, warn: (message: string) => void): Subscription[]`.
  A bill is left out when `!active`, or when `end !== null && end < today && end < rangeStart`. `read.ts` passes
  `range.start`.
- Produces, in `generateSeed` (all dates from `options.today`; payments through `withdrawal(…)`, so none after today):
  - `Avisabonnement`, monthly, `Faste udgifter`, 149.00 kr., category `Streaming`, from the seed's first month. Its end
    is the last day of the month two months before today's month. Payments monthly on the 1st up to the end.
  - `Tidsskrift`, monthly, `Abonnementer`, 89.00 kr., category `Streaming`, from the seed's first month. Its end is the
    15th of the month before today's month. Payments monthly on the 3rd up to the end.
  - `Vejhjælp`, yearly, `Faste udgifter`, 1195.00 kr., category `Forsikring`. It starts, and is paid once, on the
    10th of the month five months before today's month.
  - In January and February the first bill's end falls in the year before. Claude's call: the dates stay relative,
    so the seed stays one rule. The Chrome check runs in the current month, where the spec's cases hold from March.

- [ ] Write the failing tests in `subscriptions.test.ts`, `describe("keepSubscriptions")`, with `today` 2026-10-30
  and range start 2026-01-01 through the `keep` helper (which gets the range start):
  - `keeps a bill that ended before today on or after the range's start` (end 2026-05-31; and end 2026-01-01);
  - `leaves out a bill that ended before the range's start` (end 2025-12-31);
  - `leaves out an inactive bill, with or without an end date`.
- [ ] Change on purpose, and name in the report: "keeps the subscriptions §3 keeps, by name" gets `Gammel forsikring`
  (it ends 2026-10-29, after R1's start); "leaves out inactive, ended, saved and liability-paid subscriptions" becomes
  `leaves out inactive, saved and liability-paid subscriptions` without `Gammel forsikring`. Add a test over the fake:
  with `?start=2026-10-30&end=…`, `Gammel forsikring` is left out.
- [ ] Write the failing test in `generate.test.ts` (today 2026-10-30): `has a bill that ended at a month's end, one
  that ended mid-month, and a yearly one paid earlier this year`. Assert `Avisabonnement` ends 2026-08-31 with its
  last payment on or before that date, and `Tidsskrift` ends 2026-09-15. Assert `Vejhjælp` repeats yearly and has
  one payment, on 2026-05-10.
- [ ] Run them and see them fail; implement; gates pass.
- [ ] Commit `feat: the server keeps a fixed expense that ended in the asked range`.

## Task 2: The due dates between two days and the status in a time

Model: opus · Review: yes

**Spec:** §3.4 (all of it), §4.2 ("One status in both lists").

**Files:** modify `addon/shared/src/subscriptions.ts`; tests in `addon/shared/test/subscriptions.test.ts`.

**Interfaces:**

- Produces `dueDatesBetween(s: Subscription, from: string, to: string): string[]`. These are the due dates
  `dueDate(s, k)` from k = 0 with `from ≤ date ≤ to`, and `date ≤ s.end` when there is an end.
- Produces `type TimeStatus = SubscriptionStatus | { kind: "next"; date: string } | { kind: "ended"; end: string }`.
- Produces `statusInTime(s: Subscription, payments: readonly { date: string; amount: number }[], time: Period,
  fetched: Period, today: string): TimeStatus`:
  - `payments` are the bill's linked postings. Only `amount > 0` is a payment. A refund is negative in `Posting`
    (`shared/src/types.ts:17`).
  - When `time.end >= today`: if `s.end !== null && s.end < today && nextDate(s, today) === null`, it returns
    `{ kind: "ended", end: s.end }`. Otherwise it returns `subscriptionStatus(s, today)`.
  - When `time.end < today`, the past table applies. The dates are `dueDatesBetween(s, time.start, time.end)`. Each
    date's window is `[due − early, due + late]` from the private `days(repeat)`.
    - A date is met when a payment lies in its window.
    - Otherwise it is open when `due + late >= today`.
    - Otherwise it is not judged when its window starts before `fetched.start` or ends after `fetched.end`. A
      not-judged date is dropped.
    - Otherwise it is missed.
  - The past status, in order:
    - any missed date: `{ kind: "notSeen", expected: <the first missed date> }`;
    - any open date: `{ kind: "expected", date: <the first open date> }`;
    - any date at all: `{ kind: "paid", date: <the latest met payment's date> }`;
    - no date: `{ kind: "next", date: <the first of dueDatesBetween(s, time.end + 1 day, time.end + 25 months)> }`.
  - When the bill has ended (`s.end !== null && s.end <= time.end`), a `paid` or a `next` (or no next date at all)
    becomes `{ kind: "ended", end: s.end }`.
- No `risen` in a past time: the past table never returns it.

- [ ] Write the failing tests, one per spec §7 §3.4 case. Use made-up bills and `today` 2026-11-05.
  - `dueDatesBetween`:
    - `lists the monthly dates between two days, counting from the start` (start 2025-01-31: 2026-02-28, 2026-03-31);
    - `stops at the end date`;
    - `steps weekly with a skip`.
  - `statusInTime`, with a past month (January 2026, fetched range 2025-01-01 to today):
    - `a past month with every due date met reads paid with the latest met payment's date`;
    - `a payment a few days early, in the month before, meets the due date` (due 1 Feb, paid 27 Jan, time February);
    - `a payment a few days late, in the next month, meets the due date` (due 30 Jan, paid 3 Feb);
    - `a missed due date reads notSeen`;
    - `a weekly bill with three payments for four due dates reads notSeen`;
    - `an open due date reads expected, before today as well` (time October 2026 seen on 2 November, due 31 October);
    - `a yearly bill with no due date in the time reads next with its next due date`;
    - `a refund alone does not meet a due date`;
    - `has no risen in a past time` (a last payment above the max, all met: paid);
    - `an ended bill reads paid in a month before its end and ended in its last month` (end 2026-05-31; April paid;
      May ended `2026-05-31`);
    - `a bill due 1 January, paid in late December, with the fetched range from 1 January: January's date is not
      judged, so January reads next 1 February`;
  - `statusInTime`, with a time that holds today (I år to 31 December):
    - `a time that holds today reads today's status` (equal to `subscriptionStatus`);
    - `an ended bill reads ended, or today's status while nextDate still gives its last due date`. Use two bills ended
      on 2026-10-15: one with its last due date unpaid (equal to `subscriptionStatus`), and one paid (ended).
- [ ] Run them and see them fail; implement; gates pass.
- [ ] Commit `feat: a fixed expense's due dates between two days and its status in a time`.

## Task 3: The tab's rows, its sums, its statuses and one "X stk."

Model: opus · Review: yes

**Spec:** §3.2, §3.3, §3.4 (the row and the sort), §4.2, §5.

**Files:** modify `addon/web/src/model/fixed.ts`, `addon/web/src/model/subscriptions.ts`,
`addon/web/src/model/key-numbers.ts`, `addon/web/src/model/detail.ts`, `addon/web/src/components/subscriptions.ts` (the
greyed Om året and the two new status classes), `addon/web/src/i18n/da.ts`; tests in
`addon/web/test/subscriptions.test.ts` (model describes), `fixed-model.test.ts`, `key-numbers.test.ts`,
`detail-model.test.ts`.

**Interfaces:**

- Consumes: `statusInTime`, `TimeStatus` (Task 2).
- Produces, in `model/fixed.ts`, `tabTime(data: Pick<SpendingData, "earliestPostingDate">, state: ViewState, today:
  string): Period`. Let `f = fixedUnits(data, state, today)`. When `f.buttons` holds and a unit has
  `fullStart === state.unit`, it returns that unit's `{ start, end }`. Otherwise it returns `f.span`. Every caller
  below uses this function, on the overview too. That is what makes the overview's and the view's counts one number.
- Produces, in `model/subscriptions.ts`:
  - `ranIn(s: Subscription, time: Period): boolean`, which is `s.start <= time.end && (s.end === null || s.end >=
    time.start)`;
  - `interface TabRow { subscription: Subscription; next: string | null; status: TimeStatus; inSum: boolean }`;
  - `tabRows(ctx: ViewContext): TabRow[]`. It filters by the level and Konti as `shown` does, by `ranIn` over `tabTime`,
    and by `ctx.state.objectGroup` when the view has one. It takes the payments from `ctx.postings` by
    `subscription.id`, and the fetched range from `ctx.data.range`. `inSum` is `end === null || end >= min(time.end,
    today)`. It sorts by `STATUS_ORDER` (`notSeen 0, risen 1, expected 2, paid 3, next 4, ended 5`), then by the
    status's date (`next` for today's statuses; `date` for `next`; `end` for `ended`), then by name;
  - `shown(ctx)` stays. It holds today's statuses for `fixedPayments`, so "Poster i perioden" is unchanged.
  - `subscriptionTable(ctx, sort)` builds its rows from `tabRows`. `SubscriptionRow` gets `notInSum: string | null`,
    which is `da.notInSum(shortDate(end))` for a row left out of the sums and `null` otherwise. The object-group sums
    and the group sums skip such rows, and a group's count counts every row. `next` is `null` when the status
    carries a date: `notSeen`, a due `expected`, `next` or `ended`.
  - `statusCell(status: TimeStatus, today: string)`: `next` gives `da.status.next(date)` and `ended` gives
    `da.status.ended(end)`, both written with `shortDate`. `SubscriptionRow.status.kind` becomes
    `TimeStatus["kind"]`.
- Produces, in `model/key-numbers.ts`:
  - `objectGroupNames(ctx)` takes the groups of `ctx.data.subscriptions` that `ranIn` the tab's time of the period
    (`tabTime` with `unit: null`), plus the groups on the period's linked postings. Claude's call: the set of cards is
    the period's, as it is now; only the counts follow a unit.
  - `objectGroupCards` counts `tabRows` of a context with `objectGroup: null`, filtered to the card's group. Its line
    follows spec §5's table, with "some payments" meaning at least one linked posting in the counted span. Row 2 is
    `da.noPaymentsCount(n)`. Row 3 is `da.perMonth(…)`, or `""` in a unit or when the average is null.
- Produces, in `model/fixed.ts`: `objectGroupRows` counts the same way (`tabRows` with `objectGroup` set to the row's
  group, `null` for Alle).
- Produces, in `model/detail.ts`: `detailView(key: DetailKey, ctx: ViewContext, status: TimeStatus | null = null)`. A
  given status replaces today's in a bill's detail.
- Produces, in `da.ts`:
  - under `status`: `next: (date: string) => "Næste <date>"` and `ended: (date: string) => "Sluttet <date>"`;
  - top level: `notInSum: (end: string) => "Ikke med i summen: sluttet <end>"` and
    `noPaymentsCount: (n: number) => "<da.noPayments> · <da.billCount(n)>"`.
- The component: the Om året cell gets `title=${row.notInSum}` and a muted colour when it is set. `status-next` and
  `status-ended` are grey with no border.

- [ ] Write the failing model tests with made-up bills (today 2026-11-05, I år), through `subscriptionTable`,
  `objectGroupCards` and `fixedView(…).groups`. One per spec §7 §3.2, §3.3, §4.2 and §5 case:
  - `a bill that ended at a month's end is a row in that month and in I år, and not in the month after`;
  - `a bill that starts after the time is no row, and one that starts later in I år is`;
  - `a unit after today has its rows with today's statuses`;
  - `the object group, the level and Konti narrow the rows`;
  - `in I år an ended bill's Om året is left out of the sums, with its tooltip`. Its `notInSum` is
    `da.notInSum(…)`, and the object-group sum and the group sum leave it out, while the group's count keeps it;
  - `in its last month, a bill that ends at the month's end counts in the sums, and one that ends mid-month does not`;
  - `a past month's rows read their past statuses, and the Status sort puts Næste and then Sluttet last`;
  - `an ended bill adds no estimate to Resterende udgifter, Estimat for hele, the bars or Poster i perioden`, through
    `fixedView` cards, bars and payments;
  - `with its last due date missed, an ended bill reads Ikke set in the tab and in Poster i perioden`;
  - `in Denne måned a kept bill that ended months ago adds no object-group card and no step row`;
  - `X stk. is the tab's rows for the same group`. It covers a bill that ended in the period, one with no payment in
    the period, and one that starts after today in I år. The card, `fixedView(…).groups` and `tabRows` give one
    count;
  - one test per row of the §5 line table;
  - `the detail's status follows the given status`.
- [ ] Change on purpose, and name in the report:
  - `subscriptions.test.ts` "does not follow a chosen unit or the period" becomes `follows the chosen unit and the
    period`;
  - `fixed-view.test.ts` "an object group found only on postings opens from its card and reads 0 stk." keeps the step's
    "0 stk." and asserts that the card's line has no "stk." (§5's third row);
  - every `key-numbers.test.ts` count that came from distinct bill names among payments.
- [ ] Run them and see them fail; implement; gates pass.
- [ ] Commit `feat: the fixed-expenses list follows the chosen time, and X stk. counts its rows`.

## Task 4: The tab in the view state and the hash

Model: sonnet · Review: yes

**Spec:** §3.1 (the hash), §3.5 (where the detail resolves).

**Files:** modify `addon/web/src/state/view.ts`, `addon/web/src/state/actions.ts`; tests in
`addon/web/test/view.test.ts` and `addon/web/test/actions.test.ts`.

**Interfaces:**

- Consumes: `tabRows` (Task 3).
- Produces: `type FixedTab = "payments" | "all"`; `ViewState.fixedTab: FixedTab`, default `"payments"`. `parseHash`
  reads `tab=all` only with `view=fixed`; any other value is `"payments"`. `toHash` writes `tab=all` right after `og`,
  before `full`.
- Produces, in `actions.ts`:
  - `setFixedTab(s: ViewState, tab: FixedTab): ViewState`;
  - `openFixed` sets `fixedTab: "payments"`;
  - `leaveFixed` sets `fixed: false, objectGroup: null, fixedFull: null, fixedTab: "payments", detail: null`. The
    `href` of Task 7 needs a state with no dead key;
  - `openLeftOver` sets `fixedTab: "payments"`.
- `detailResolves(s, data, today)`. In the view, a bill's key resolves when `s.fixedTab === "all"` and the bill is one
  of `tabRows(viewContext(data, s, today))`. A posting's key never resolves in the view. On the overview nothing
  changes yet; Task 6 drops the overview's subscription case.
- `normalise` in the view keeps a detail that `detailResolves` gives, and closes it otherwise. It no longer always
  calls `closeDetail`.

- [ ] Write the failing tests:
  - `view=fixed&og=Abonnementer&tab=all&full=list` round-trips, with `tab` after `og`, and after `view` without `og`;
  - `tab=other` reads `"payments"`, and `tab=all` without `view=fixed` reads `"payments"`;
  - `openFixed` and `leaveFixed` give `"payments"`, and `leaveFixed` drops the detail;
  - `setFixedTab` keeps `objectGroup`, `fixedFull`, `unit`, `level` and `accounts`;
  - `normalise` keeps `detail=s:<id>` with `tab=all` while the bill is a row, and closes it when the tab is
    `payments`, when a later month takes the row away (a bill ended in May, June chosen), and for a `p:` key.
- [ ] Change on purpose: `view.test.ts`'s "round-trips every field" state literal gets `fixedTab: "payments"`, and
  `actions.test.ts` near line 524 ("closes the detail in the view") becomes `keeps a resolving detail on the
  Alle faste udgifter tab`.
- [ ] Run them and see them fail; implement; gates pass.
- [ ] Commit `feat: the hash holds the fixed-expenses view's tab`.

## Task 5: The view's right card with two tabs, the list and its detail

Model: opus · Review: yes

**Spec:** §3.1, §3.5, §3 full screen.

**Files:** modify `addon/web/src/screens/fixed.ts`, `addon/web/src/screens/overview.ts` (export the segmented
control's styles, not copy them), `addon/web/src/app.ts`; tests in `addon/web/test/fixed-view.test.ts` (a new
`describe("the Alle faste udgifter tab (spec §3)")`).

**Interfaces:**

- Consumes: `fixedTab`, `setFixedTab` (Task 4); `subscriptionTable`, `tabRows`, `detailView(…, status)` (Task 3).
- `hs-fixed` gets these properties:
  - `tab: FixedTab`;
  - `table: SubscriptionTable | null`, set only on the `all` tab;
  - `detail: DetailView | null`;
  - `marked: DetailKey | null`.

  It fires `fixed-tab-change` with the tab and `detail-close`. `subscription-sort` and `detail-open` bubble up from
  `hs-subscriptions`.
- The right card's head holds the title, `<h2 id="hs-fixed-list-title">`, which is the open tab's name:
  `da.fixed.inPeriod` or `da.allFixed`. The card tools hold `<div class="card-switch" role="group"
  aria-label=${da.view}>` with two `aria-pressed` buttons named after the tabs, then the full-screen button named
  `da.fullScreenOf(<title>)`. The tab buttons keep fixed template positions, so a tab change keeps the focus on the
  pressed button.
- The `all` body is `detailSplit(objectGroupSums(table, da.objectGroupSums(da.allFixed)), <hs-subscriptions> + the
  foot, detail, full !== "list")`. With the detail in place, the head shows the overview's ← named
  `da.backTo(<title>)`. The empty text is `da.noSubscriptions(levelName(level))`.
- `app.ts`:
  - `fixedScreen` passes `tab`, the table and the detail. The detail is `detailView(key, ctx, row.status)` for the row
    the key names. The sort is the app's `subscriptionsSort`.
  - `changeFixedTab(tab)` waits for a pending Back. With a detail whose entry has the `detail` mark, it closes the
    detail by going back 1 and replaces in `afterBack`. Otherwise it calls `replaceKeepingMarks(hash, "drop")` and
    `change`.
  - `focusDetail` and `focusRow` await `hs-fixed` in the view. Their heading fallback is `#hs-fixed-list-title`.
  - `besideList()` is also true with `fixedFull === "list"`.
  - `onHash`'s `same` also compares `fixed`, `fixedTab` and `fixedFull`.

- [ ] Write the failing tests (made-up bills, `today` as `fixed-view.test.ts` sets it), one per spec §7 §3.1 and §3.5
  case:
  - `the card has the tabs Poster i perioden and Alle faste udgifter, Poster i perioden pressed`;
  - `the heading and the full-screen button's name follow the open tab`;
  - `a tab press writes tab=all after og and replaces the entry, so Escape then leaves the view in one step and Back
    lands before it`;
  - `the tab stays when the object group, the period, the unit or the level changes, and in full screen`;
  - `opening the view again starts on Poster i perioden`;
  - `the focus stays on the tab's button`;
  - `a row opens its detail with detail=s:<id> after tab=all, and its ← goes back to the list with the focus on the
    row`;
  - `the detail closes when the tab changes, and no detail entry is left: Back then leaves the view`;
  - `the detail closes when a later month takes its row away`;
  - `the detail's status reads as the row's in a past month`;
  - `Escape closes the detail, then full screen, then the view`;
  - `in the list's full screen the tabs stay at its head and the detail stands beside the list`.
- [ ] Change on purpose: none expected. If one changes, name it.
- [ ] Run them and see them fail; implement; gates pass.
- [ ] Commit `feat: the fixed-expenses view lists every fixed expense on its own tab`.

## Task 6: The overview without the Faste udgifter tab, and the old hash

Model: opus · Review: yes

**Spec:** §2, §2.1.

**Files:** modify `addon/web/src/state/view.ts`, `addon/web/src/state/actions.ts`, `addon/web/src/screens/overview.ts`,
`addon/web/src/app.ts`; tests in `addon/web/test/view.test.ts`, `actions.test.ts`, `subscriptions.test.ts`,
`detail.test.ts`, `detail-history.test.ts`, `full-screen.test.ts`, `fixed-view.test.ts`.

**Interfaces:**

- Produces: `Card = "bars" | "postings" | "shops"`. `parseHash` maps `card=subscriptions` by spec §2.1.
  - With no `view`, or with `view=full`, it gives `fixed: true, fixedTab: "all", objectGroup: null, fixedFull: null,
    fullScreen: false, unit: null`, and the period, Konti, the level and the quick filter as the hash says. It keeps a
    `detail=s:` and drops a `detail=p:`.
  - With `view=fixed` or `view=leftover`, it gives the state the hash says.
  - In every case `card` is `"bars"`.
- `detailResolves` on the overview: a bill's key never resolves; a posting's key resolves on `postings` only.
  `normalise` drops its `subscriptions` card check.
- `overview.ts` loses `subscriptions()`, its switch button, its title branch and its `subscriptionsSort` property. The
  app's `subscription-sort` handler moves to `hs-fixed`.
- The old hash is mapped by `parseHash` alone. As with an old `view=all-postings` link, the address is not rewritten
  on load. The next replace or push writes the mapped state.

- [ ] Write the failing tests:
  - `view.test.ts`: one test per row of the §2.1 table;
  - in each row, `card` is `"bars"`;
  - in the first row, the period, Konti, the level and `detail=s:` are kept, and `unit` and `detail=p:` are dropped;
  - app level: `#card=subscriptions` opens the view on the Alle faste udgifter tab with Alle. "Alt forbrug" then
    lands on Søjler with `location.hash` `""`. With no subscriptions in the answer, it lands on Søjler;
  - the overview's tabs are Søjler, Posteringer and Butikker. A key number's link opens the view on Poster i perioden.
- [ ] Change on purpose, and name in the report:
  - `subscriptions.test.ts`: every `card=subscriptions` hash becomes `view=fixed&tab=all` (in `toHash`'s order), and
    the expected `location.hash` values follow. "adds Faste udgifter to the switch" becomes `has no Faste udgifter
    tab on the overview`. "with no subscriptions" checks the overview's three tabs;
  - `detail.test.ts`'s 20 `card=subscriptions` hashes, in the same way. A test that relied on the detail following
    a period where the bill is no row (near lines 218 to 236) asserts the §3.5 close instead;
  - `full-screen.test.ts` near lines 200 and 283: the Faste udgifter row of the table goes; the test near line 283
    uses the view's full screen;
  - `view.test.ts` near lines 66 to 93 and 235, and `actions.test.ts` near lines 200 to 215 and 349 to 432: the
    `"subscriptions"` card goes. The bill cases of `detailResolves` move to the view;
  - `fixed-view.test.ts` "the Faste udgifter tab's ⤢ still opens its table in full screen" goes;
  - `detail-history.test.ts`, if any test opened a bill's detail on the overview.
- [ ] Run them and see them fail; implement; gates pass.
- [ ] Commit `feat: the Faste udgifter list leaves the overview for the fixed-expenses view`.

## Task 7: One top bar

Model: opus · Review: yes

**Spec:** §6 (all of it).

**Files:** modify `addon/web/src/components/top-card.ts`, `addon/web/src/components/accounts-picker.ts`,
`addon/web/src/components/unit-menu.ts`, `addon/web/src/components/level-menu.ts`, `addon/web/src/app.ts`,
`addon/web/src/i18n/da.ts`; tests in `addon/web/test/fixed-view.test.ts`, `left-over-view.test.ts`, `trail.test.ts`.

**Interfaces:**

- `hs-top-card`:
  - The ← and `da.backToOverview` go.
  - In the view and on Til overs, "Alt forbrug" is `<a href=${leaveHref}>`. A plain left click, with no modifier and
    button 0, calls `preventDefault()` and fires `leave`. Any other click follows the `href`.
  - New property `leaveHref: string`. The app sets it to `#${toHash(leaveFixed(state))}` in the view and to
    `#${toHash(leaveLeftOver(state))}` on Til overs.
  - On the overview the root is as today: text with nothing chosen, a `clearChoices` link otherwise.
- Til overs: the trail is the link, then "Til overs" as text, then the period. After the period come the unit word
  and the dashed `da.mainGroupStep`. Konti is drawn too. The app's `unitStep` gives Til overs the period-only rule it
  uses before the answer: `null` when the period has one unit, else `{ word, rows: null, chosen: null }`.
- `AccountsPicker`, `UnitMenu` and `LevelMenu` get `greyed: string | null` (default `null`). When it is set, the
  button has `aria-disabled="true"` and `title=${greyed}`, and a click does nothing. It is not `disabled`, whatever
  `rows` or `accounts` hold, so it stays in the Tab order. The CSS draws it in `--hs-muted` with `cursor: default`.
- Produces, in `da.ts` under `leftOver`: `allAccountsNote: "Til overs regner på alle konti"` and
  `wholePeriodNote: "Til overs viser hele perioden måned for måned"`.
- `app.ts`:
  - `@leave` calls `closeFixed` or `closeLeftOver` with `{ focus: true }`, which focuses `#hs-right-title` after the
    render, or the top card's `h1` while that is absent. It does so even when the focus is not lost.
  - History marks get `fixedSteps?: unknown`, the number of entries since the view's open, this one included:
    - `FIXED_ENTRY = { fixed: true, fixedSteps: 1 }`;
    - the view's full screen over an entry with `fixedSteps` n is `{ fixedFull: true, fixedSteps: n + 1 }` (this
      replaces `FIXED_FULL_OVER_FIXED`; plain `FIXED_FULL_ENTRY` stays);
    - a detail pushed in the view over an entry with `fixedSteps` n is `{ detail: true, fixedSteps: n + 1 }`.
  - `closeFixed` goes back `fixedSteps` when it is a positive integer, and replaces otherwise.
  - `goBack(steps: number)` uses `history.back()` for 1 and `history.go(-steps)` otherwise.
  - Escape and Back are unchanged.

- [ ] Write the failing tests, one per spec §7 §6 case:
  - `fixed-view.test.ts` and `left-over-view.test.ts`:
    - `has no Tilbage til overblikket button and has an Alt forbrug link` (`queryByRole(root, "button", { name:
      "Tilbage til overblikket" })` is null; the string is written out, since the key goes);
    - `the link's href is the overview's hash`;
    - `the link right after the open goes back, so Forward reopens the page`;
    - `the link after another choice replaces, and Back lands on the first view entry`;
    - `the link with a detail open over full screen leaves the view in one click, and Back lands before the view`;
    - `after the link the focus is on the overview's heading, also with group=Bolig, where Alt forbrug stays a
      link`;
    - `the link works while loading and on an error`.
  - `left-over-view.test.ts`:
    - `Konti, the unit word and Hovedgruppe are greyed, reachable by Tab, and do not open`. Use `getByRole(…,
      "button", { name, description })`, `aria-disabled` "true", no `aria-expanded` "true" after a click, and
      `tabIndex` ≥ 0;
    - `Denne måned has no unit word`.
  - `trail.test.ts`: `on the overview Alt forbrug is text with nothing chosen and a link with a level chosen`. Also, in
    the view, a level's × still clears the level and the link leaves the view.
- [ ] Change on purpose, and name in the report:
  - every test that used `back(root)` or `da.backToOverview` (`fixed-view.test.ts` near lines 142 to 357, 439, 485,
    496 and 877, and `left-over-view.test.ts`) uses the link through a `leave(root)` helper;
  - "the ← sits outside the trail and has no text" goes;
  - `left-over-view.test.ts` near line 203: the trail's text gets the unit word and Hovedgruppe;
  - the view's trail test where "Alt forbrug" cleared the level becomes `in the view Alt forbrug leaves for the
    overview`.
- [ ] Run them and see them fail; implement; gates pass.
- [ ] Commit `feat: one top bar on every page, with Alt forbrug as the way back`.

## Task 8: Docs and the decision

Model: sonnet · Review: no

**Spec:** §7 (the Chrome check, the integration issue), §8, §9.

**Files:** `addon/DOCS.md`, `docs/domain-language.md`, `docs/architecture.md`, `docs/testing.md`, `docs/decisions.md`.

- [ ] `addon/DOCS.md`, `docs/domain-language.md` and `docs/architecture.md` as spec §8 lists.
- [ ] `docs/testing.md`: the Chrome check loses the overview's Faste udgifter tab steps (steps 29, 34 and 45 name
  it; reword them to the view's tab). It gets step 55, `70-faste-udgifter-fane`, with spec §7's Chrome steps and
  widths.
- [ ] `docs/decisions.md`: D78 as spec §9 writes it (the link as `superpowers/specs/…`). The statuses of D20, D33, D40,
  D41, D44, D56, D62, D73 and D77 are set as spec §9's table gives them.
- [ ] Open the integration issue of spec §7 with `gh issue create`. Its title is "Seed an ended bill in the integration
  check". Its body links the spec and gives no real data. Put its number in the report.
- [ ] `node scripts/check-links.mjs` passes; gates pass. Commit `docs: the fixed list tab, ended fixed expenses and
  one top bar`.
