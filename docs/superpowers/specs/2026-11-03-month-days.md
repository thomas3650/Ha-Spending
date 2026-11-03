# A one-month period's days – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issue:** #84. One branch, one PR.

Today a period inside one calendar month, by Måned, has one unit, so the Søjler card draws one bar that fills the
card. It says nothing the key numbers do not already say.

This spec changes these rules of the [UI spec](2026-10-30-ui-ux-design.md), for the day bars only; everything else
there holds:

- §3.3: "one bar per grouping unit", "a dashed line for the average" and "a click on a bar chooses that unit";
- §4.1: the title "Pr. måned (or the chosen grouping)";
- §4.2: Søjler is "the group per grouping unit", and a Posteringer group line "is its bar";
- §4.4: a click on a bar filters to that bar's unit, and the other bars fade.

**Thomas's ruling, 2026-11-03:** "finer grouping; let's start with all the month's days". With a one-month period
("Sidste måned", "Denne måned") and Gruppér pr. Måned, the Søjler card shows one bar per day of the month.

**The controller's ruling, 2026-11-03:** a click on a day bar chooses the month (§4).

**Claude's calls, for Thomas to see in the PR:**

- Days show when Gruppér pr. is Måned and the period lies inside one calendar month, whole or not. Uge, Kvartal and År
  periods with one unit stay as today; Claude files an issue for them (§1).
- Only the Søjler card changes. Gruppér pr. still shows Måned, the hash keeps no `by`, and the key numbers, Posteringer,
  Alle posteringer, Forskel and the detail's bars stay by month (§2). So every old link means what it meant (D20).
- "Denne måned" draws the whole month: the days after today are empty slots (D23). Without them the card would again
  be one bar on the 1st of the month. This is new: "I år" still ends today. A custom period ends where the user set it
  (§1).
- The title says "Pr. dag" ("Mad pr. dag"), since that is what the bars show (§3).
- The average line is left out on day bars: the key numbers' average is a month's, about 30 times a day's bar (§3).
- A click on a day bar chooses its month, so Forskel, "Mod gennemsnit" and the month's Posteringer stay reachable, with
  no new hash key. The cost, plainly: a click on 12 Sep chooses all of September. A single day is chosen with Gruppér
  pr. Dag on the same period, which draws the same days, each its own unit (§4).
- With the month chosen, every day bar is marked chosen and none fades; the chip shows the choice (§4).
- This is D51.

## 1. When the days show

- One function of the view context decides it: `dayUnits(ctx): Unit[] | null` in `model/context.ts`. It returns the
  day units when the days show and `null` otherwise. `barItems`, the Søjler card's title, its average line and the
  bars' chosen state all read it; nothing else decides "days shown".
- It returns days when `ctx.timeline.grouping` is `month` and `ctx.units` has exactly one unit. This is "Denne
  måned", "Sidste måned" and a custom period inside one month (5.–20. okt). It is not `isOneUnit`: a custom 1. okt –
  3. nov on 3 Nov has one whole unit but two months, and keeps two month bars.
- The days are `unitsOf(daysSpan, "day", today)`. `daysSpan` is the period, except for the preset "Denne måned", where
  it runs from the period's start to the month's last day. So "Denne måned" on 30 Oct has 31 days, the 30th running
  and the 31st an empty slot, not "i gang" (D23). A custom 5.–20. okt has 16 days, also when the 20th is today.
- Today's day is the running unit by `isRunning`, as for any unit: its bar is lighter, its axis label ends with "i
  gang" on a second line, and its hidden button's name is "30.10.2026 (i gang), 0 kr." with the fixture, as
  `buttonName` writes it.
- Each day's amount is `unitTotals(ctx.shown, days)`; its labels are `unitAxis` and `unitName` under `"day"` ("5.10.",
  "5.10.2026"). The axis thins its labels by `axisLabelShown`, as today.
