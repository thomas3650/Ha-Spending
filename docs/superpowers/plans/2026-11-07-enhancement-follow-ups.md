# Enhancement follow-ups – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [enhancement follow-ups spec](../specs/2026-11-07-enhancement-follow-ups.md), in one PR that closes
#143, #145, #170, #172 and #180.

**Architecture:** a shared per-month rule in `addon/shared/src/money.ts` that the page's three per-month figures
call; the fixed view's cards, trail lists, bars title and list texts in `addon/web/src/model/` and `screens/`; the
focus after a trail list in `top-card.ts` or `app.ts`; one integration test in `addon/server/test-integration/`. No
route, no option, no new file in `/data`.

**Tech stack:** TypeScript, Lit, Vitest with Testing Library; a real Firefly III in Docker for the integration test.

**Approved:** by Claude, 2026-11-07, after `reviewer` rated it Ready.

**Spec:** [`docs/superpowers/specs/2026-11-07-enhancement-follow-ups.md`](../specs/2026-11-07-enhancement-follow-ups.md).
Every task reads its sections there.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8. Tests go through public interfaces: rendered text, roles, accessible names, and
  exported model and shared functions. Use made-up data only. Write in English, except for Danish texts, which live
  only in `addon/web/src/i18n/da.ts`. Comments only say why. Docs change with the code.
- Tests read their expected texts from `da` (as the existing tests do), never a copied string.
- In `addon/`, `npm run lint && npm test && npm run build` pass at every commit. In the repo root,
  `node scripts/check-links.mjs` passes.
- Any existing test changed on purpose is named in the task's report, with the reason.
- Commits use Conventional Commits and `git commit -F <file>`, with the file in the SDD workspace. Each ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **A short or one-month period.** "Sidste måned" gives that month's own sum, and "Denne måned" gives no figure.
   Neither ever falls back to the 12 months before (Task 1, spec §2.2).
2. **A main group chosen in the fixed view.** The Hovedgruppe list still lists its siblings, not only the chosen group
   (Task 3, spec §3.1).
3. **"Alle faste udgifter" against one object group.** The §2.1 amount equals the overview card's when one group is
   chosen (Task 2).
4. **No estimates left.** No card shows "ca." on an exact value, or "0 betalinger" (Tasks 2 and 5).
5. **Focus.** After every dashed-list choice, the focus is on a named button, never on the body (Task 4).

---

## Task 1: One per-month rule for paid payments

Model: sonnet · Review: yes

**Spec:** §2.2.

**Files:**
- Modify `addon/shared/src/money.ts`: add the function next to `averageUnits`.
- Modify `addon/web/src/model/key-numbers.ts`: drop `perMonth` and use the new function in `objectGroupCards`.
- Modify `addon/web/src/model/fixed.ts`: use the new function in the default case of `fixedCards`.
- Modify `docs/decisions.md`: add D80.
- Tests: a shared money test (the existing shared test file for `keyNumbers`), `addon/web/test/key-numbers.test.ts`,
  `fixed-model.test.ts` and `fixed-view.test.ts` where values move.

**Interfaces:**
- Produces, exported from `@ha-spending/shared`:
  `paidPerMonth(items: { date: string; amount: number }[], period: Period, today: string, earliest: string | null): { amount: number; months: number; count: number } | null`.
  - The months are `unitsOf(period, "month", today).filter((u) => isWhole(u) && hasData(u, earliest))`.
  - `amount` is the sum of the items dated in those months, divided by `months` and rounded to whole øre as
    `averageOf` rounds.
  - `count` is the number of those items.
  - It returns `null` when there are no such months. It never uses the `"before"` branch.

- [ ] **Step 1: Failing shared tests.** Each test checks one of these:
  - `leaves the running month's payments out`: period 2026-01-01..2026-11-07, today 2026-11-07, payments in Jan–Oct
    and on 2026-11-02 → the 2026-11-02 payment is not counted, `months` is 10;
  - `counts a past month cut by the period's start`: period 2026-01-15..2026-03-31 → `months` is 3;
  - `leaves out a month that ends before the earliest posting date`;
  - `gives one past month's own sum`: period 2026-10-01..2026-10-31, today 2026-11-07 → `amount` is that month's
    sum and `months` is 1;
  - `gives null when the period is only the running month`.
- [ ] **Step 2: Run them, and see them fail.**
- [ ] **Step 3: Implement `paidPerMonth`, and call it from `objectGroupCards` and the default case of `fixedCards`.**
  - In the default case, the "Gennemsnit pr. måned" card's value is `amount`. Its sub-line is
    `da.fixed.payments(count)`.
  - With `null`, the card is left out, as it is today.
  - Remove `perMonth`. The two uses in `key-numbers.test.ts` move to `paidPerMonth`.
