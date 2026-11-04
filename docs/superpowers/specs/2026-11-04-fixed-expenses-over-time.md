# The fixed expenses over time – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`, no server change.

**Issue:** closes #163. One branch, one PR.

**Approved:** not yet. Thomas approves this spec after `reviewer` rates it Ready.

Thomas and Claude brainstormed this on 2026-11-04 with the mockup
[`v7/faste-udgifter.html`](../../mockups/v7/faste-udgifter.html). Thomas's words are quoted or named as his; the
mockup's layout (key numbers on top, bars on the left, payments on the right, hatched estimates) is what he called
"på den rigtige vej". Every other detail is marked "Claude's call". Where the mockup and this spec differ, the spec
holds. Everything else in the [UI spec](2026-10-30-ui-ux-design.md) and the later specs holds, the
[top filter spec](2026-11-04-top-filter.md) above all.

"Today" in this spec is the answer's `today` (`SpendingData.today`), as the Faste udgifter tab uses it.

## 1. Why

Thomas misses an overview of what the fixed expenses cost per month: "der er nogle måneder med flere faste udgifter
end andre" (a yearly insurance, a quarterly payment, a month with five weekly payments). He wants the coming payments
too, "synligt det er et estimat", and with "I år" what was paid so far, what remains and the estimate for the year.

- **Goal:** one view that shows the fixed expenses per unit as bars, paid and expected, and the payments under each
  bar.
- **Goal:** the expected payments are visibly an estimate, everywhere they show.
- **Non-goal:** changing the Faste udgifter tab or its full screen. Thomas: "tænker ikke vi skal ændre ved full screen
  knappen".
- **Non-goal:** a detail beside the payments, a sort, or the quick filter in this view (§6.4).
- **Anti-goal:** an estimate that reads as money already paid.

## 2. The way in and out

- The link **"Vis faste udgifter →"** under an object-group key number (D41, D62) opens **the fixed-expenses view**
  with that object group chosen (§3.4). It pushes a history entry. Thomas chose these two ways in. Today the link
  opens the Faste udgifter tab; that part of D62 is superseded (§11).
- The top filter comes along: the period, the chosen unit, the main group, the category and the accounts. The quick
  filter stays in the state as a shared choice (D61) but is not shown in the view.
- The Faste udgifter tab, its ⤢ button and its full screen do not change.
- **Out:** a ← button before the trail and Escape (when no dropdown or list is open) leave the view. The ← button is
  outside the "Sti" landmark, named "Tilbage til overblikket" and with no text node. Claude's call.
  - When the view's open was pushed in this page load and nothing has been pushed since, they go back one entry.
  - Otherwise they replace the current entry with the view off. Choosing an object group, a bar, a period or a level
    in the view each push an entry, so after any of them ← replaces.
  - On the way out a chosen unit the overview's period does not have is dropped (§7). Claude's call, as top filter
    spec §3.2 does for full screen.
- The view is in the hash (§7), so Back and a reload work.

## 3. The top card

### 3.1 The trail

The view's trail adds one step, the object group, right after "Alt forbrug". The other steps follow D59's order:

- `← Alt forbrug › Faste udgifter ▾ › I år ▾ [Måned] [Hovedgruppe]`
- `← Alt forbrug › Faste udgifter ▾ › I år ▾ › August ▾ × [Hovedgruppe]`
- `← Alt forbrug › Alle faste udgifter ▾ › I år ▾ [Måned] › Bolig ▾ × [Kategori]`

Thomas chose the object group first, over the mockup's main group first, so the rest reads as on the overview ("vi
holder os til det er ens"), with the month after "I år". The period step, the unit step, the main group and category
steps and the dashed button work as on the overview (top filter spec §2), with these differences:

- The main group and category lists list the pieces of the overview's circle at that level, as on the overview, though
  the view has no circle.
- "Alt forbrug" is a link as D55 says: it removes the unit, the main group and the category, and stays in the view.
  Claude's call.
- The unit step (§3.2) names and lists the view's units, which may be ones the overview's period does not have
  (§5.1).

Konti stays on the right, as on the overview.

### 3.2 The unit step, on both screens

