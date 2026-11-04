# Full screen, a tooltip per part and room in the fixed-expenses view – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [fixed view full screen spec](../specs/2026-11-04-fixed-view-full-screen.md), in one PR that closes #174
and #171.

**Architecture:** the page only. The view's model gets a due sum per part and the tooltip's lines; the list's model
learns whether it is full screen and whether one object group is chosen; the view state gets one field and one hash
key; the app gets the view's full screen beside the overview's. No server change, no new route, option or dependency.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts behind the chart mock.

**Approved:** pending.

**Spec:** [`docs/superpowers/specs/2026-11-04-fixed-view-full-screen.md`](../specs/2026-11-04-fixed-view-full-screen.md).
Every task reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass at every commit; `node scripts/check-links.mjs` in
  the repo root.
- The fixture (`addon/web/test/fixture.ts`) is not changed. `fixed-view.test.ts`'s own bills (Husleje, Avis,
  Forsikring due on 28 October, Tennis not seen) serve every view test.
- Tests do not read the chart's options ([D68](../../decisions.md)).
- Every new Danish text goes in `da.ts` and is used from there, in code and tests.
- An existing test that a task changes on purpose is named in the task and in its report.
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. History: ← and Escape from full screen right after the view's open and full screen's open leave the view, and Back
   afterwards does not reopen either (Task 6, spec §3.5).
2. The status sort in the Faste udgifter tab: a Forfalden row keeps its place when it turns red (Task 4, spec §5.1).
3. The bar sums: splitting a part's due estimates into their own segment changes no sum, label or list line
   (Task 1, spec §5.3).
4. A part name with `<` or `&` from Firefly III reaches the tooltip as text (Task 1, spec §4).
5. A hash with `view=fixed&full=list` on an answer with no subscriptions lands on the overview without any full
   screen (Tasks 5 and 6, spec §3.4).

---

## Task 1: The due sums and the tooltip's lines

Model: opus · Review: yes

**Spec:** §4, §5.3.

**Files:** modify `addon/web/src/model/fixed.ts` (`FixedBar`, built in `fixedBars`); create
`addon/web/src/model/fixed-tooltip.ts`; modify `addon/web/src/i18n/da.ts` and `addon/web/src/components/fixed-bars.ts`
(only so it builds); tests in `addon/web/test/fixed-model.test.ts` and a new `addon/web/test/fixed-tooltip.test.ts`.

**Interfaces:**

- Produces, in `model/fixed.ts`: `FixedBar.due: Map<string | null, number>`, the part's due estimates in the unit,
  øre. `FixedBar.estimate` stays every estimate, a due one included, so every sum, label and list line is unchanged.
- Produces, in `model/fixed-tooltip.ts`:
  - `interface TooltipLine { text: string; colour: string | null; strong: boolean }`; `colour` is the part's swatch,
    `null` for the unit line and the total, and `GREY` (an exported constant) for the folded line.
  - `tooltipLines(bar: FixedBar, parts: FixedPart[]): TooltipLine[]`.
  - `tooltipHtml(lines: TooltipLine[]): string`: escapes each text, draws a swatch for a colour, bolds a strong line.
  - `escapeHtml(text: string): string`, moved here from `components/fixed-bars.ts`.
