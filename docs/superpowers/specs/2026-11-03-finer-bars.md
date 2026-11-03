# Finer bars for a one-unit period, and refunds below zero – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issues:** #100, #101, #103. One branch (`feat/finer-bars`), one PR. #103's second part, the day tooltip's date
twice, was fixed in #115; this closes the rest.

**Approved:** not yet.

**Mockup:** [`docs/mockups/v6/finere-enheder.html`](../../mockups/v6/finere-enheder.html). Where it differs from this
spec, the spec holds.

Today a period that holds one unit of its grouping draws one bar that fills the card, except a month by Måned, which
draws its days ([month days spec](2026-11-03-month-days.md), D51). A week by Uge, a quarter by Kvartal and a year by År
still draw one bar. The detail of a fixed expense, a subscription or a shop draws one bar on any one-unit period. And a
bar below zero is named "+200 kr." while the y-axis writes its ticks below zero with a minus.

This spec changes D51 and the month days spec in these places; everything else there holds:

- §1 "Uge, Kvartal and År periods with one unit stay as today";
- §2 "The detail's bars stay by month (one bar)";
- §5 the name of a bar below zero.

**Thomas's rulings, 2026-11-03:**

- Take #100, #101 and #103 together, from the mockup.
- A bar below zero: variant A. The y-axis ticks below zero have no sign, and the bar's tooltip says "+260 kr. retur"
  (§4).
- A click on a finer bar chooses the whole period's unit, as a day bar chooses its month today (§2).

**Open for Thomas:** see §1, "I år" by År.

**Claude's calls, for Thomas to see in the PR:**