- The fetched range does not change: `fetchRange` already holds the whole period.
- Every other grouping, and a month grouping over two or more months, draws as today.
- Tests (the fixture's today 30 Oct 2026; "the bars' list" is the one `list` in the Søjler region; a bar is read by
  its button's name):
  - `period=lastMonth`: the bars' list has 30 buttons, the first named "1.9.2026, 8.000 kr." and the last
    "30.9.2026, 0 kr.".
  - With an extra posting of 150 kr. on 2026-09-20 added to the answer (as the `answer` option of `mount` allows), the
    button for 20 Sep is "20.9.2026, 850 kr." (Pizzeria Roma's 700 kr. and the 150 kr.).
  - `period=thisMonth`: 31 buttons; the 30th's name contains `da.inProgress`; the 31st's does not.
  - `period=custom&from=2026-10-05&to=2026-10-20`: 16 buttons.
  - `period=custom&from=2026-09-15&to=2026-10-14`: 2 buttons, September and October, as today.
  - `period=lastMonth&by=week`: the week buttons, as today.

## 2. What stays the month's

- `ViewContext` keeps `timeline.grouping`, `units` and `chosen` as they are: one month unit. The days are made by
  `dayUnits` for the Søjler card only.
- Gruppér pr. (a `select`) keeps the value `month`; the hash keeps `by` absent; no key is added or read differently.
- The key numbers do not change: "Gennemsnit pr. måned" over the 12 months before, and the last month against the one
  before ("September mod august"), since that is what a month period is for (D16).
- Posteringer and Alle posteringer still group by month (one group line). The detail's bars stay by month (one bar).
- Tests: on `period=lastMonth`, the hash stays `#period=lastMonth`; Gruppér pr.'s value is `month`; the third key
  number's label is "September mod august"; Posteringer has one group line for September 2026.

## 3. The card's title and the average line

- With days shown, the Søjler card's title, and so its region's name, is `da.per("day")` ("Pr. dag") at Alt forbrug
  and `da.levelPer(name, "day")` ("Mad pr. dag") at a main group or a category (the main group's name, as the
  [UI polish spec](2026-11-03-ui-polish.md) §1.2 says). The full-screen card's title follows.
- No average line is drawn, and the hidden list has no average text.
- Tests: on `period=lastMonth` the region `da.per("day")` exists and `da.per("month")` does not; with `group=Mad` the
  region is `da.levelPer("Mad", "day")`; no text `da.average(…)` in it. On the default period the title and the
  average are as today.

## 4. A click on a day bar

- The day bars are buttons, as every bar is (D19), each named for its day. A click on a day bar, or on its button,
  fires `unit-click` with the month's `fullStart` (`ctx.units[0].fullStart`), so `chooseUnit` chooses the month, or
  removes it when it is already chosen. The chosen month's chip ("September 2026 ✕") shows, and the card goes to
  Posteringer, as for any chosen unit.
- The chart's hover emphasis, cursor and tooltip are as for any bar; the tooltip gives the day, its date and its
  amount.
- While the month is chosen, every day bar is marked chosen: each button has `aria-pressed="true"`, and no bar fades.
  The day bars all lie in the chosen unit, so none is apart from it. In particular, no bar is chosen alone because its
  start equals the month's `unit`.
- Bars of every other kind keep their clicks as today.
- Tests:
  - `period=lastMonth`: a click on the button for 12 Sep sets the hash to
    `#period=lastMonth&unit=2026-09-01&card=postings` and shows the chip `da.remove("September 2026")`.
  - `period=lastMonth&unit=2026-09-01` (on Søjler): every button in the bars' list has `aria-pressed="true"`. A click
    on any day's button removes the unit from the hash and the chip; the hash is `#period=lastMonth`, the card stays
    Søjler, and every `aria-pressed` is `"false"`.
  - A chart click (through the mock's click handler) on a day's index chooses the month the same way.
  - `period=lastMonth&unit=2026-09-01&card=difference`: the chip and the Forskel table show.
  - The default period: a click on July's bar chooses July, as today.

## 5. Tests that change on purpose

Any test that looks up the Søjler region by `da.per("month")`, or a bar's button, on a period inside one month. The
default period is "I år", so the builder checks the tests on `thisMonth`, `lastMonth` and custom one-month periods;
none was found that does.

## 6. Docs

- D51: a period inside one calendar month by Måned draws its days on the Søjler card, decided by `dayUnits`; "Denne
  måned" draws on to the month's last day, the days after today as empty slots; the grouping, the hash, the key
  numbers and the chosen unit stay the month's; a click on a day bar chooses the month, and the chosen month marks
  every day bar.
- `docs/README.md`: the new spec and its plan in the map.
- `docs/testing.md`: a Chrome-check item: "Sidste måned" and "Denne måned" at Alt forbrug and Mad, at 1440 and 1728
  px, normal and full screen. One bar per day, readable axis labels, today lighter with "i gang", the days after today
  empty, no average line, the tooltip on a day. A click on a day chooses the month: its chip shows, no bar fades, and a
  second click removes it.
- The domain language does not change.
- Issues to file: finer bars for one-unit Uge, Kvartal and År periods; the detail's single bar on a one-month period.