Thomas: "så man kan vælge måned fra toppen som de andre", and "top bjælken er den samme for hele websitet". This
section changes the overview's trail too; it supersedes top filter spec §2.4's "the unit step is plain text with its
×".

- **No unit chosen:** a dashed button right after the period, named after the grouping: **"Måned"** or **"År"**. Its
  accessible name is "Vælg måned" or "Vælg år".
- **A unit chosen:** the step is a button with ▾ and its ×, like the main group: `I år ▾ › August ▾ ×`. Its accessible
  name is "Skift måned: August" (or "Skift år: 2025"). The × removes the unit, as today (D55).
- **The list** opens under the step or the dashed button. Its rows are the bars' units, in time order: on the overview
  the period's units (`ctx.units`), in the view the view's units (§5.1). Each row has the unit's name and its sum: on
  the overview the spending in that unit at the level and accounts, as its bar; in the view "9.799 kr. + ca. 1.074
  kr.", as its bar's name (§5.4). The chosen one is marked with `aria-current`. Claude's call on the rows.
- The buttons and their lists follow the trail's other steps (`components/level-menu.ts`): `aria-expanded` and no
  `aria-haspopup`, and the list is a `role="group"` of plain buttons. The branch
  `fix/filter-follow-ups-and-full-screen-bars` sets that rule; the object-group step (§3.4) follows it too.
- With "Alt" grouped by År, the same step switches the year: "Skift år: 2025". Thomas: "hvis alt er valgt kan man også
  skifte år på samme måde".
- Choosing a row chooses the unit as a bar press does: it pushes a history entry, and a bar press still works.
- **Where the bars are not buttons** (days, a one-month period, D59) there is neither step nor dashed button, as now.
- While the answer loads and on an error, the trail leaves the unit step out, as today, and the dashed button is
  disabled, as the level's dashed button is (top filter spec §2.5).
- With nothing chosen, the trail has two dashed buttons side by side: `Alt forbrug › I år ▾ [Måned] [Hovedgruppe]`.
  With a main group chosen and no unit, the dashed "Måned" stays after the period:
  `Alt forbrug › I år ▾ [Måned] › Bolig ▾ × [Kategori]`. Claude's call.

### 3.3 Unit names within one year

Thomas: "hvis kun 1 år er valgt måned er uden årstal". This holds on both screens.

- When every unit of the bars lies in one calendar year, a unit's name has no year: "August", "4. november". When the
  units cross a new year, as "Sidste 12 måneder" in November does, every name keeps its year: "August 2026". A year
  unit is always its year, "2026".
- Everything that names a unit follows: the trail's unit step and its list, the bars' tooltips and buttons, the
  Posteringer group lines, the key-number labels ("Faste udgifter i August", D56), and in the view the list's title and
  group lines. The axis labels stay as today.
- `unitName` gets this rule; the builder decides how it learns whether the units cross a year. Claude's call.

### 3.4 The object-group step

Thomas: "kan vælge mellem de 3 i top baren som i år".

- The step is a button with ▾, like the period. Its text is the chosen object group's title as Firefly III gives it
  (D38), or **"Alle faste udgifter"** for all of them. Its accessible name is "Skift objektgruppe: Faste udgifter",
  Claude's call on "Alle faste udgifter"; the mockup wrote the group names joined, which would
  change the data's own titles.
- A press opens a list under the step: one row per object group, by name, then **"Alle"**. The rows are the object
  groups the overview's key numbers show (D41's set in `objectGroupCards`: the subscriptions' groups and the groups
  found on the period's postings), so every card's link opens its own group.
- Under each row's name: the count of that group's subscriptions that the Faste udgifter tab shows at the level and
  accounts (`shown` in `model/subscriptions.ts`), and the paid sum in the period at the level and accounts (§5.3):
  "5 stk. · 124.031 kr. i perioden". A group found only on postings reads "0 stk.". "Alle" counts every posting
  with a bill link and every subscription. The chosen row is marked with `aria-current`. Claude's call.
- Choosing a row pushes a history entry and removes the chosen unit. Claude's call: the unit's bar may be empty in the
  new set.
- With one object group, the step is plain text with that group's title, and there is no "Alle". Claude's call.

## 4. The key numbers

