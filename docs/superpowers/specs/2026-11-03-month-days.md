# A one-month period's days – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issue:** #84. One branch, one PR.

Today a period inside one calendar month, by Måned, has one unit, so the Søjler card draws one bar that fills the
card. It says nothing the key numbers do not already say.

This spec changes the [UI spec](2026-10-30-ui-ux-design.md) §4.2 (Søjler) and §4.4 (a click on a bar) only where a
section below says so, and [D19](../../decisions.md)'s "one button per bar" for the day bars. Everything else there
holds.

**Thomas's ruling, 2026-11-03:** "finer grouping; let's start with all the month's days". With a one-month period
("Sidste måned", "Denne måned") and Gruppér pr. Måned, the Søjler card shows one bar per day of the month.

**Claude's calls, for Thomas to see in the PR:**

- Days show when Gruppér pr. is Måned and the period lies inside one calendar month, whole or not. Uge, Kvartal and År
  periods with one unit stay as today; Claude files an issue for them (§1).
- Only the Søjler card changes. Gruppér pr. still shows Måned, the hash keeps no `by`, and the key numbers, Posteringer,
  Alle posteringer, Forskel and the detail's bars stay by month (§2). So every old link means what it meant (D20).
- "Denne måned" draws the whole month: the days after today are empty slots (D23). Otherwise the card would again be
  one bar on the 1st of the month (§1).
- The title says "Pr. dag" ("Mad pr. dag"), since that is what the bars show (§3).
- The average line is left out on day bars: the key numbers' average is a month's, about 30 times a day's bar (§3).
- A day is not a choice: a click on a day bar does nothing, and the hidden list holds the days' names as text, not
  buttons (§4). Choosing a day would need a new hash key, since a day's start on the 1st is the month's `unit`. The
  cost: on a one-month period, the month can no longer be chosen from its bar, so Forskel against the 12 months before
  is reached only by an old link. Choosing the month from a longer period still gives Forskel against that period's
  other months. Nothing is lost for a single day: Gruppér pr. Dag on the same period draws the same days, and there
  each can be chosen, with a day's key numbers and Forskel.
- This is D51.

## 1. When the days show

- The Søjler card draws days when the grouping is `month` and `unitsOf(period, "month", today)` has exactly one unit.
  This is "Denne måned", "Sidste måned" and a custom period inside one month (5.–20. okt). It is not `isOneUnit`: a
  custom 1. okt – 3. nov on 3 Nov has one whole unit but two months, and keeps two month bars.
- The days run from the period's start to its end. When the period ends today and today is not the month's last day,
  they run on to the month's last day; the days after today are empty slots, not "i gang" (D23). So "Denne måned" on
  30 Oct has 31 days, the 30th running, the 31st empty. A custom 5.–20. okt has 16 days.
- Today's day is the running unit: its bar is lighter and its label and name end with "i gang", by `isRunning`, as for
  any unit.
- The days come from `unitsOf(daysSpan, "day", today)`, totalled with `unitTotals` on `ctx.shown`, and labelled with
  `unitAxis` and `unitName` under `"day"` ("5.10.", "5.10.2026"). The axis thins its labels by `axisLabelShown`, as
  today.
