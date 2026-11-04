# One top filter, one quick filter, one full-screen list – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [top filter spec](../specs/2026-11-04-top-filter.md), in one PR that closes #153.

**Architecture:** the page (`addon/web`) and one shared rule (`addon/shared/src/periods.ts`). No server change, no new
route, option or dependency. The view state loses `grouping`, `screen`, `sort` and `objectGroup`, and gains
`fullScreen`; `amount` becomes a kind. The top card's trail takes over the period and the levels; the Alle posteringer
screen goes; the Posteringer tab gets the Beløb pill.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts.

**Spec:** [`docs/superpowers/specs/2026-11-04-top-filter.md`](../specs/2026-11-04-top-filter.md). Every task reads its
sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root. Each task leaves the page compiling and every test passing.
- The fixture (`addon/web/test/fixture.ts`) is not changed. Tests that need "today" in another month use the existing
  way the tests set the add-on's today (grep `today` in `addon/web/test/mount.ts`).
- Before removing an export, `grep -rn <name> addon/web/src addon/web/test addon/shared/src addon/shared/test`. A
  caller in a test does not keep it alive; its test goes or is rewritten.
- Commits: Conventional Commits, `git commit -F <file>` with the message in `.superpowers/top-filter/`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Decision numbers D59 to D62 are this spec's. Another session works in parallel on #142–#151 and may add D63 and up;
  do not renumber.

## Review focus

1. **Back out of full screen after a detail.** ⤢, open a row, then ⤡: one Back from the following state must not show
   full screen (Task 3 test `back after ⤡ with a detail`).
2. **A period that crosses a new year.** "Sidste 3 måneder" in March gives three month bars, not two year bars
   (Task 1 test).
3. **An old hash with a week's unit.** `#by=week&unit=2026-03-11` reads with no unit step and month bars (Task 1 test).
4. **The amount bound itself.** Under 4.000 leaves out a posting of exactly 4.000 kr.; Over 500 leaves out 500 kr.
   (Task 5 test).
5. **Loading and error in the trail.** While the answer loads and on an error, the period step and Konti work and the
   dashed button is disabled (Task 2 test).

---

## Task 1: The grouping follows the period; Gruppér pr. goes

Model: opus · Review: yes

**Files:** modify `addon/shared/src/periods.ts` (and `index.ts` if it re-exports by name), `addon/web/src/state/view.ts`,
`addon/web/src/state/actions.ts`, `addon/web/src/model/context.ts`, `addon/web/src/app.ts`,
`addon/web/src/components/top-card.ts`, `addon/web/src/components/bars.ts`, `addon/web/src/i18n/da.ts` (`groupBy` and
the grouping labels if nothing else uses them); tests in `addon/shared/test/periods.test.ts`, `addon/web/test/view.test.ts`,
`actions.test.ts`, `month-days.test.ts`, `finer-units.test.ts`, `bars.test.ts`, and every test that sets `by=` or
`grouping` (grep).

**Spec:** §2.3, §2.4 (one-unit bars, the unit dropped), §6's `unit` and `by` rows.

**Interfaces:**
- Produces: `groupingFor(period: Period): "month" | "year"` in `addon/shared/src/periods.ts`, exported from the shared
  package. `ViewState` has no `grouping`; `ViewContext.timeline.grouping` is `groupingFor(timeline.period)`.
  `setGrouping` is gone.
- Consumes: `unitsOf`, `fetchRange`, `finerUnits` as today, now fed `groupingFor(...)`.

- [ ] Write the failing tests:
  - shared: `groupingFor` gives `"month"` for 1 Jan–4 Nov 2026, for 1 Dec 2025–28 Feb 2026, for 1 Nov 2025–31 Oct 2026
    and for 1 Jan–31 Dec 2025; `"year"` for 1 Jan 2025–1 Jan 2026 and for 1 Mar 2024–4 Nov 2026.
  - view: `parseHash("#by=week")` equals the default state; `toHash` never writes `by`.
  - page: on "Sidste 3 måneder" with today in March, the Søjler card has three month bar buttons; on "Alt" over three
    years, three year bar buttons named by year and the average key number says "pr. år"; on "Denne måned" and on
    "I år" with today in January, no bar buttons and day bars' tooltips; `#unit=<that month>` on "Denne måned" shows no
    unit step; `#by=week&unit=<a mid-month Wednesday>` shows no unit step; `#by=quarter&unit=2026-04-01` on "I år"
    shows "April 2026" as the unit step; no "Gruppér pr." control.