The key-number row under the top card holds the view's own cards; the overview's cards (D41, D56) are not shown. "ca."
before an amount marks an estimate, in a smaller, lighter font. The cards follow the period, not a chosen unit, since
the unit narrows the list (§6) and the year's numbers should stay in sight. Claude's call.

Below, "paid", "estimates" and "not seen" are §5.3's. A sum of estimates counts every estimate of the drawn span,
including a due one (Forfalden).

**"I år"**, Thomas's four:

| Card | Value | Under it |
| --- | --- | --- |
| Betalt i år | the paid sum | "1. jan – 4. nov 2026", then "· 1 ikke set" when the period has a not-seen row |
| Resterende udgifter | ca. the estimates' sum | "16 betalinger til 31. dec" |
| Estimat for hele 2026 | ca. paid + estimates | "betalt + ca. 13.048 kr. til 31. dec" |
| Pr. måned i snit | ca. the year's estimate / 12 | "hele 2026 delt med 12" |

Thomas dropped "Dyreste måned" and "Billigste måned".

The other periods, Claude's call:

- **"Denne måned":** "Betalt i november", "Estimat for hele november" (as above), and "Næste betaling": the earliest
  estimate's amount, with "5. nov · Mobilabonnement" under it, or "–" with "ingen flere i november".
- **"Alt":** "Betalt i alt" (from the period's first day to today), "Betalt i <running unit>" and "Estimat for hele
  <running unit>".
- **Any other period** (it has no estimates, §5.1): "Betalt i perioden" (its dates under it, then "· n ikke set") and
  "Gennemsnit pr. måned", which divides the paid sum by the period's length in months as `objectGroupCards` does today.
  A period shorter than 28 days has no average, as there.

## 5. The bars

The left half holds the bars, titled "<object-group step text> pr. måned" (or "pr. dag", "pr. år").

### 5.1 The span and the units

- **The grouping** is the period's (D59: `groupingFor` on the period), so a unit means the same on both screens.
- **The drawn span** starts on the period's first day. Three presets run on past today, Claude's call:
  - **"I år"** runs to 31 December;
  - **"Denne måned"** runs to the month's last day;
  - **"Alt"** runs to the last day of the grouping's unit that holds today.

  Every other period, a custom one included, is drawn to its own last day and has no estimates.
- **The units** are the grouping's units over the drawn span (`unitsOf`). When the drawn span is one month, they are
  its days instead, as `finerUnits` draws them. So "I år" is always twelve months, also in January; "Denne måned"
  draws its days.
- **A chosen unit** is resolved against these units, not the overview's. So December, or any month of "I år" in
  January, can be chosen in the view. The bars are buttons whenever there are two or more units; with days (one
  month), they are not, as D59 says.
- **In the three presets that run on, the units after today** hold estimates instead of being empty slots (D23). A
  unit that has begun and runs past today is the running unit, as today.
- "Sidste 12 måneder" and the other presets end before today's month, so they have no running unit and no estimates.

### 5.2 Colours follow the tree

Thomas: "forskellige farver … afhængigt af hvor i træet de er".

- At **Alt forbrug** each bar is stacked by main group; in a **main group**, by category; in a **category**, by fixed
  expense.
- A main group or category keeps its colour from the overview's circle at that level (`partColours`,
  `categoryColours`), so the same part has the same colour on both screens.
- A part that is grey in the circle, or has no piece there, takes the first colour of `PALETTE`
  (`shared/src/circle.ts`) that no other part of these bars uses. Fixed expenses in a category take `PALETTE` in turn.
  Parts are taken largest first, by paid plus estimates over the drawn span. When the palette runs out, the rest are
  greys, as in the circle. Claude's call; it extends D16's colours to parts the circle does not colour.
- A paid payment's part is its posting's category and that category's main group. An estimate's or a not-seen row's
  part is the subscription's last payment's category, as the Faste udgifter tab decides it. No category is "Uden
  kategori", and no main group is "Uden hovedgruppe".

### 5.3 Paid, estimate, not seen

- **Paid** is a posting in the drawn span up to today, linked to a bill of the chosen object groups
  (`Posting.subscription`), in the chosen accounts and level. It counts as the object-group key number counts it; a
  refund counts negative.
