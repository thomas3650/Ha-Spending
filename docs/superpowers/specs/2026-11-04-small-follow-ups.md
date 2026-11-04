# Small follow-ups after 0.15.0 – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issues:** closes #159, #161 and #162. One branch, one PR.

**Approved:** by Claude, 2026-11-04, under Thomas's brief that day: take these three issues, and make the minor calls
alone. The calls are listed in §4 and in the PR, for Thomas to overrule.

Three small findings from the 0.15.0 check and the spec for #157. Each section changes one thing and names the earlier
spec it changes; everything else in the [UI spec](2026-10-30-ui-ux-design.md) and the later specs holds.

## 1. The right card's title names the chosen category (#162)

This supersedes the first bullet of [UI polish spec](2026-11-03-ui-polish.md) §1.2. That bullet kept the main group in
the title so the head row would not move, while a chip named the category. Since
[D55](../../decisions.md#d55-the-trail-is-the-overviews-filter) the right card has no category chip, so with a
category chosen nothing in the card says what it shows.

- With a category chosen, the right card's title names the category on every tab, as it names a main group today:
  `da.levelPer` (Søjler, "Husleje pr. måned"), `da.postingsOf`, `da.subscriptionsIn` and `da.shopsIn` with the
  category's name. With a main group and no category, the titles stay as they are.
- "Uden kategori" is a category like any other: with `group=<main group>&category=` the Søjler title is
  "Uden kategori pr. måned", and so with `group=&category=` (Uden hovedgruppe › Uden kategori). With no main group
  and no category chosen (`group=`), the title names `da.noMainGroup`, as today.
- What is named from the title follows it: the full-screen view's title, the detail's back button (`da.backTo`), the
  object-group sums list (`da.objectGroupSums`) and the Faste udgifter table's label.
- What does not change: the left card's hint (`da.chosenHint`) names the main group, whose categories the circle
  shows. The Faste udgifter empty text already names the category. The title keeps to one line and ends with "…" when
  too long, with its full text as `title`.
- The comment on `cardTitle` that says the title names the main group goes, since it no longer holds.
- Tests: with a main group and one of its categories chosen, each tab's title names the category; with the main group
  alone, it names the main group; "Uden kategori" as above. Tests that change on purpose, as they pin the old title:
  `main-group.test.ts` (the right card's title with a category chosen, and its `not.toContain` of the category),
  `trail.test.ts`, `subscriptions.test.ts`, `detail.test.ts` (the back button), `overview.test.ts` and
  `shops.test.ts`, where they choose a category. The report lists each one.

## 2. The donut's centre text stays inside the hole (#161)

This adds to UI spec §3.2 (the circle).

- The centre has up to three lines: the name, the unit, the amount. With a unit chosen and a main group or a category
  shown, the name ("Bolig og transport") and the unit ("i oktober 2026") are on their own lines; today they are one
  text, `da.levelInUnit`. With nothing chosen in the circle, the centre names the unit alone, as today, on one line.
- The name is at most 80 % of the hole's diameter wide. The hole's radius is the ring's inner
  radius: in the wide ring the first number of `ringRadius`; in the narrow ring 62 % of half the chart's shorter side,
  as ECharts reads the `"62%"`. Before the chart has a width there is no limit; the first resize sets it.
- The name wraps at spaces onto at most two lines and then ends with "…". The unit has no width limit and never
  wraps or is cut: the longest ("i september 2026") is about 110 px at the name's 13 px, and the smallest hole, in the
  wide ring at a 400 px high chart, is 136 px across. The unit sits on the centre line, where the hole is widest.
- The centre stays `pointer-events: none`, so it sets no `title`. The full text is in the DOM for screen readers, and
  the left card's heading and the trail name the same main group.
- Tests: the width rule is a pure function of the chart's width and height, tested on its own, wide and narrow, next
  to the existing `ringRadius` test. The centre's rendered text is checked by its text: the name and the unit as two
  texts with a unit chosen. Tests of the centre that change on purpose, as the one text splits in two, are listed in
  the report.
- Whether it fits is checked by eye: a new step in [`docs/testing.md`](../../testing.md#chrome-check)'s Chrome check
  has a long main group (two words and "og") with a month chosen, at 1600 px wide and with the chart under 400 px
  wide (narrow). Full screen has no donut.

## 3. The week and quarter groupings go (#159)

Since [D59](../../decisions.md#d59-the-trail-holds-the-period-and-the-grouping-follows-it) the page groups by month or
year, and a one-unit month draws days. Nothing reaches week or quarter.

- `Grouping` becomes `"day" | "month" | "year"`. Its week and quarter cases go from `addon/shared/src/units.ts` (with
  the doc comment on the ISO week) and `addon/web/src/format.ts` (with `quarterOf`), and their texts from
  `addon/web/src/i18n/da.ts` (`groupings.week`, `groupings.quarter`, `quarterAxis`).
- `isoWeek` and `isoWeekday` go from `addon/shared/src/dates.ts`, with the `isoWeek` tests, since nothing else uses
  them.
- The subscriptions' repeats (`weekly`, `quarterly`) are Firefly III's and are not a grouping; they and their texts
  stay.
- An old address with `by=week` or `by=quarter` keeps working as today: `by` is ignored. The tests of an old `by=week`
  and `by=quarter` address stay (`grouping.test.ts`, `view.test.ts`); only the `da.per("week")` assertion goes.
- Tests that use week or quarter only as a convenient grouping are rewritten with day, month or year, not deleted, so
  they keep what they cover:
  - a first unit clipped at the period's start, finished and counting as whole (D16), and `fetchRange` from it
    (`units.test.ts`): a custom period from mid-January, by month;
  - a clipped unit named from its whole unit (`format.test.ts`);
  - the singular and the plural of `averageBefore` and `unitCount` (`da.test.ts`).
- Docs that still name week or quarter as a grouping are fixed: `README.md` ("grouped by month, week or day") and
  `docs/domain-language.md` (a unit is "one day, week, month, quarter or year"). `docs/testing.md`'s `#by=week` check
  stays, as an old address.
- A new decision, D69, as in §4.

## 4. Decisions

- **D69: No week or quarter grouping.** §3. The page groups by day, month or year only; a later choice of grouping
  brings others back with its own spec. Why: since D59 nothing reaches week or quarter, and dead code needs tests and
  care. Source: Claude, 2026-11-04, this spec §3.

**Claude's calls, for Thomas to see:**

- §1 covers every tab, not only Søjler as the issue asks, so the titles agree.
- §2 puts the name and the unit on their own lines and wraps the name, rather than shrinking the font, so the unit is
  never cut and the centre reads the same in every donut.
- §3 removes week and quarter rather than keeping them for later.
