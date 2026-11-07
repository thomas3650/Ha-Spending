# Enhancement follow-ups – design

**Real Home Assistant:** no change there. No new option and no new file in `/data`. The release reaches the house
through the house session ([`releasing.md`](../../releasing.md#after-a-release)).

**Issues:** closes #143, #145, #170, #172 and #180. One branch, one PR (Thomas, 2026-11-07: "can we do all in one
pr").

**Approved:** by Claude, 2026-11-07, once `reviewer` rates it Ready. Thomas settled §2 and §6 in the brainstorm on
2026-11-07, in Chrome on the page, and handed the rest of the flow to Claude ("you work alone until the issue is
posed"). The rest holds only minor calls, marked "Claude's call".

Everything in the [fixed-expenses over time spec](2026-11-04-fixed-expenses-over-time.md), the
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
- **Non-goal:** any change to the overview's own lists, cards or titles beyond the shared per-month rule (§2.2).
- **Non-goal:** a new layout for wide screens (§6).
- **Anti-goal:** two per-month figures for the same payments that disagree on the same page, or one click apart.

## 2. The per-month figures (#143)

### 2.1 The fixed view's card on "I år"

Only the `thisYear` case of `fixedCards` changes (`addon/web/src/model/fixed.ts`). The other presets keep their
cards.

Thomas's ruling (2026-11-07): make it clearer that the card is an estimate, and also put the paid-so-far per-month
figure in the box.

- **Label:** "Estimat pr. måned" (Claude's call on the words). It replaces "Pr. måned i snit".
- **Value:** unchanged, the whole year's paid plus estimates divided by 12. It keeps the "ca." mark
  (`estimate: true`).
- **Sub-line:** two parts joined by " · ":
  - "hele {year} delt med 12", as today;
  - "betalt {amount} pr. måned", where the amount is §2.2's per-month figure of the paid payments in the view.
    Example: "hele 2026 delt med 12 · betalt 2.150 kr. pr. måned".
- When §2.2 gives no figure (no whole month with data yet, for example in January), the sub-line is "hele {year}
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
`addon/shared/src/money.ts`. It counts only the period's whole units that have data, and leaves out the running one.

**Claude's call:** the per-month figure of paid payments follows that rule, counted by month.

- The figure is the sum of the payments dated in the period's whole calendar months that have data (on or after
  `earliestPostingDate`), divided by the number of those months. A running month is not whole. Payments in a
  running or partial month are not counted.
- No such month: no figure (null), as `perMonth` gives today for a period shorter than 28 days.
- The rule lives in one function in `addon/shared/src/money.ts`, next to `averageUnits`, and the page's three users
  call it:
  - `objectGroupCards` (the overview's object-group cards, "{amount} pr. måned");
  - `fixedCards`' default case (the fixed view's "Gennemsnit pr. måned" on any other period);
  - §2.1's sub-line.
- `perMonth` goes. Its one test helper use in `addon/web/test/key-numbers.test.ts` follows the new function.
- The default case's "Gennemsnit pr. måned" sub-line, "{n} betalinger", counts the payments the figure divides,
  those in the whole months.

This is a lasting rule, so it gets a decision entry, **D80**: "A per-month figure of paid payments averages the
period's whole months with data". Every test whose value moves is named in the build's report.

## 3. The fixed view's trail and title (#172)

### 3.1 The main-group and category lists

In the fixed-expenses view (`state.fixed`), the trail's lists come from the fixed view, not from `levelRows`
(`addon/web/src/model/circle.ts`). `app.ts`' render picks one or the other on `state.fixed`. The overview's lists
stay as they are.

- **What a row sums:** the view's payments at that level: paid and estimates, as the bars and the "Måned" list count
  them. A main group with only an estimate is listed. **Claude's call**, so that the trail, the bars and the "Måned"
  list agree.
- **Which payments:** the view's (`fixedPayments`): the chosen object group and the chosen unit when one is chosen,
  else the view's span. The "Kategori" list keeps its rule of today, the categories of the chosen main group.
- **Which rows:** only main groups (or categories) with at least one payment, paid or estimate. "Ikke set" has no
  amount and adds no row. The chosen row is always listed, with "0 kr.", as `levelRows` does today.
- **The sum text:** as the "Måned" list writes it (`sumText`): "9.799 kr.", "9.799 kr. + ca. 1.074 kr." or "ca.
  1.074 kr.". `LevelRow` gains the text, or the fixed rows get their own type. That is the builder's choice.
- **Order:** largest first, by paid plus estimate, then by name (Claude's call; the overview's list follows its
  circle).
- **Colour:** the one `fixedColours` gives the part, so a row's dot matches its part of the bars. A main group's
  colour comes from the parts at the "all" level. A category's comes from the parts at the main group's level.
- The **Kategori** list has the same bug and gets the same fix. The issue names only the Hovedgruppe list.

### 3.2 The bars' title

`Fixed.bars()` (`addon/web/src/screens/fixed.ts`) titles the card `da.levelPer(groupTitle, grouping)`, for example
"Alle faste udgifter pr. måned". With a main group or a category chosen, the title also names it:
"{groupTitle} · {level} pr. {unit}", for example "Faste udgifter · Bolig pr. måned" (Claude's call on the form; it
follows `da.fixed.nameInGroup`'s " · "). The full-screen button's name follows the title, as today.

## 4. Small follow-ups (#170)

1. **The focus after a trail list.** After a choice from the dashed "Måned" or "Kategori" list in the fixed view,
   the focus falls to the body. Instead it moves to the new step, as the dashed "Hovedgruppe" list already does.
   The test checks the focused element by its role and accessible name.
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
   unit, "Ingen faste udgifter i {level} i {unit}", not "i perioden".
6. **Cleanup, with no change in behaviour:**
   - `.unit-row` and `.unit-sum` (`unit-menu.ts`) copy `.level-row` and `.level-sum` (`level-menu.ts`). One set of
     rules serves both.
   - `da.fixed.status` repeats words from `da.status`. Where a text is the same word, one refers to the other. The two
     have different shapes (`da.status` takes dates), so only the shared words are joined.
   - The few lines over the project's length in these files are wrapped.

## 5. The ended bill in the integration test (#180)

`addon/server/test-integration/firefly.test.ts` reads the example seed from a real Firefly III over the range R1
(2025-12-01 to 2026-07-31). Its comparison with the fake already includes Gammel forsikring (inactive, ended
2026-10-29) and Fitness (active, ended 2026-10-30), because both end after R1's start.

One test is added, so the ended bills are named and not only compared:

- Gammel forsikring is returned with `end: "2026-10-29"` and its last payment from the seed;
- Fitness is returned with `end: "2026-10-30"`;
- Husleje, an active bill with no end, is still returned.

The test runs in `scripts/integration` and in CI's `integration` job.

## 6. Full-screen width (#145)

Thomas's ruling (2026-11-07, looking at the page in Chrome): "it looks like it is fixed". No code changes. The PR
closes #145 with that ruling. The full-screen buttons on the cards came in #164 and #176.

## 7. Tests

Through the page's public interface (rendered text, roles and accessible names) and the shared functions, with
made-up data:

- §2.1: on "I år" the card's label is "Estimat pr. måned", its value is marked "ca.", and its sub-line holds both
  parts. With one object group chosen, the "betalt … pr. måned" amount equals the overview card's for that group. In
  January, with no whole month yet, the sub-line has the first part only.
- §2.2: the shared function over a period with a running month leaves that month's payments out. It counts only
  months on or after the earliest posting date. It gives null with no whole month. The object-group card's and the
  default case's figures follow it.
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