- **The due dates** of a subscription of the chosen object groups, in the chosen accounts and level as `shown` decides
  it, are `dueDate(s, k)` from `nextDate`'s k onward, up to the drawn span's end, stopping at the subscription's end
  date. Each date is counted from the start, so a bill due on the 31st does not drift after February. A new exported
  function in `shared/src/subscriptions.ts` lists them; `shown` is exported or moved for the view.
- Each due date is one of:
  - **not seen**, when it is `nextDate` and the status is "Ikke set": a row in its unit (§6), with no amount in any
    sum;
  - **nothing**, when it is another date before today: the later misses of a not-seen subscription do not show;
  - **an estimate** otherwise, of `amountPerPayment` (D63). That includes a due one (`nextDate` before today, D64's
    "Forfalden") and one due today. Claude's call.
- A due date before the drawn span's first day shows nowhere and counts in no sum, such as a Forfalden of 30 October
  in "Denne måned" in November.
- Not-seen rows are not payments: they are not counted in "n betalinger". Claude's call.

### 5.4 How they look

- Paid is drawn in the part's colour. An estimate is drawn **hatched** in the same colour, lighter, stacked above every
  paid part of its bar. So the running unit shows its paid part at the bottom and its estimates on top.
- A dashed vertical line marked **"i dag"** sits on the running unit, when the drawn span runs past today.
- **The legend** is in the DOM above the chart, not ECharts': each part's colour swatch and name, then a hatched swatch
  with "Skraveret: estimat efter i dag" when there are estimates.
- The tooltip names the unit and its sums: "Betalt: …", and with estimates "Estimat: ca. …" and "I alt: ca. …".
- **Each bar is a button** as on the overview (D19), named with the unit and its sums:
  - "August: betalt 13.975 kr.";
  - "November: betalt 9.799 kr., estimat ca. 1.074 kr.";
  - "December: estimat ca. 11.174 kr.";
  - "Marts: ingen betalinger" (with "I år"; the names follow §3.3).

  A press chooses the unit (the trail's unit step); a second press, or its ×, removes it. The other bars are drawn
  faded while a unit is chosen.

## 6. The payments

The right half lists the payments.

### 6.1 Without a chosen unit

- Title: "Poster i perioden". Claude's call, from Thomas's "de poster der er under hver søjle".
- Under it one line: "117 betalinger · betalt 129.260 kr. · estimat ca. 13.048 kr. · i alt ca. 142.308 kr.", the
  estimate parts only when there are estimates.
- The rows are grouped by unit, newest first, so the estimates come first; with days ("Denne måned"), by day, only the
  days that have rows. Each group line has the unit's name, its count ("10 betalinger", with "· estimat" when all are
  estimates and "· i gang" for the running unit) and its sum ("9.799 kr. + ca. 1.074 kr." when mixed).
- Inside a group the rows go by date, oldest first. Claude's call.

### 6.2 With a chosen unit

The title is the unit's name ("August"). The sum line counts that unit only. The rows are the unit's, with no
group line.

### 6.3 The rows

| Column | Paid | Estimate | Not seen |
| --- | --- | --- | --- |
| Dato | "1. aug" | the due date | the expected date |
| Fast udgift | its part's colour dot, the bill's name, its object-group badge | the same | the same |
| Kategori | the posting's category | the last payment's category | the same |
| Beløb | "9.500 kr." | "ca. 9.500 kr.", in italics | "–" |
| Status | "Betalt 1. aug" (green) | "Estimat · forventes 1. dec" (grey, dashed border) | "Ikke set · ventet 4. okt" (red) |

Thomas asked for the expected date with the estimate. A due estimate reads "Estimat · forfalden 3. nov".

- The Kategori column shows at Alt forbrug and in a main group, and not in a category. Claude's call.
- **A year unit** ("Alt" by År) holds about 150 payments, so its rows are one per fixed expense: the name with "12
  betalinger · heraf 2 estimat, næste forventes 1. dec · 1 ikke set" under it (each part only when it applies), the
  category and the sum ("ca. 3.343 kr." when it holds an estimate). Biggest sum first. Claude's call.
