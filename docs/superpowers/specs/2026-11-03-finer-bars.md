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

**Open for Thomas:** see §1, whether a preset that ends today ("I år", "Alt") draws on to the end of its one unit.

**Claude's calls, for Thomas to see in the PR:**

- The finer unit: days for a week, days for a month (as today), months for a quarter, months for a year. Weeks for a
  quarter would cut across months, and months match the Måned labels (#100's comment) (§1).
- It steps finer until there are two or more units, or it reaches days: a one-year period draws months, and
  "Sidste måned" by Kvartal or År, whose one month is again one unit, draws its days. A single day stays one bar (§1).
- The detail draws exactly the units the Søjler card draws, from the same function, so the two never disagree (§3).
- The detail's bar names are thinned when there are more than 12 bars, at most 8 names; every bar keeps its hidden
  label (§3).
- The y-axis tick text is a small exported function, so it has a unit test (§4).
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
- If the finer grouping again gives one unit, it steps once more, until there are two or more units or the grouping is
  `day`: "Sidste måned" by Kvartal or År draws the month's days ("Pr. dag"); a custom single day by Uge stays one day
  bar, titled "Pr. dag".
- One unit, whole or not: a custom Wednesday to Friday by Uge draws those three days; a custom 15. aug – 30. sep by
  Kvartal draws August and September, August clipped to start on the 15th (its name is "August 2026", its tooltip's
  range starts 15 Aug).
- The units are `unitsOf(span, finer, today)`. `span` runs from the period's start to the period's end, except as
  below, where it runs on to the earlier of the preset's own last day and `ctx.units[0].fullEnd` (the end of the one
  unit of the chosen grouping), so it never draws a day or month the preset does not hold:
  - the preset "Denne måned", whose own last day is the month's last day (D51). By Måned that is the month's end, as
    today. By Uge it is the end of the week: "Denne måned" by Uge on 3 Oct draws 1–4 Oct, the 4th an empty slot. By
    Kvartal or År it is the month's end; the month is then one unit, so it steps on to the month's days, as by Måned;
  - **open for Thomas:** the other presets that end today, "I år" (its own last day 31 Dec) and "Alt" (no last day of
    its own, so the unit's end). The draft has them end today, so "I år" by År on 30 Oct draws January to October, and
    in early January a single "jan i gang" bar, the problem #100 fixes. The other choice runs them on as above, with
    the units after today as empty slots. Claude recommends the second. The answer is one line here and the tests
    below.
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
  - `period=custom&from=2026-08-15&to=2026-09-30&by=quarter`: 2 buttons, the first named from "August 2026"; its
    tooltip (`barTooltip` of its item) holds `rangeText` from 15 Aug.
  - `period=lastMonth&by=quarter`: 30 day buttons, region `da.per("day")`.
  - `period=custom&from=2026-10-21&to=2026-10-21&by=week`: 1 button, "21.10.2026", region `da.per("day")`.
  - `period=thisMonth&by=week` with `now` 2026-10-03 (the `mount` option, as `month-days.test.ts` uses): 4 buttons,
    1–4 Oct; the 3rd's name contains `da.inProgress`, the 4th's does not.
  - `period=thisMonth&by=quarter`: 31 day buttons, region `da.per("day")`; the 30th's name contains `da.inProgress`,
    the 31st's does not.
  - `period=lastYear&by=year`: 12 buttons, January to December 2025.
  - `period=thisYear&by=year`: per Thomas's answer, 10 buttons (January to October), or 12 with November and December
    not running and without `da.inProgress`; October's name contains `da.inProgress`.
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
- The detail's bar names are thinned when there are more than 12 bars: bar `i` keeps its name only when
  `i % k === 0`, with `k = ceil(n / 8)`, so a 30-day month shows 8 names (1st, 5th, … 29th). With 12 bars or fewer
  every name shows, as today. The thinning is in the model: a thinned bar's `DetailBar.name` is `""`. It keeps its
  place, its `title` and its hidden `label`; the component draws an empty name.
- Tests (with `mountLinked` in `detail.test.ts`, where Husleje is subscription `b1`):
  - `period=lastMonth&card=subscriptions&detail=s%3Ab1`: the list `da.detailPer("day")` has 30 items; their hidden
    labels name every day ("1.9.2026: …" to "30.9.2026: …"); exactly 8 items show a name, "1.9." to "29.9.", every
    fourth.
  - `period=thisYear&by=year&card=subscriptions&detail=s%3Ab1`: the list `da.detailPer("month")` has 10 items (or 12,
    per Thomas's answer in §1), the first labelled "Januar 2026: …"; every item shows its name.
  - The default period (I år by Måned): the list `da.detailPer("month")`, as today.

## 4. A bar below zero

- A bar whose amount is below zero, and does not round to 0 kr., is named `` `+${kr(amount)} ${da.refundMark}` ``
  ("+260 kr. retur") in its tooltip and its hidden button's name. `da.refundMark` is a new text, "retur", in
  `i18n/da.ts`. A bar that rounds to 0 kr. has neither "+" nor "retur", as today. This is `barKr` in `format.ts`,
  used only by `hs-bars`.
- The Søjler card's y-axis writes a tick below zero without its sign, through a new `axisTickKr(ore)` in `format.ts`,
  `axisKr(Math.abs(ore))`, which the formatter in `hs-bars` calls. `axisKr` itself does not change. Ticks at and
  above zero are as today, and the lowest label stays hidden when a bar is below zero.
- The bar is still drawn below zero.
- The detail draws no bar at or below zero, so it does not change here.
- Tests:
  - `period=lastMonth`, the button for 22 Sep (the fixture's Pizzeria Roma refund) is named
    `` `22.9.2026, +${kr(20000)} ${da.refundMark}` ``; the button for 1 Sep still `` `1.9.2026, ${kr(800000)}` ``.
  - `axisTickKr(-20000)` equals `axisKr(20000)`; `axisTickKr(20000)` equals `axisKr(20000)`.

## 5. Tests that change on purpose

- `format.test.ts`: `barKr(-20000)` becomes `` `+${kr(20000)} ${da.refundMark}` ``.
- The month days test that names 22 Sep `` `22.9.2026, +${kr(20000)}` `` gains `da.refundMark`.
- `dayUnits` is read only in `src/` (`model/circle.ts`, `screens/overview.ts`); those callers move to `finerUnits`.
- Any test that looks up the Søjler region, or the detail's list, by the coarse grouping on a one-unit week, quarter or
  year period, or by `da.detailPer("month")` on a one-month period.

## 6. Docs

- D53: a period with one unit draws finer units on the Søjler card and in the detail, decided by `finerUnits`: days
  for a week or a month, months for a quarter or a year, stepping again while there is still one unit, down to days.
  "Denne måned" (and, per Thomas's answer, "I år" and "Alt") draws on to the earlier of its own last day and the end
  of its one unit, the units after today as empty slots. The grouping, the hash, the key numbers and the chosen unit
  stay the period's; a click on a finer bar chooses the period's unit. A bar below zero is named "+… kr.
  retur", and the y-axis ticks below zero have no sign. D51's status becomes `active; the detail's bars, the one-unit
  Uge, Kvartal and År periods and the name below zero superseded by D53`.
- `docs/README.md`: the new spec and its plan in the map.
- `docs/mockups/README.md`: a section for `v6/`, with A chosen and B tried for the refund.
- `docs/testing.md`: a Chrome-check item: a custom one-week period by Uge, a custom one-quarter period by Kvartal,
  "I år" and "Sidste år" by År, "Sidste måned" by Kvartal (days), "Denne måned" by Uge and by Kvartal, and the detail
  of a fixed expense on "Sidste måned", at 420, 1440 and 1728 px, normal
  and full screen. The finer bars, their titles, no average line, the running unit lighter, the detail's names thinned
  and readable, and a click choosing the whole period. A day below zero (if the example data has one): its tooltip says
  "+… kr. retur", and the axis under zero has no minus.
- The domain language: "Refund" gets its Danish word on the page, "retur", in `docs/domain-language.md`.