- [ ] Run them and see them fail.
- [ ] Implement `groupingFor`; drop `grouping` from `ViewState`, `DEFAULT_STATE`, `parseHash`, `toHash`; use
      `groupingFor` in `viewContext`, `normalise`, `app.ts`'s `wantedRange` and wherever `state.grouping` is read.
      In `normalise`, drop `unit` when `units.length === 1`. In `bars.ts`, a one-unit period's finer bars render no
      hidden buttons and ignore clicks (D19's list keeps the other periods). Remove the Gruppér pr. `select`.
- [ ] Run the tests and the gates; commit `feat: the grouping follows the period`.

## Task 2: The trail holds the period and the levels

Model: opus · Review: yes

**Files:** modify `addon/web/src/components/top-card.ts`, `addon/web/src/components/period-picker.ts`,
`addon/web/src/app.ts`, `addon/web/src/model/circle.ts` (if the list's rows need a helper), `addon/web/src/i18n/da.ts`;
create `addon/web/src/components/level-menu.ts` if the list does not fit in `top-card.ts`; tests in
`addon/web/test/trail.test.ts`, `main-group.test.ts`, `frame.test.ts`.

**Spec:** §2.1, §2.2, §2.4 (the unit step), §2.5.

**Interfaces:**
- Produces: `da.periodStep(name: string, range: string): string` → `"Periode: I år, 1. jan – 4. nov 2026"`;
  `da.switchMainGroup(name)` → `"Skift hovedgruppe: <name>"`; `da.switchCategory(name)` → `"Skift kategori: <name>"`;
  `da.chooseMainGroup` = `"Vælg hovedgruppe"`; `da.chooseCategory` = `"Vælg kategori"`; `da.mainGroupStep` =
  `"Hovedgruppe"`; `da.categoryStep` = `"Kategori"`.
  `levelRows(ctx: ViewContext, level: "mainGroup" | "category"): LevelRow[]` with
  `interface LevelRow { key: string | null; name: string; colour: string; sum: number; current: boolean }`, in
  `model/circle.ts`: the circle's pieces at that level, in its order, plus the chosen one if it has no piece.
  The top card fires `set-main-group` (`string | null`) and `set-category` (`{ mainGroup, category }`), handled in
  `app.ts` by today's `setMainGroup` and `setCategory` (push). `setMainGroup` keeps dropping the category.
- Consumes: the period panel as it is; its closed field goes and the trail's period button opens it.

- [ ] Write the failing tests (spec §8's §2.1, §2.2, §2.4 and §2.5 lines), including: the "Sti" text on an empty hash is
      "Alt forbrug › I år Hovedgruppe"; "Alt forbrug" is a link only with a unit, main group or category; the heading's
      text is the last step's; the period button's name; the panel opens from it and a preset changes the trail; a
      custom period's dates in the step; the main group list's rows and `aria-current`; switching drops the category;
      the dashed button chooses a main group in full screen (`#view=full` comes in Task 3: here, set the app's
      full-screen toggle as `full-screen.test.ts` does today); the dashed button and the level buttons are disabled
      while loading (an unanswered fetch) and on an error (a failing fetch), while the period step and Konti work.
- [ ] Run them and see them fail.
- [ ] Implement. The ▾ is an SVG with no text node, as the × is. The `h1` wraps the last step, a button when the step is
      one.
- [ ] Run the tests and the gates; commit `feat: the trail holds the period and the levels`.

## Task 3: Full screen is in the hash

Model: opus · Review: yes

**Files:** modify `addon/web/src/state/view.ts`, `addon/web/src/state/actions.ts`, `addon/web/src/app.ts`,
`addon/web/src/screens/overview.ts`; tests in `addon/web/test/full-screen.test.ts`, `detail-history.test.ts`,
`view.test.ts`, `actions.test.ts`.

**Spec:** §3.2, §6's `view` row.

**Interfaces:**
- Produces: `ViewState.fullScreen: boolean` (default `false`), hash `view=full`. `setFullScreen(s, on: boolean)` in
  `actions.ts` keeps the detail. `app.ts` marks the entry an open pushes with `FULL_ENTRY = { full: true }`, as
  `DETAIL_ENTRY` marks a detail; `closeFullScreen()` goes back one entry when the current entry is `FULL_ENTRY`, two
  when it is `DETAIL_ENTRY` and the one before it is `FULL_ENTRY` (track it in `history.state`, e.g.
  `{ detail: true, overFull: true }`), and otherwise replaces with `fullScreen: false` and `detail: null`. The app's
  own `fullScreen` field goes; `hs-overview` reads `ctx.state.fullScreen`.
- Consumes: nothing new.

- [ ] Write the failing tests: ⤢ writes `view=full` and Back leaves it; a reload of `#view=full` opens in full screen;
      ⤡ goes back; **back after ⤡ with a detail** (⤢, a row, ⤡, then `history.back()` does not show full screen);
      ⤢ then Søjler then ⤡ replaces (the spec's accepted quirk: no assertion on the following Back); Escape with a
      detail open closes only the detail, a second Escape leaves full screen; ⤢ keeps an open detail.
- [ ] Run them and see them fail.
- [ ] Implement.
- [ ] Run the tests and the gates; commit `feat: full screen is in the hash`.

## Task 4: Alle posteringer goes; the key-number links

Model: opus · Review: yes

**Files:** delete `addon/web/src/screens/all-postings.ts`; modify `addon/web/src/state/view.ts`,
`addon/web/src/state/actions.ts`, `addon/web/src/app.ts`, `addon/web/src/model/key-numbers.ts`,
`addon/web/src/components/key-numbers.ts`, `addon/web/src/model/filter.ts`, `addon/web/src/components/postings.ts`,
`addon/web/src/screens/overview.ts`, `addon/web/src/components/top-card.ts`, `addon/web/src/i18n/da.ts`; tests:
delete or rewrite `addon/web/test/all-postings.test.ts`; `key-numbers.test.ts`, `view.test.ts`, `actions.test.ts`,
`postings.test.ts`, `detail.test.ts`, and every test that uses `view=all-postings`, `og=`, `sort=` or `hs-all-postings`
(grep).

**Spec:** §3.1, §3.3, §3.4, §5, §6's old-link rows, §7.

**Interfaces:**
- Produces: `ViewState` without `screen`, `sort` and `objectGroup`. `openPostingsFull(s)` (card `"postings"`,
  `fullScreen: true`, `search: ""`, `shop: null`, `amount: null`, `detail: null`) and `openSubscriptions(s)` (card
  `"subscriptions"`, `fullScreen: false`) in `actions.ts`. `parseHash` reads `view=all-postings` as
  `fullScreen: true, card: "postings"`, and ignores `sort` and `og`. `da.showSubscriptions` = `"Vis faste udgifter"`.
  `filteredPostings(ctx)` no longer filters by object group. The postings sort stays the app's (`postingsSort`).
- Consumes: Task 3's `FULL_ENTRY` push for "N posteringer →": the key-number link keeps its `href` (so it is a link
  by role) and the app handles its click with `preventDefault` and pushes `openPostingsFull` with the full-screen
  marker. The object-group link pushes `openSubscriptions`.

- [ ] Write the failing tests: spec §8's §3 lines on "N posteringer →" (full screen, trail unchanged, quick filter and
      detail cleared, `view=full`); no Alle posteringer screen; `#view=all-postings&sort=oldest&og=X` reads as full-screen
      Posteringer; an object-group link is named "Vis faste udgifter" and shows the Faste udgifter tab, and Back
      returns; with a detail open in full screen there is no "Konto" column header; table cells do not wrap is a Chrome
      check (no CSS test).
- [ ] Run them and see them fail.
- [ ] Implement; remove what §7 lists, after the grep rule. `keepDetail` compares `card` and `fullScreen` where it
      compared `screen`, except that turning full screen on keeps the detail.
- [ ] Run the tests and the gates; commit `feat: one full-screen list instead of Alle posteringer`.

## Task 5: The Beløb pill and the amount kinds

Model: opus · Review: yes

**Files:** create `addon/web/src/components/amount-pill.ts`; modify `addon/web/src/state/view.ts`,
`addon/web/src/state/actions.ts`, `addon/web/src/model/filter.ts`, `addon/web/src/components/postings.ts`,
`addon/web/src/screens/overview.ts`, `addon/web/src/app.ts`, `addon/web/src/i18n/da.ts`, `addon/web/src/theme.ts` if
the pill needs tokens; tests: create `addon/web/test/amount-pill.test.ts`; `view.test.ts`, `filter.test.ts`.

**Spec:** §4.2, §6's amount rows and old `min`/`max` alone.

**Interfaces:**
- Produces: in `view.ts`,
  `type AmountFilter = { kind: "about" | "under" | "over"; value: number } | { kind: "between"; min: number; max: number }`
  (øre), `ViewState.amount: AmountFilter | null`; hash keys `about`, `under`, `over`, `min`+`max`, read in that order;
  `min` alone → `over`, `max` alone → `under`. In `filter.ts`, `aboutBounds(value: number): { min: number; max: number }`
  (øre in and out; ±20 %, ends to the nearest 5.000 øre when `value >= 25_000`, else to whole kroner) and
  `inAmount(p, amount: AmountFilter | null): boolean`. `setAmount(s, amount: AmountFilter | null)` in `actions.ts`
  (push). `<hs-amount-pill .amount=${AmountFilter | null}>` fires `amount-change` with `AmountFilter | null`.
  `da.amountEmpty` = `"Beløb"`, `da.amountKinds` (`about` "Omkring", `under` "Under", `over` "Over", `between`
  "Mellem"), `da.amountHints` (`about` "±20 %", `between` "to beløb"), `da.amountKindButton` = `"Vælg beløbstype"`,
  `da.removeAmount` = `"Fjern beløb"`, `da.amountName(filter)` for the pill's accessible name.
- Consumes: `parseKroner`/`writeKroner` as D47 has them (grep `readKroner`, `writeKroner`); `da.amountInvalid`.

- [ ] Write the failing tests: `aboutBounds(80_000)` is 65_000–95_000; `aboutBounds(10_000)` is 8_000–12_000;
      `aboutBounds(25_000)` is 20_000–30_000; `inAmount` with Under 4.000 leaves out exactly 400_000, Over 500 leaves out
      50_000, Mellem includes both ends; hash round-trips for each kind; `#min=500` reads as Over 500 and writes
      `over=500`; the pill (spec §8's §4 pill lines): empty name, the four kinds with hints, focus in the number after a
      kind, Enter applies, an invalid number shows `da.amountInvalid`, a kind left empty clears, Mellem needs both and
      swaps reversed bounds, switching kinds keeps the number, × clears, each change is one history entry; the pill
      shows on the Posteringer tab in both widths, and the key numbers and the circle do not change with it.
- [ ] Run them and see them fail.
- [ ] Implement. The pill is 36 px high, as the search field. Its dropdown follows the app's existing dropdown
      (`components/dropdown.ts`) for focus and Escape.
- [ ] Run the tests and the gates; commit `feat: the Beløb pill on Posteringer`.

## Task 6: The sentence, Ryd, and the suggestions' count

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/postings.ts`, `addon/web/src/components/search.ts`,
`addon/web/src/model/filter.ts`, `addon/web/src/state/actions.ts`, `addon/web/src/app.ts`, `addon/web/src/i18n/da.ts`;
tests in `addon/web/test/postings.test.ts`, `search.test.ts`.

**Spec:** §4.1, §4.3, §4.4.

**Interfaces:**
- Produces: `ShopSuggestion` gains `count: number`; `da.shopOption(name, count, sum)`;
  `da.showing(shown: string, all: string, sum: string, parts: string)` for "Viser 3 af 1.040 posteringer · 2.469 kr. —
  …"; `da.clearQuick` = `"Ryd"`; `clearQuickFilter(s)` in `actions.ts` (search, shop and amount cleared, one push).
- Consumes: Task 5's `AmountFilter` and `aboutBounds` for the amount's words.

- [ ] Write the failing tests: a suggestion's name includes the count; the sentence for shop + text + each amount kind;
      "Viser 0 af …" and `da.noMatch` with no hits; Ryd clears all three in one history entry and focuses the search;
      the quick filter stays when the tab and the period change.
- [ ] Run them and see them fail.
- [ ] Implement.
- [ ] Run the tests and the gates; commit `feat: say what the quick filter shows`.

## Task 7: Docs and decisions

Model: sonnet · Review: no

**Files:** `addon/DOCS.md`, `docs/domain-language.md`, `docs/architecture.md`, `docs/testing.md`, `docs/README.md`,
`docs/decisions.md`.

**Spec:** §9, §10.

- [ ] Change each doc as §9 says. Add D59 to D62 with today's date and the source "Thomas, 2026-11-04;
      `[top filter spec](superpowers/specs/2026-11-04-top-filter.md)` §n" (a link from `docs/decisions.md`). Set each status in §10's table exactly.
- [ ] `node scripts/check-links.mjs`; commit `docs: the top filter, the quick filter and one full-screen list`.