- No cell wraps; a long text ends in "…" with its full text in a tooltip, as in Posteringer.
- **Empty:** "Ingen faste udgifter i <level> i perioden" (`levelName`).

### 6.4 Not in this view

The rows are not buttons and open no detail; the table has no sort headers; the quick filter is not shown. Claude's
call: the view is the overview Thomas asked for, and each can follow as its own issue.

## 7. The hash

D20's rules hold. One new value and one new key:

| Key | Meaning |
| --- | --- |
| `view` | `full` as today, or **`fixed`** for this view |
| `og` | **new:** the chosen object group's title; absent is "Alle faste udgifter". Read only with `view=fixed`, written right after `view` |

- `og` falls back to absent (Alle) when it is not in §3.4's set of object groups, or when there is only one.
- `view=fixed` falls back to the overview when the answer has no subscriptions, as the link then does not exist.
- **`unit` with `view=fixed`** is kept when the bars are buttons and the view's units (§5.1) have a unit starting on
  that date; otherwise it is dropped. This is an exception to top filter spec §6's `unit` rule, for the view only.
- **Leaving the view** by a replace (§2) drops a `unit` the overview's period does not have, by §6's rule.
- With `view=fixed`, `card` keeps the overview's tab, so leaving shows the tab the view was opened from. `detail` is
  dropped. Claude's call.

## 8. Loading and errors

While the answer loads, the view shows the trail's steps from the state and placeholders for the key numbers, the bars
and the list, as the overview does. On an error it shows the overview's error line. The period step, Konti and the ←
button work in both, as on the overview (top filter spec §2.2). Claude's call.

## 9. Tests and checks

Made-up data only. Hard rule 5: behaviour through roles, accessible names and rendered text.

- §2: "Vis faste udgifter" under an object-group card opens the view with that group in the object-group step, the
  same period and level, and `view=fixed` and `og` in the hash; `history.back()` returns to the overview's tab. ← and
  Escape right after the open go back, and a following Back does not reopen the view. ← after choosing another object
  group leaves the view by a replace. The Faste udgifter tab's ⤢ still opens its table in full screen.
- §3.1: the "Sti" text reads "Alt forbrug › Faste udgifter › I år Måned Hovedgruppe", and in Bolig "Alt forbrug ›
  Faste udgifter › I år Måned › Bolig Kategori". "Skift objektgruppe: Faste udgifter" opens the groups and Alle with their counts
  and sums; choosing Alle shows "Alle faste udgifter" and removes a chosen unit; with one object group there is no
  list.
- §3.2, on the overview and in the view: with no unit, "Vælg måned" lists the units in time order with their sums;
  choosing one shows "Skift måned: August" with its ×, pushes a history entry and marks the bar; its list switches to
  another month; the × removes it. "Alt" over more than 24 months has "Vælg år". "Denne måned" has neither. While
  loading the dashed button is disabled. The overview's "Sti" text with nothing chosen reads "Alt forbrug › I år Måned
  Hovedgruppe"; the existing trail tests change with it.
- §3.3: with "I år" a chosen unit reads "August" in the trail, the bar's name and the Posteringer group line; with
  "Sidste 12 måneder" in November it reads "August 2026"; with "Alt" by År, "2025".
- §4: with "I år" on 4 November, the four cards' values match the fake data: "Betalt i år" equals the overview's
  key-number value for the same object group; "Resterende udgifter" is the sum of the estimate rows, a due one
  included; "Estimat for hele 2026" is their sum; "Pr. måned i snit" is a twelfth of it. "Denne måned", "Alt" and
  "Sidste år" show §4's cards. No card reads "Dyreste" or "Billigste".
- §5.1: "I år" draws twelve bar buttons, also with today in January, and December can be chosen; "Denne måned" draws
  its days without buttons; "Sidste år" has no estimate and no "i dag" line.
- §5.2: the legend names the main groups at Alt forbrug, the categories in Bolig and the fixed expenses in
  Forsikring. A model test of the colours: a part with a circle colour keeps it, a grey or missing part takes the first
  free palette colour, largest first.