- [ ] **Step 4: Update the tests whose values move, and name each one in the report.**
- [ ] **Step 5: Add D80 to `docs/decisions.md`, in the log's format.**
  - Title: "A per-month figure of paid payments averages the period's own months with data, a cut month included and
    the running month left out".
  - It names the rule it replaces: the lists, period and postings spec's days ÷ 30.44.
  - Source: this spec, §2.2.
- [ ] **Step 6: Run the gates, then commit.**

## Task 2: The fixed view's per-month card on "I år", and "ca." only with an estimate

Model: sonnet · Review: yes

**Spec:** §2.1.

**Files:**
- Modify `addon/web/src/model/fixed.ts`: the `thisYear` case of `fixedCards`, and the `whole()` helper.
- Modify `addon/web/src/i18n/da.ts` (`da.fixed`).
- Tests: `addon/web/test/fixed-model.test.ts` and `fixed-view.test.ts`.

**Interfaces:**
- Consumes `paidPerMonth` from Task 1.
- Produces, in `da.fixed`:
  - `perMonthEstimate: "Estimat pr. måned"`, which replaces `perMonthAverage`;
  - `paidPerMonth: (amount: string) => \`betalt ${amount} pr. måned\``.
- The sub-line is `[da.fixed.yearSplit(year), da.fixed.paidPerMonth(kr(x.amount))].join(" · ")`, and it is the first
  part alone when `paidPerMonth` gives `null`.

- [ ] **Step 1: Failing tests.**
  - `the I år per-month card is labelled as an estimate and names the paid per-month figure`: its label, a value
    marked "ca.", and both parts of the sub-line.
  - `with one object group chosen, the card's paid per-month figure matches the overview card's`: render both
    from the same fixture and compare the texts.
  - `in January the per-month card has only the year line`.
  - `with no estimate left, Estimat pr. måned and Estimat for hele … have no ca.`: cover "I år", and also "Denne
    måned" and "Alt" through `whole()`.
- [ ] **Step 2: Run them, and see them fail.**
- [ ] **Step 3: Implement.** `estimate: true` only when the view's `estimates` is non-empty. This applies to the
  per-month card and to `whole()`.
- [ ] **Step 4: Run the gates, then commit.**

## Task 3: The fixed view's trail lists and the bars' title

Model: opus · Review: yes

**Spec:** §3.

**Files:**
- Modify `addon/web/src/model/fixed.ts`: export a function that builds the rows.
- Modify `addon/web/src/app.ts` (`render`, `lists`): choose the fixed rows when `state.fixed`.
- Modify `addon/web/src/components/level-menu.ts`: write a row's sum from its text.
- Modify `addon/web/src/model/circle.ts`: `LevelRow` gains `sumText?: string`, or the fixed rows get their own type;
  the builder picks one and names it in the report.
- Modify `addon/web/src/screens/fixed.ts` (`bars()`) and `addon/web/src/app.ts` (`fixedScreen`), plus
  `addon/web/src/i18n/da.ts`.
- Tests: `addon/web/test/fixed-view.test.ts`, `trail.test.ts` and `fixed-model.test.ts`.

**Interfaces:**
- Produces `fixedLevelRows(ctx: ViewContext, of: "mainGroup" | "category"): LevelRow[]` in `model/fixed.ts`.
  - It works out the fixed payments for `{ ...ctx.state, level: { kind: "all" } }` (main groups), or
    `{ ...ctx.state, level: { kind: "mainGroup", mainGroup } }` (categories), from a context built for that state.
  - It groups the payments by part key: the main group, or the category.
  - It keeps only parts with paid or estimate amount above 0, plus the chosen one with 0.
  - It orders them by paid plus estimate, largest first, then by name.
  - The colours come from `fixedColours` for that state.
  - The text comes from `sumText`.
  - It returns `[]` for categories when no main group is chosen.
- Produces `da.fixed.titleIn: (group: string, level: string) => \`${group} · ${level}\``. The bars' title is
  `da.levelPer(da.fixed.titleIn(groupTitle, levelName(level)), grouping)` when a level is chosen. With none, it is
  unchanged.

- [ ] **Step 1: Failing tests.** All of them run through the rendered trail menu and the headings:
  - `the fixed view's Hovedgruppe list sums the fixed expenses and leaves out main groups without any`;
  - `a main group with only an estimate is listed with ca.`;
  - `with a main group chosen the Hovedgruppe list still lists the other main groups with fixed expenses`;
  - `a chosen main group with no fixed expenses is listed with 0 kr.`;
  - `the fixed view's Kategori list sums the chosen main group's fixed expenses`;
  - `the overview's Hovedgruppe list is unchanged`;
  - `with a main group chosen the bars' heading names it`, and the same with a category.