- The finer unit: days for a week, days for a month (as today), months for a quarter, months for a year. Weeks for a
  quarter would cut across months, and months match the Måned labels (#100's comment) (§1).
- Only one step finer: a one-year period draws months, not days (§1).
- The detail draws exactly the units the Søjler card draws, from the same function, so the two never disagree (§3).
- The detail's bar names are thinned when there are more than 12 bars, at most 8 names; every bar keeps its hidden
  label (§3).
- "retur" also goes in the bar's hidden button name, so the name and the tooltip still say the same (§4).
- No average line on finer bars: the key numbers' average is a week's, a quarter's or a year's (§2).
- This is D53.

## 1. When finer units show

- One function of the view context decides it, replacing `dayUnits`: `finerUnits(ctx): { grouping: Grouping; units:
  Unit[] } | null` in `model/context.ts`. Every place that read `dayUnits` reads it instead, and the detail reads it too
  (§3). Nothing else decides "finer units shown".
- It returns finer units when `ctx.units` has exactly one unit and `ctx.timeline.grouping` is one of:

  | Grouping | Finer grouping |
  | --- | --- |
  | `week` | `day` |
  | `month` | `day` |
  | `quarter` | `month` |
  | `year` | `month` |

  By `day` it returns `null`. Two or more units return `null`, as today: a custom 12.–25. okt by Uge keeps two week
  bars.
- One unit, whole or not: a custom Wednesday to Friday by Uge draws those three days; a custom 15. aug – 30. sep by
  Kvartal draws August and September.
- The units are `unitsOf(span, finer, today)`. `span` is the period, except for the preset "Denne måned", where it
  runs to the month's last day (D51, unchanged).
- **"I år" by År, open for Thomas.** The draft keeps "I år" ending today, so on 30 Oct it draws January to October,
  October running, and November and December are not drawn. The other choice: run it to 31 Dec as "Denne måned" runs
  to the month's end, with the months after today as empty slots. That keeps early January from drawing a single
  "jan i gang" bar, the same problem #100 fixes. Claude recommends the second. The rule and its tests follow Thomas's
  answer.
- Each finer unit's amount is `unitTotals(ctx.shown, units)`; its labels are `unitAxis` and `unitName` under the finer
  grouping ("19.10." and "19.10.2026" for a day, "jul" and "Juli 2026" for a month). The tooltip of a day is its date
  and amount; it has no weekday (the mockup's "onsdag" is not built).
- The running unit is `isRunning`, as for any unit: lighter, "i gang" on the axis, `da.inProgress` in its name.
- The fetched range does not change: `fetchRange` already holds the whole period.
- Tests (the fixture's today 30 Oct 2026; "the bars' list" is the one `list` in the Søjler region; a bar is read by
  its button's name):
  - `period=custom&from=2026-10-19&to=2026-10-25&by=week`: 7 buttons, the first's name starts "19.10.2026", the last's
    "25.10.2026".
  - `period=custom&from=2026-10-21&to=2026-10-23&by=week`: 3 buttons.
  - `period=custom&from=2026-10-12&to=2026-10-25&by=week`: 2 week buttons, as today.
  - `period=custom&from=2026-07-01&to=2026-09-30&by=quarter`: 3 buttons, named from "Juli 2026", "August 2026" and
    "September 2026".
  - `period=lastYear&by=year`: 12 buttons, January to December 2025.
  - `period=thisYear&by=year`: per Thomas's answer (10 buttons, or 12 with November and December not running and
    without `da.inProgress`); October's name contains `da.inProgress`.
  - `period=lastMonth` (by Måned): 30 day buttons, as today.
  - `period=lastMonth&by=day`: 30 day buttons, as today; `period=thisYear` (by Måned): month buttons, as today.

## 2. What stays the period's

- `ViewContext` keeps `timeline.grouping`, `units` and `chosen` as they are: one unit of the chosen grouping. The
  finer units are made for the Søjler card and the detail only.
- Gruppér pr. keeps its value, the hash keeps `by` as it is, and no key is added or read differently.
- The key numbers, Posteringer, Alle posteringer and Forskel keep the chosen grouping.
- The card's title is `da.per(finer)` at Alt forbrug and `da.levelPer(name, finer)` at a main group or a category
  ("Pr. dag", "Mad pr. måned"). The full-screen card's title follows.
- No average line is drawn on finer bars, and the hidden list has no average text.
- A click on a finer bar, or on its button, chooses the period's one unit (`ctx.units[0].fullStart`), or removes it
  when it is chosen. While it is chosen every finer bar is marked chosen (`aria-pressed="true"`) and none fades. This
  is D51's click rule, applied to every finer unit; `BarItem.choose` already carries it.
- Tests:
  - `period=custom&from=2026-10-19&to=2026-10-25&by=week`: the region `da.per("day")` exists and `da.per("week")`
    does not; no `da.average(…)` text; Gruppér pr.'s value is `week`; Posteringer has one group line for the week.
  - The same period: a click on the button for 21 Oct sets the hash to
    `#period=custom&from=2026-10-19&to=2026-10-25&by=week&unit=2026-10-19&card=postings` (the key order the page
    writes) and shows the week's chip. With that unit chosen, on Søjler, every button has `aria-pressed="true"`.
  - `period=custom&from=2026-07-01&to=2026-09-30&by=quarter&group=Mad`: the region is `da.levelPer("Mad", "month")`.

## 3. The detail draws the same units

- `common()` in `model/detail.ts` draws its bars from `finerUnits(ctx)` when it is not `null`, with the finer
  grouping's `unitAxis` and `unitName`, else from `ctx.units` as today. Its title `per` is `da.detailPer(finer)` ("Pr.
  dag i perioden").
- A unit with no posting keeps its place and draws no bar, as today. So a fixed expense paid once on a one-month
  period draws one bar on its day.
- The running unit is lighter, as today.
- The detail's bar names (`.detail-bar-name`) are thinned when there are more than 12 bars: a name shows on bar `i`
  only when `i % k === 0`, with `k = ceil(n / 8)`, so a 31-day month shows 8 names (1st, 5th, … 29th). With 12 bars
  or fewer every name shows, as today. A thinned bar keeps its place, its `title` and its hidden label.
- Tests (with the detail's existing fixtures: Husleje as subscription `b1`):
  - `period=lastMonth&card=subscriptions&detail=s%3Ab1`: the list `da.detailPer("day")` has 30 items, and its hidden
    labels name every day ("1.9.2026: …" to "30.9.2026: …").
  - `period=thisYear&by=year&card=subscriptions&detail=s%3Ab1`: the list `da.detailPer("month")` has as many items as
    the Søjler card has bars on that period.
  - The default period (I år by Måned): the list `da.detailPer("month")`, as today.

## 4. A bar below zero

- A bar whose amount is below zero, and does not round to 0 kr., is named `` `+${kr(amount)} ${da.refundMark}` ``
  ("+260 kr. retur") in its tooltip and its hidden button's name. `da.refundMark` is a new text, "retur", in
  `i18n/da.ts`. A bar that rounds to 0 kr. has neither "+" nor "retur", as today. This is `barKr` in `format.ts`,
  used only by `hs-bars`.
- The Søjler card's y-axis writes a tick below zero without its sign: the formatter in `hs-bars` writes
  `axisKr(Math.abs(value))`. `axisKr` itself does not change. Ticks at and above zero are as today, and the lowest
  label stays hidden when a bar is below zero.
- The bar is still drawn below zero.
- The detail draws no bar at or below zero, so it does not change here.
- Tests: `period=lastMonth`, the button for 22 Sep (the fixture's Pizzeria Roma refund) is named
  `` `22.9.2026, +${kr(20000)} ${da.refundMark}` ``; the button for 1 Sep still `` `1.9.2026, ${kr(800000)}` ``. A
  unit test of the y-axis formatter is not written: ticks are drawn by ECharts, and the Chrome check covers them.

## 5. Tests that change on purpose

- Every test that reads `dayUnits` reads `finerUnits`.
- The month days test that names 22 Sep `` `22.9.2026, +${kr(20000)}` `` gains `da.refundMark`.
- Any test that looks up the Søjler region, or the detail's list, by the coarse grouping on a one-unit week, quarter or
  year period, or by `da.detailPer("month")` on a one-month period.

## 6. Docs

- D53: a period with one unit draws the next finer unit (days for a week or a month, months for a quarter or a
  year) on the Søjler card and in the detail, decided by `finerUnits`; the grouping, the hash, the key numbers and the
  chosen unit stay the period's; a click on a finer bar chooses the period's unit. A bar below zero is named "+… kr.
  retur", and the y-axis ticks below zero have no sign. D51's status becomes `active; the detail's bars, the one-unit
  Uge, Kvartal and År periods and the name below zero superseded by D53`.
- `docs/README.md`: the new spec and its plan in the map.
- `docs/mockups/README.md`: a section for `v6/`, with A chosen and B tried for the refund.
- `docs/testing.md`: a Chrome-check item: a custom one-week period by Uge, a custom one-quarter period by Kvartal,
  "I år" and "Sidste år" by År, and the detail of a fixed expense on "Sidste måned", at 420, 1440 and 1728 px, normal
  and full screen. The finer bars, their titles, no average line, the running unit lighter, the detail's names thinned
  and readable, and a click choosing the whole period. A day below zero (if the example data has one): its tooltip says
  "+… kr. retur", and the axis under zero has no minus.
- The domain language: "Refund" gets its Danish word on the page, "retur", in `docs/domain-language.md`.