- §5.3: the due-date function's unit tests in `shared`: weekly, quarterly and yearly bills; a skip; an end date; a
  bill that starts on the 31st keeps the 31st (or the month's last day) every month. In the view: a "Forfalden" one and
  one due today are estimates; an "Ikke set" one adds a row with "–" and no amount, and is not counted.
- §5.4: the bar buttons' names read as §5.4's examples.
- §6: without a unit the groups run newest first with their sums; a bar press shows only its unit and the unit step;
  the status texts read "Betalt …", "Estimat · forventes …", "Estimat · forfalden …" and "Ikke set · ventet …"; "Alt"
  by År shows one row per fixed expense; the Kategori column is gone in a category; the empty text shows for a level
  with no fixed expenses.
- §7: `view=fixed` and `og` round-trip; an unknown `og` reads as Alle; `view=fixed` with no subscriptions shows the
  overview; `detail` is dropped with `view=fixed`; a December `unit` with "I år" is kept in the view and dropped when
  ← replaces.
- The Chrome check ([`testing.md`](../../testing.md#chrome-check)) at 1440 and 1728 px: the way in from both
  object-group cards, the object-group list, "I år", "Denne måned", "Sidste år" and "Alt", the hatched estimates and
  the "i dag" line, a chosen unit, the three levels' colours, the way out by ← and Back.

## 10. Docs

Changed in the same PR:

- `addon/DOCS.md`: the view, its way in and out, the estimates; the month step in the trail.
- `docs/domain-language.md`: the fixed-expenses view, an estimate (`estimate` in code), the drawn span; the Object
  group row's link "opens the Faste udgifter card" becomes "opens the fixed-expenses view" with D66; the line on the
  hash keys gets D66.
- `docs/architecture.md`: its "What exists now" sentence gets the view.
- `docs/testing.md`: the Chrome check gets §9's steps, and its trail steps get the month step.
- `docs/README.md`: the map gets this spec's plan. This branch already adds the spec to the map and the mockup to
  `docs/mockups/README.md`.
- `docs/decisions.md`: D66 and D69 below, and the statuses they change. D67 and D68 are taken by the branch
  `fix/filter-follow-ups-and-full-screen-bars`.

## 11. Decisions

### D66: A view of the fixed expenses over time

- **Date:** 2026-11-04 · **Status:** active
- **Decision:**
  - "Vis faste udgifter →" opens a view with the fixed expenses as bars per unit and the payments under them. A trail
    step right after "Alt forbrug" chooses an object group or all of them; the view is `view=fixed` with `og` in the
    hash.
  - Paid is solid. The due dates on and after today, and a due one, are hatched estimates of `amountPerPayment`. "I
    år", "Denne måned" and "Alt" run on past today to their own end; the units after today hold estimates, and a
    chosen unit is resolved against the view's units.
  - The bars stack by the tree's next level in the overview's colours; a part without one takes a free palette colour.
- **Why:** Thomas missed an overview of what the fixed expenses cost per month, backwards and forwards, with the
  estimate visible.
- **Source:** Thomas, 2026-11-04, [fixed expenses over time spec](2026-11-04-fixed-expenses-over-time.md) (in
  `decisions.md` the link is `superpowers/specs/…`). The span, the colour rule for parts without a circle colour and
  the hash rules are Claude's call.

### D69: The unit is a trail step with a list, and a unit within one year has no year

- **Date:** 2026-11-04 · **Status:** active
- **Decision:**
  - On every screen the period is followed by the unit step: a dashed "Måned" or "År" with no unit, or the chosen unit
    with ▾ and ×. Both open a list of the bars' units with their sums. Where the bars are not buttons there is none.
  - When the bars' units lie in one calendar year, a unit is named without its year.
- **Why:** Thomas wanted to choose the month from the top like the other steps, with the same top bar on every screen,
  and a year repeated on every month said nothing.
- **Source:** Thomas, 2026-11-04, [fixed expenses over time spec](2026-11-04-fixed-expenses-over-time.md) §3.2 and
  §3.3. The list's rows and the dashed button's place are Claude's call.

| Decision | Status after this change |
| --- | --- |
| D20 | active; key list superseded by D35, D42, D44, D60, D61 and D66 |
| D23 | active; "a unit after today is empty" superseded in the fixed-expenses view by D66 |
| D62 | active; "opens the Faste udgifter tab in the normal card" superseded by D66 |