- [ ] **Step 2: Run them, and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates, then commit.**

## Task 4: The focus after a dashed trail list

Model: sonnet · Review: yes

**Spec:** §4.1.

**Files:**
- Modify `addon/web/src/components/top-card.ts`, and `app.ts` if the focus has to wait for the new state's render.
  Follow the app's existing focus pattern: a flag set on the choice, then a focus after `updateComplete`.
- Tests: `addon/web/test/trail.test.ts`.

**Interfaces:**
- The focused element is the new step's button:
  - `da.switchMonth(name)` or `da.switchYear(name)` for a month or a year;
  - `da.switchMainGroup(name)` for a main group;
  - `da.switchCategory(name)` for a category.

- [ ] **Step 1: Failing tests,** each in the fixed view and on the overview:
  - `after choosing from the dashed Måned list the focus is on the new month step's button`;
  - the same for the Hovedgruppe list and for the Kategori list.

  Each test checks `document.activeElement` by its role and accessible name.
- [ ] **Step 2: Run them, and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates, then commit.**

## Task 5: The fixed view's small texts and parts

Model: sonnet · Review: yes

**Spec:** §4.2 to §4.5.

**Files:**
- Modify `addon/web/src/model/fixed.ts` (`partKey`, `fixedParts` and `fixedCards`' "Resterende udgifter").
- Modify `addon/web/src/model/fixed-list.ts` (`yearRows`), `addon/web/src/model/fixed.ts` (`empty`) and
  `addon/web/src/i18n/da.ts`.
- Tests: `addon/web/test/fixed-model.test.ts` and `fixed-view.test.ts`.

**Interfaces:**
- Produces, in `da.fixed`:
  - `ofWhichDue: (n: number, date: string) => \`heraf ${n} estimat, forfalden ${date}\``;
  - `noMoreUntil: (date: string) => \`ingen flere til ${date}\``;
  - `emptyIn: (level: string, unit: string) => \`Ingen faste udgifter i ${level} i ${unit.toLowerCase()}\``.
- With `state.objectGroup === null` and the bars stacked by bill, the part key is `JSON.stringify([objectGroup, name])`.
  The part's name is `da.fixed.nameInGroup(name, objectGroup)` when that name is in more than one object group among
  the payments, and the name alone otherwise. With one object group chosen, the key stays the name.

- [ ] **Step 1: Failing tests:**
  - `with Alle faste udgifter two bills of one name in two object groups are two parts, each named with its group`;
  - `a year row names the first estimate on or after today`;
  - `a year row whose estimates are all overdue says forfalden with the first date`;
  - `Resterende udgifter with no estimates reads 0 kr. without ca. and ingen flere til {date}`;
  - `with a unit chosen and nothing in it the empty text names the unit in lower case`.
- [ ] **Step 2: Run them, and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the gates, then commit.**

## Task 6: The ended bills in the integration test

Model: sonnet · Review: no

**Spec:** §5.

**Files:**
- Modify `addon/server/test-integration/firefly.test.ts`: add one test next to "gives Husleje's last payment …".

- [ ] **Step 1: Add the test** `gives an ended bill, inactive or active, with its end date and last payment`:
  - Gammel forsikring has `end` `"2026-10-29"`.
  - Its `lastPayment` equals
    `{ date: "2026-03-02", amount: 120000, category: "Husleje", account: <Konto A's id> }`.
  - Fitness has `end` `"2026-10-30"`.
- [ ] **Step 2: Run `scripts/integration` if Docker runs locally, else say so in the report.** CI's `integration` job
  runs it before the merge.
- [ ] **Step 3: Commit.**

## Task 7: Cleanup and docs

Model: sonnet · Review: no

**Spec:** §4.6, §8.

**Files:**
- Modify `addon/web/src/components/unit-menu.ts`, `level-menu.ts` and `addon/web/src/i18n/da.ts`.
- Modify `docs/README.md`: add this spec and this plan to their lists.

- [ ] **Step 1: Merge the shared rules of `.unit-row`/`.level-row` and `.unit-sum`/`.level-sum`.**
  - Each menu keeps its own `grid-template-columns`.
  - Where `da.fixed.status` and `da.status` hold the same word, one refers to the other.
  - Wrap any line over the formatter's width in the files this branch changed.
- [ ] **Step 2: Add the spec and the plan to `docs/README.md`.**
- [ ] **Step 3: Run the gates, unchanged tests included, and `node scripts/check-links.mjs`. Then commit.**