- The fetched range does not change: `fetchRange` already holds the whole period.
- Every other grouping, and a month grouping over two or more months, draws as today.
- Tests (by role and name, the fixture's today 30 Oct 2026; "the bars' list" is the one `list` in the Søjler region):
  - `period=lastMonth`: the bars' list has 30 items, the first named "1.9.2026, …" and the last
    "30.9.2026, …".
  - `period=thisMonth`: 31 items; the 30th item's name contains `da.inProgress`; the 31st does not.
  - `period=custom&from=2026-10-05&to=2026-10-20`: 16 items.
  - `period=custom&from=2026-09-15&to=2026-10-14`: 2 items, September and October, as today.
  - `period=lastMonth&by=week`: the week items, as today.
  - The sum of a day's postings in the fixture is the amount in its item's name.

## 2. What stays the month's

- `ViewContext` keeps `timeline.grouping` and `units` as they are: one month unit. The days are a list of their own,
  made for the Søjler card only (in `barItems` or beside it). Nothing else reads it.
- Gruppér pr. still shows Måned as chosen; the hash keeps `by` absent; no key is added or read differently.
- The key numbers do not change: "Gennemsnit pr. måned" over the 12 months before, and the last month against the one
  before ("September mod august"), since that is what a month period is for (D16).
- Posteringer and Alle posteringer still group by month (one group line). The detail's bars stay by month (one bar);
  that is outside Thomas's ruling.
- Tests: on `period=lastMonth`, the hash stays `#period=lastMonth`; Gruppér pr.'s Måned is pressed; the third key
  number's label is "September mod august"; Posteringer has one group line for September 2026. Gruppér pr. is a
  `select` whose value stays `month`.

## 3. The card's title and the average line

- With days shown, the Søjler card's title, and so its region's name, is `da.per("day")` ("Pr. dag") at Alt forbrug
  and `da.levelPer(name, "day")` ("Mad pr. dag") at a main group or a category (the main group's name, as the
  [UI polish spec](2026-11-03-ui-polish.md) §1.2 says). The full-screen card's title follows.
- No average line is drawn, and the hidden list has no average text.
- Tests: on `period=lastMonth` the region `da.per("day")` exists and `da.per("month")` does not; with `group=Mad` the
  region is `da.levelPer("Mad", "day")`; no text `da.average(…)` in it. On the default period the title and the average
  are as today.

## 4. A click on a day bar

- A day bar is not a choice. A click on the chart fires no `unit-click`. The visually hidden list beside the chart has
  one list item per day with the same text the button would have had ("5.10.2026, 120 kr.", with " (i gang)" for
  today), and no button.
- A chosen month on a one-month period (an old link `period=lastMonth&unit=2026-09-01`) works as today: its chip, the
  unit key numbers and Forskel. The day bars then show unfaded; none is marked chosen. In particular day 1, whose start
  equals the month's `unit`, is not marked.
- Bars of every other kind keep their buttons and clicks.
- Tests:
  - `period=lastMonth`: the bars' list (§1) holds no button; a chart click (through the mock's click handler) leaves the
    hash at `#period=lastMonth`.
  - `period=lastMonth&unit=2026-09-01&card=difference`: the chip `da.remove("September 2026")` and the Forskel table
    show.
  - `period=lastMonth&unit=2026-09-01` on Søjler: the chart's first bar is not shaded or faded apart from the rest. This
    is a Chrome-check item, since tests do not read the chart's options (D19).
  - The default period: the bars are buttons and a click chooses a month, as today.

## 5. Tests that change on purpose

Any test that looks up the Søjler region by `da.per("month")`, or a bar button, on a period inside one month. The
default period is "I år", so the builder checks the tests on `thisMonth`, `lastMonth` and custom one-month periods;
none was found that does.

## 6. Docs

- D51: a period inside one calendar month by Måned draws its days on the Søjler card; the grouping, the hash, the key
  numbers and the chosen unit stay the month's; the days are not a choice, so their hidden list has no buttons (an
  exception to D19).
- D19's status becomes "active; the chunk-size limit superseded by D39; the day bars' buttons superseded by D51".
- `docs/README.md`: the new spec and its plan in the map.
- `docs/testing.md`: a Chrome-check item: "Sidste måned" and "Denne måned" at Alt forbrug and Mad, at 1440 and 1728 px,
  normal and full screen. One bar per day, readable axis labels, today lighter with "i gang", the days after today
  empty, no average line, a click on a bar does nothing. With `unit=<the month>` in the hash, no bar is faded.
- The domain language does not change.
- Issue to file: finer bars for one-unit Uge, Kvartal and År periods.
