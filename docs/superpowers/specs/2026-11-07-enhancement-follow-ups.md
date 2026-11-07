# Enhancement follow-ups – design

**Real Home Assistant:** no change there. No new option and no new file in `/data`. The release reaches the house
through the house session ([`releasing.md`](../../releasing.md#after-a-release)).

**Issues:** closes #143, #145, #170, #172 and #180. One branch, one PR (Thomas, 2026-11-07: "can we do all in one
pr").

**Approved:** by Claude, 2026-11-07, once `reviewer` rates it Ready. Thomas settled §2.1 and §6 in the brainstorm on
2026-11-07, in Chrome on the page, and handed the rest of the flow to Claude ("you work alone until the issue is
posed"). The rest holds only Claude's calls, marked "Claude's call"; §2.2 is the largest of them.

Everything in the [lists, period and postings spec](2026-11-02-lists-period-postings.md), the
[fixed-expenses over time spec](2026-11-04-fixed-expenses-over-time.md), the
[fixed view full screen spec](2026-11-04-fixed-view-full-screen.md), the
[fixed list tab spec](2026-11-05-fixed-list-tab.md) and the
[inactive ended bills spec](2026-11-05-inactive-ended-bills.md) holds. Where they differ, this spec holds.

All amounts below are made up.

## 1. Why

- **#143:** the "Faste udgifter" view shows "Pr. måned i snit" for the year. That figure is an estimate (the whole
  year, paid plus the expected payments, divided by 12). The overview's card for the same object group shows a
  different per-month figure, from payments only. Both are right, but they sit one click apart with nearly the same
  words. A reader takes them for the same figure and thinks one is wrong.
- **#172:** in the fixed-expenses view the trail's dashed "Hovedgruppe" list sums all spending, not the fixed
  expenses. It also lists main groups with no fixed expenses. And the bars' title ignores a chosen main group.
- **#170:** six small follow-ups from the reviews of the fixed-expenses view.
- **#180:** the issue says the integration seed has no bills. It has since gained them (the example seed), but no
  test names what a real Firefly III gives for an ended bill.
- **#145:** the empty areas at full-screen width.

Goals, non-goals and anti-goals:

- **Goal:** on "I år", the fixed view's per-month card says that it is an estimate. It also shows the paid-so-far
  per-month figure, the same one the overview's card shows.
- **Goal:** in the fixed view, the trail's lists and the bars' title follow the fixed expenses.
- **Non-goal:** any change to the overview's own lists, cards or titles beyond the shared per-month rule (§2.2) and
  the focus after a trail list (§4.1).
- **Non-goal:** a new layout for wide screens (§6).
- **Anti-goal:** two per-month figures for the same payments that disagree on the same page, or one click apart.

## 2. The per-month figures (#143)

### 2.1 The fixed view's card on "I år"

Only the `thisYear` case of `fixedCards` changes its cards (`addon/web/src/model/fixed.ts`). The other presets keep
theirs, apart from the "ca." rule below for "Estimat for hele …".

Thomas's ruling (2026-11-07): make it clearer that the card is an estimate, and also put the paid-so-far per-month
figure in the box.

- **Label:** "Estimat pr. måned" (Claude's call on the words). It replaces "Pr. måned i snit".
- **Value:** unchanged, the whole year's paid plus estimates divided by 12. It has the "ca." mark (`estimate: true`)
  when the view holds at least one estimate. With none left, the value is exact and has no "ca.". The same goes for
  "Estimat for hele {name}" on every preset that has it ("I år", "Denne måned" and "Alt"), since one helper,
  `whole()`, builds it (Claude's call, as §4.4 does for "Resterende udgifter").
- **Sub-line:** two parts joined by " · ":
  - "hele {year} delt med 12", as today;
  - "betalt {amount} pr. måned", where the amount is §2.2's per-month figure of the paid payments in the view.
    Example: "hele 2026 delt med 12 · betalt 2.150 kr. pr. måned".
- When §2.2 gives no figure (in January, when the period is only the running month), the sub-line is "hele {year}
  delt med 12" alone.
- The paid payments are the view's: the chosen object group, or every object group when "Alle faste udgifter" is
  chosen, and the chosen level. With one object group chosen and no level, the amount is the same as the overview
  card's "{amount} pr. måned" for that group. Both call the same function. With "Alle faste udgifter" chosen, the
  overview has no card that sums every object group. The line still shows the sum over all of them.

### 2.2 One per-month rule for paid payments

`perMonth(sum, period)` (`addon/web/src/model/key-numbers.ts`) today divides by the period's days, counted in months
of 30.44 days. On "I år" in early November that is about 10.2 months. Most fixed expenses are paid early in the
month, so November's payments are already in the sum while November counts as only 0.2 of a month. The figure comes
out too high.

The overview's "Gennemsnit pr. måned" card already has a rule for this, `averageUnits` in
`addon/shared/src/money.ts`. It averages the period's units that `isWhole` and `hasData` accept
(`addon/shared/src/units.ts`), and leaves out the running one.

**Claude's call:** the per-month figure of paid payments follows that rule's `"period"` branch, counted by month
whatever the period's grouping. It never takes `averageUnits`' `"before"` branch, the 12 units before the period.

- The months are the period's own months, filtered as that branch filters them: a month cut by the period's own start or end
  counts, as D16 has it; the running month does not; a month that ends before `earliestPostingDate` does not
  (`hasData`).
- The figure is the sum of the payments dated in those months, divided by their number, rounded to whole øre as
  `averageOf` does. `kr` writes it in whole kroner, as today.
- No such month (for example a period that is only the running month): no figure (null).
- This replaces the rule of the [lists, period and postings spec](2026-11-02-lists-period-postings.md) for the
  object-group cards' "{amount} pr. måned" (the period's days in months of 30.44 days). It also changes the
  overview's figure, which the [fixed view full screen spec](2026-11-04-fixed-view-full-screen.md) kept as a
  non-goal because no change had been agreed. Thomas's ruling in §2.1 needs one figure in both places, and this one
  stops the running month from inflating it.
- The rule lives in one function in `addon/shared/src/money.ts`, next to `averageUnits`, and the page's three users
  call it:
  - `objectGroupCards` (the overview's object-group cards, "{amount} pr. måned");
  - `fixedCards`' default case (the fixed view's "Gennemsnit pr. måned" on any other period);
  - §2.1's sub-line.
- `perMonth` goes. Its two uses in `addon/web/test/key-numbers.test.ts` follow the new function.
- The default case's "Gennemsnit pr. måned" sub-line, "{n} betalinger", counts the payments the figure divides,
  those in the counted months.

This is a lasting rule, so it gets a decision entry, **D80**: "A per-month figure of paid payments averages the
period's months as the Gennemsnit card counts them". It names the rule it replaces. Values move in several tests,
at least in `addon/web/test/key-numbers.test.ts`, `fixed-model.test.ts` and `fixed-view.test.ts`. Each is named in
the build's report.

## 3. The fixed view's trail and title (#172)

### 3.1 The main-group and category lists

In the fixed-expenses view (`state.fixed`), the trail's lists come from the fixed view, not from `levelRows`
(`addon/web/src/model/circle.ts`). `app.ts`' render picks one or the other on `state.fixed`. The overview's lists
stay as they are.

- **What a row sums:** fixed payments, paid and estimates, as the bars and the "Måned" list count them. A main group
  with only an estimate is listed. **Claude's call**, so that the trail, the bars and the "Måned" list agree.
- **Which level the payments are taken at:** one level up, as `levelRows` does, whatever level is chosen. The
  view's payments (`fixedPayments`) are already narrowed to the chosen level, through `ctx.shown` and `shown(ctx)`,
  so the lists cannot reuse the view's own. They are worked out for the same state with another level:
  - the Hovedgruppe list: the state with level `all`;
  - the Kategori list: the state with the chosen main group as its level.
- **Which payments otherwise:** the chosen object group, and the chosen unit when one is chosen, else the view's
  span.
- **Which rows:** only main groups (or categories) with at least one payment, paid or estimate. "Ikke set" has no
  amount and adds no row. The chosen row is always listed, with "0 kr.", as `levelRows` does today.
- **The sum text:** as the "Måned" list writes it (`sumText`): "9.799 kr.", "9.799 kr. + ca. 1.074 kr." or "ca.
  1.074 kr.". `LevelRow` gains the text, or the fixed rows get their own type. That is the builder's choice.
- **Order:** largest first, by paid plus estimate, then by name (Claude's call; the overview's list follows its
  circle).
- **Colour:** the one `fixedColours` gives the part for the same state as above: for a main group, the state with
  level `all`; for a category, the state with the chosen main group. So a row's dot matches its part of the bars
  when that level is the one shown.
- The **Kategori** list has the same bug and gets the same fix. The issue names only the Hovedgruppe list.

### 3.2 The bars' title

`Fixed.bars()` (`addon/web/src/screens/fixed.ts`) titles the card `da.levelPer(groupTitle, grouping)`, for example
"Alle faste udgifter pr. måned". With a main group or a category chosen, the title also names it:
"{groupTitle} · {level} pr. {unit}", for example "Faste udgifter · Bolig pr. måned" (Claude's call on the form; it
follows `da.fixed.nameInGroup`'s " · "). The full-screen button's name follows the title, as today.

## 4. Small follow-ups (#170)

1. **The focus after a trail list.** A choice from a dashed list closes its menu and focuses the menu's own ▾
   button (`close(true)` in `dropdown.ts`). When the dashed step becomes a real step, that button is replaced, so
   the focus falls to the body. After a choice from the dashed "Måned", "Hovedgruppe" or "Kategori" list, in the
   fixed view and on the overview, the focus moves to the new step's button: for a month the button named
   `da.switchMonth(name)` (or `da.switchYear` for a year), for a main group `da.switchMainGroup(name)`, for a
   category `da.switchCategory(name)`. The test checks the focused element by its role and accessible name.
2. **Two bills of the same name in two object groups.** With "Alle faste udgifter" chosen, at the category level
   (the bars stack by bill), two bills with one name merge into one part. With "Alle faste udgifter" chosen, the
   part's key is the object group and the name. It is named with `da.fixed.nameInGroup` ("{name} · {object group}")
   when the name is in more than one object group, and by the name alone otherwise (Claude's call). With one object
   group chosen, nothing changes.
3. **A year row's "næste forventes {date}".** It names the first estimate on or after today. When every estimate is
   overdue (Forfalden), the line reads "heraf {n} estimat, forfalden {date}", with the first one's date (Claude's
   call).
4. **"Resterende udgifter" with no estimates.** In a level or object group with no estimates left, the card reads
   "0 kr." without "ca.", and its sub-line reads "ingen flere til {date}" (Claude's call), instead of "ca. 0 kr." and
   "0 betalinger til 31. dec".
5. **The empty text with a unit chosen.** With a unit chosen and no payments in it, the list's empty text names the
   unit in lower case, as `da.inUnit` writes it: "Ingen faste udgifter i {level} i marts 2026", not "i perioden".
6. **Cleanup, with no change in behaviour:**
   - `.unit-row` and `.unit-sum` (`unit-menu.ts`) repeat most of `.level-row` and `.level-sum` (`level-menu.ts`).
     One set of rules serves both. Each menu keeps its own `grid-template-columns`: the level list has a column for
     the dot (`auto 1fr auto`), the unit list has none (`1fr auto`).
   - `da.fixed.status` repeats words from `da.status`. Where a text is the same word, one refers to the other. The two
     have different shapes (`da.status` takes dates), so only the shared words are joined.
   - In the files this PR changes, lines over the formatter's width are wrapped.

## 5. The ended bill in the integration test (#180)

`addon/server/test-integration/firefly.test.ts` reads the example seed from a real Firefly III over the range R1
(2025-12-01 to 2026-07-31). Its comparison with the fake already includes Gammel forsikring (inactive, ended
2026-10-29) and Fitness (active, ended 2026-10-30), because both end after R1's start.

One test is added, so the ended bills are named and not only compared:

- Gammel forsikring is returned with `end: "2026-10-29"` and the last payment
  `{ date: "2026-03-02", amount: 120000, category: "Husleje", account: <Konto A's id> }`
  (`addon/dev/src/example.ts`);
- Fitness is returned with `end: "2026-10-30"`.

Husleje, an active bill with no end, is already checked by the test beside it.

The test runs in `scripts/integration` and in CI's `integration` job.

## 6. Full-screen width (#145)

Thomas's ruling (2026-11-07, looking at the page in Chrome): "it looks like it is fixed". No code changes. The PR
closes #145 with that ruling. The full-screen buttons on the cards came in #164 and #176.

## 7. Tests

Through the page's public interface (rendered text, roles and accessible names) and the shared functions, with
made-up data:

- §2.1: on "I år" the card's label is "Estimat pr. måned", its value is marked "ca.", and its sub-line holds both
  parts. With one object group chosen, the "betalt … pr. måned" amount equals the overview card's for that group. In
  January, with only the running month, the sub-line has the first part only. With no estimate left, neither
  estimate card has "ca.".
- §2.2: the shared function over a period with a running month leaves that month's payments out. It leaves out a
  month that ends before the earliest posting date. It counts a past month cut by the period's start. It gives null
  when the period is only the running month. A period of one past whole month ("Sidste måned") gives that month's
  sum. The object-group card's and the default case's figures follow it.
- §3.1: in the fixed view the Hovedgruppe list shows only main groups with fixed expenses, with their fixed sums. A
  main group with only an estimate is listed with "ca.". A chosen main group with nothing is listed with "0 kr.". The
  Kategori list does the same. The overview's lists are unchanged.
- §3.2: with a main group chosen, the bars' heading names it. With a category, it names the category.
- §4.1 to §4.5: one test each.
- §4.6: the existing tests pass unchanged.
- §5: as above, in the integration test.

## 8. Docs

- `docs/decisions.md`: D80 (§2.2).
- `docs/README.md`: this spec and its plan in the lists.
- `addon/CHANGELOG.md` is release-please's.