- Produces, in `da.ts` under `fixed`: `partLine(name: string, sums: string)` → `"<name>: <sums>"`;
  `dueMark: " · forfalden"`; `others(n: number, sums: string)` → `"<n> andre: <sums>"`; `tooltipTotal(sums: string)`
  → `"I alt: <sums>"` (replacing today's text); `noPaymentsTip: "Ingen betalinger"`. The sums are written as now:
  paid only `barKr(paid)`, mixed `da.fixed.sum(barKr(paid), kr(estimate))`, estimates only
  `da.fixed.estimated(kr(estimate))`.

- [ ] Write the failing tests in `fixed-model.test.ts`: with today 30 October, a monthly bill due 28 October, unpaid
  but within its grace days (Forfalden, as `d1` near line 145), and a second bill in the same part with an estimate
  on or after today (`MOBILE` near line 81, due on the 31st, or a weekly bill with category Husleje): October's bar has
  `due` = the first's amount for that part and `estimate` = both together; a bar with no due estimate has an empty
  `due`; `paidSum`, `estimateSum`, `label` and `sum` are as before.
- [ ] Write the failing tests in `fixed-tooltip.test.ts`, one per spec §6 §4 case: paid only; mixed; estimates only;
  a part with a due estimate ending in `da.fixed.dueMark`; a refund part reading `barKr` of a negative sum ("+… kr.
  retur"); an empty bar (`paid.size === 0 && estimate.size === 0`, so a bar with only a not-seen row too) giving the
  unit line and `da.fixed.noPaymentsTip`; eleven parts giving nine part lines in the parts' order, then
  `da.fixed.others(2, …)` with colour `GREY`, and `dueMark` on it when a folded part is due; ten parts giving ten
  lines and no folded line; the total line strong, keeping paid and estimates apart; `tooltipHtml` of a line with
  the text `a<b & c` contains `a&#60;b &#38; c` and no `<b`.
- [ ] Run them and see them fail.
- [ ] Add `due` in `fixedBars`: a payment of kind `estimate` with `due` true adds to both maps.
- [ ] Write `tooltipLines` and `tooltipHtml`. "Biggest" is `Math.abs(paid + estimate)` in the unit; ties keep the
  parts' order. `components/fixed-bars.ts` imports `escapeHtml` from the new file and calls the new `tooltipTotal`
  with the total's sums, so the gates pass at this commit; Task 2 replaces its tooltip.
- [ ] Gates pass; commit `feat: the fixed view's bars know their due sums and their tooltip lines per part`.

## Task 2: The bars draw the due segment, the new tooltip and the legend

Model: sonnet · Review: yes

**Spec:** §4, §5.3.

**Files:** modify `addon/web/src/components/fixed-bars.ts`, `addon/web/src/i18n/da.ts`; tests in
`addon/web/test/fixed-view.test.ts`.

**Interfaces:**

- Consumes: `FixedBar.due`, `tooltipLines`, `tooltipHtml` (Task 1).
- Produces, in `da.ts` under `fixed`: `hatched: "Skraveret: estimat"` (replacing the old text) and
  `dueOutline: "Rød kant: forfalden"`; drop `tooltipPaid` and `tooltipEstimate`.

- [ ] Write the failing tests in `fixed-view.test.ts` (the legend is DOM): with `#view=fixed` on 30 October the legend
  reads `da.fixed.hatched` and `da.fixed.dueOutline` (Forsikring is due); with "Sidste år" neither; with `#view=fixed`
  and `answer({ bills: [HUSLEJE, AVIS] })` (estimates, no Forfalden) `hatched` and no `dueOutline`.
- [ ] Change on purpose "a focused bar button highlights every segment of its bar" (`fixed-view.test.ts`, the D19
  describe, near line 530): with paid, due and estimate series per part, its expected series indexes become the new
  ones (October `[0, 1, 2]`, December `[2]` for a one-part view). Name it in the report.
- [ ] Run them and see them fail.
- [ ] Draw three kinds of series per part, in this stack order: paid, due, estimate. The due series draws `due` with
  the hatch and a 2 px border in `--hs-not-seen`. The estimate series draws `estimate − due`, and `null` where that
  is 0. `segments()` includes a series only where it draws a value, so the D19 highlight names no empty series. The
  formatter only calls `tooltipHtml(tooltipLines(bar, this.parts))`.
- [ ] The legend: the hatched swatch with `hatched` when there are estimates; a red-outlined hatched swatch with
  `dueOutline` when any bar has a due sum.
- [ ] Gates pass; commit `feat: the fixed view's bars outline a due estimate in red and list each part in the tooltip`.

## Task 3: The payments list fits its card

Model: opus · Review: yes

**Spec:** §2, §3.3, §5.2.

**Files:** modify `addon/web/src/model/fixed-list.ts`, `addon/web/src/components/fixed-list.ts`,
`addon/web/src/i18n/da.ts`, and the caller in `addon/web/src/app.ts` (`fixedScreen`); tests in
`addon/web/test/fixed-view.test.ts` and `addon/web/test/fixed-model.test.ts`.

**Interfaces:**

- Produces: `fixedList(view: FixedView, chosen: Unit | null, opts: { full: boolean; oneGroup: boolean } =
  { full: false, oneGroup: true }): FixedList`. `FixedList.full: boolean` carries `opts.full` to the component.
- In `fixedScreen`, `oneGroup` is `this.state.objectGroup !== null || objectGroupStep(view.groups,
  this.state.objectGroup).single` (true when the step names one group).
- Produces, on `FixedRow`: `badge: boolean` (show the object-group badge; `opts.full`) and `nameTitle: string` (the
  name cell's tooltip: the name, or with `!opts.oneGroup && !opts.full` `"<name> · <object group>"`). A year row's
  `sub` starts with `"<object group> · "` when `!opts.oneGroup && !opts.full`.
- The row's status stays `{ kind: Kind; due: boolean; text: string }`, with `text` one word.
- Produces, in `da.ts` under `fixed.status`: plain strings `paid: "Betalt"`, `expected: "Forventes"`,
  `due: "Forfalden"`, `notSeen: "Ikke set"` (the date arguments go).

- [ ] Write the failing tests in `fixed-view.test.ts`: with `og=Faste udgifter` no row has the badge text "Faste
  udgifter" inside its name cell; with "Alle" the Husleje row's name cell has the title "Husleje · Faste udgifter" and
  no badge; "Alt" by År with "Alle" has each row's line start with its object group.
- [ ] Write the failing model test in `fixed-model.test.ts`: `fixedList(…, { full: true, oneGroup: false })` gives
  `full` true, `badge` true, `nameTitle` the plain name, and the year rows' `sub` without the group.
- [ ] Change on purpose, and name in the report:
  - `fixed-view.test.ts` "writes each kind's date, amount and status": the four one-word statuses, the same dates in
    Dato;
  - `fixed-view.test.ts`'s refund test (near line 602), which calls `da.fixed.status.paid(…)`;
  - `fixed-model.test.ts`'s status texts (near lines 405-417 and 438).
- [ ] Run them and see them fail.
- [ ] Build the rows and statuses as above. `fixedScreen` passes `{ full: false, oneGroup }`; Task 6 passes `full`.
- [ ] The component: the status span gets the class `due` when `status.due` is true
  (`class="fixed-status ${kind} ${due ? "due" : ""}"`); the badge shows only when `row.badge`; the name cell's `title`
  is `row.nameTitle`; the table gets a `full` class when `list.full`.
- [ ] CSS in `fixed-list.ts`, for spec §2.2: Dato, Beløb, Status and a group line's sum never clip; the category clips
  first, down to `6em`, then the name, down to `6em` (today `td.fixed-name { width: 100%; max-width: 0 }` makes the
  name give way first; change that); a group line's name and count clip before its sum; the badge never shrinks under
  its text. With the `full` class the category's and the name's limits are lifted (spec §3.3). The status:
  `.fixed-status.estimate.due` in `--hs-not-seen` on `--hs-not-seen-soft` with a dashed `--hs-not-seen` border;
  `.notSeen` keeps no border.
- [ ] Gates pass. Then check in the fast loop (`scripts/develop`, made-up data) at a 1200 px and a 1440 px window,
  normal card, one group and Alle: no sideways scroll, no badge, nothing cut. Report what you saw.
- [ ] Commit `fix: the fixed view's payments fit their card, with one-word statuses`.

## Task 4: Forfalden in red in the Faste udgifter tab and its detail

Model: sonnet · Review: yes

**Spec:** §5.1.

**Files:** modify `addon/web/src/model/subscriptions.ts` (`statusCell`, `SubscriptionRow.status`),
`addon/web/src/components/subscriptions.ts` and `addon/web/src/components/detail.ts` (their status classes and CSS);
tests in `addon/web/test/subscriptions.test.ts`.

**Interfaces:**

- Produces: `statusCell` returns `{ kind: SubscriptionStatus["kind"]; due: boolean; text: string }`, `due` being the
  `isDue` the text already uses; `kind` stays `"expected"`. The detail's status pill (`model/detail.ts`, rendered in
  `components/detail.ts`) uses the same cell. Claude's call: the detail's "Forfalden" pill is red too, so a bill reads
  the same in its row and its detail.

- [ ] Write the failing model test: a due subscription's row has `kind` `"expected"`, `due` true and the text
  `da.status.due(…)`; sorted by Status it keeps the place it had before this change (beside the other Forventes rows
  by date).
- [ ] Run it and see it fail.
- [ ] Add `due` in `statusCell`; the tab and the detail give a due status the class `status-due` in the not-seen
  colours, written after `.status-expected` so it wins.
- [ ] Gates pass; commit `feat: Forfalden is red in the Faste udgifter tab`.

## Task 5: The view's full screen in the state and the hash

Model: sonnet · Review: yes

**Spec:** §3.4.

**Files:** modify `addon/web/src/state/view.ts`, `addon/web/src/state/actions.ts` (`leaveFixed`, `openFixed`,
`normalise`'s no-subscriptions fallback); tests in `addon/web/test/view.test.ts` and `addon/web/test/actions.test.ts`.

**Interfaces:**

- Produces: `ViewState.fixedFull: "bars" | "list" | null`, default `null`; `FixedCard = "bars" | "list"`;
  `setFixedFull(s: ViewState, card: FixedCard | null): ViewState` in `actions.ts`.
- `fullScreen`'s doc comment says it is the overview's; `fixed`'s "it is never full screen" becomes "never the
  overview's full screen".

- [ ] Write the failing tests: `parseHash("view=fixed&full=bars")` and `…&og=Abonnementer&full=list` round-trip
  through `toHash`, with `full` right after `og`, or after `view` when `og` is absent; `full=other` reads `null`;
  `full=list` without `view=fixed` reads `null`; `leaveFixed` gives `fixedFull` `null`; `openFixed` gives `null`;
  `normalise`'s no-subscriptions fallback gives `fixed` false, `fullScreen` false and `fixedFull` null.
- [ ] Change on purpose `view.test.ts`'s "round-trips every field": its state literal gets `fixedFull: null`.
- [ ] Run them and see them fail.
- [ ] Implement.
- [ ] Gates pass; commit `feat: the hash holds the fixed view's full-screen card`.

## Task 6: Full screen in the fixed-expenses view

Model: opus · Review: yes

**Spec:** §3 (all of it), §2.1's badge rule in full screen.

**Files:** modify `addon/web/src/screens/fixed.ts`, `addon/web/src/screens/overview.ts` (export the icons),
`addon/web/src/components/fixed-bars.ts` (its fill CSS), `addon/web/src/app.ts`, `addon/web/src/i18n/da.ts`; tests in
`addon/web/test/fixed-view.test.ts` (a new `describe("full screen (spec §3)")`).

**Interfaces:**

- Consumes: `fixedFull`, `setFixedFull` (Task 5); `fixedList(…, { full, oneGroup })` (Task 3).
- Produces, in `da.ts`: `fullScreenOf(title: string)` → `"Fuld skærm: <title>"`.
- `hs-fixed` gets `full: FixedCard | null` and fires `fixed-full-toggle` with the card. The list's heading gets
  `tabindex="-1"`. `EXPAND` and `COLLAPSE` move out of `overview.ts` to a place both screens import.
- `app.ts`: a history mark `FIXED_FULL_ENTRY = { fixedFull: true }` for the view's full-screen open, and
  `{ fixedFull: true, overFixed: true }` when the current entry has the `fixed` mark. Claude's call, after the plan
  review: a mark of its own, so the overview's `full` checks never see it, also after a fallback keeps marks.

- [ ] Write the failing tests, one per spec §6 §3.1, §3.2, §3.3, §3.5 and §3.7 case, using `getByRole(root, "button",
  { name: da.fullScreenOf(<title>) })`, the regions by name, `history.back()`/`history.forward()` with `hashBecomes`,
  and `fireEvent.keyDown(window, { key: "Escape" })` as the existing view tests do. Among them: the buttons are
  there with `og=` an object group that has no fixed expenses at the level (the list's empty text); the bars' full
  screen has no list region and no key-number group; a bar press in full screen keeps `full=bars` in the hash; the
  list's full screen shows the badge; the focus cases read `document.activeElement` through the app's shadow root, as
  the existing focus test does.
- [ ] Write the failing app-level §3.4 tests: a load with `#view=fixed&full=list` opens the list in full screen;
  leaving the view by ← drops `full` from `location.hash`; extend "view=fixed with no subscriptions shows the
  overview" (near line 324) with `&full=list`: `location.hash` is `""` and the overview shows both normal cards.
- [ ] Run them and see them fail.
- [ ] `screens/fixed.ts`: each card's title row gets a `.card-tools` wrapper with the overview's `.full-screen` button
  and its icons, named `fullScreenOf(<the card's title>)`, `aria-pressed` per `full`. Both cards keep fixed template
  positions; full screen drops the other one with `nothing`, as `overview.ts` does
  (`${single ? nothing : this.left()} ${this.right()}`), so the card that stays keeps its DOM and the focus. The
  `.halves` wrapper gets the `single` class while `full` is set, so the card has the page's whole width. The bars'
  card gets the `fill` class in full screen; the list's does not. The styles the button needs move or are
  shared, not copied.
- [ ] D67's height for the view, extending today's selectors: in `app.ts` `.page:has(.half.fill)`, `> hs-fixed` as a
  flex column, `.halves:has(> .half.fill)`, and `.half.fill { display: flex; flex-direction: column }`; in `fixed-bars.ts` `.fill > hs-fixed-bars` and `.fill .fixed-bars` as
  flex columns (the legend and the chart are siblings) and `.fill .fixed-bars .chart { flex: 1 1 0; height: auto;
  min-height: 400px; overflow: hidden }`.
- [ ] `app.ts`:
  - hide the view's key numbers while `fixedFull` is set; one placeholder region while loading with `fixedFull` set;
  - open: waits for a pending Back (`afterBack`) as `openFullScreen` does, then pushes `FIXED_FULL_ENTRY` (with
    `overFixed` when the current entry has the `fixed` mark);
  - close: goes back one when the entry has `fixedFull`, else replaces;
  - Escape order: an open trail list closes first (as now), then the view's full screen, then the view;
  - `closeFixed` goes back two when the entry has `overFixed`, else as now;
  - focus: `focusFixedIfLost` targets `#hs-fixed-list-title` when `fixedFull === "list"`, else `#hs-fixed-bars-title`,
    and runs after a close, Back, Forward or Escape that leaves the focus lost; the `hasUpdated` guard stays, so a
    reload leaves the focus alone;
  - `fixedScreen` passes `{ full: fixedFull === "list", oneGroup }`.
- [ ] Gates pass; commit `feat: each card of the fixed-expenses view can fill the page`.

## Task 7: Docs and the decision

Model: sonnet · Review: no

**Spec:** §7, §8.

**Files:** `addon/DOCS.md`, `docs/domain-language.md`, `docs/testing.md`, `docs/decisions.md`, `docs/README.md`.

- [ ] `addon/DOCS.md`, `docs/domain-language.md` and `docs/testing.md` as spec §7 lists. The Chrome check gets step
  53, `68-fuld-skaerm-faste-udgifter`, with spec §6's Chrome steps and widths.
- [ ] `docs/decisions.md`: D72 as spec §8 writes it (the link as `superpowers/specs/…`), with the detail's red pill
  (Task 4) in its Claude's-call list; D20's status gets D72; D64's status becomes `active; its colour superseded by
  D72`.
- [ ] `docs/README.md`: the plans list gets this plan after "fixed expenses over time".
- [ ] `node scripts/check-links.mjs` passes; gates pass; commit `docs: the fixed view's full screen, tooltip and red
  Forfalden`.
