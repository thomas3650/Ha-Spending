# The fixed expenses over time – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`, no server change.

**Issue:** closes #163. One branch, one PR.

**Approved:** not yet. Thomas approves this spec after `reviewer` rates it Ready.

Thomas and Claude brainstormed this on 2026-11-04 with the mockup
[`v7/faste-udgifter.html`](../../mockups/v7/faste-udgifter.html). The rulings are Thomas's unless marked "Claude's
call". Where the mockup and this spec differ, the spec holds. Everything else in the
[UI spec](2026-10-30-ui-ux-design.md) and the later specs holds, the
[top filter spec](2026-11-04-top-filter.md) above all.

## 1. Why

Thomas misses an overview of what the fixed expenses cost per month: some months hold more of them than others (a
yearly insurance, a quarterly payment, a month with five weekly payments). He wants to see it backwards and forwards:
what was paid, what is still to come this year, and what the whole year will cost.

- **Goal:** one view that shows the fixed expenses per unit as bars, paid and expected, and the payments under each
  bar.
- **Goal:** the expected payments after today are visibly an estimate, everywhere they show.
- **Non-goal:** changing the Faste udgifter tab or its full screen. Thomas: "tænker ikke vi skal ændre ved full screen
  knappen".
- **Non-goal:** a detail beside the payments, a sort, or the quick filter in this view (§6.4).
- **Anti-goal:** an estimate that reads as money already paid.

## 2. The way in and out

- The link **"Vis faste udgifter →"** under an object-group key number (D41, D62) opens **the fixed-expenses view**
  with that object group chosen (§3.2). It pushes a history entry. Today it opens the Faste udgifter tab; that part of
  D62 is superseded.
- Everything the top filter holds comes along: the period, the chosen unit, the main group, the category and the
  accounts. The quick filter stays as it is (a shared choice, D61) but is not shown in the view.
- The Faste udgifter tab, its ⤢ button and its full screen do not change.
- **Out:** a ← button before the trail, named "Tilbage til overblikket", and Escape (when no dropdown is open) leave the
  view. They leave it as ⤡ leaves full screen (top filter spec §3.2): back to the entry before the view's open when that
  open was pushed in this page load, otherwise a replace with the view off. Claude's call.
- The view is in the hash (§7), so Back and a reload work.

## 3. The top card

### 3.1 The trail

The view's trail adds one step, the object group, right after "Alt forbrug". The other steps follow D59's order:

- `← Alt forbrug › Faste udgifter ▾ › I år ▾`
- `← Alt forbrug › Faste udgifter ▾ › I år ▾ › August 2026 ×`
- `← Alt forbrug › Alle faste udgifter ▾ › I år ▾ › Bolig ▾ × [Kategori]`

The mockup puts the main group before the object group; the spec keeps D59's order and puts the object group first.
Claude's call. The period step, the unit step, the main group and category steps and the dashed button work as on the
overview (top filter spec §2), with two exceptions:

- The main group and category lists list the pieces of the overview's circle at that level, as today, even though the
  view has no circle.
- "Alt forbrug" works as on the overview (D55): a link that removes the unit, the main group and the category, and
  stays in the view. Claude's call.

Konti stays on the right, as on the overview.

### 3.2 The object-group step

Thomas: "kan vælge mellem de 3 i top baren som i år".

- The step is a button with ▾, like the period. Its text is the chosen object group's title as Firefly III gives it
  (D38), or **"Alle faste udgifter"** for all of them. Its accessible name is "Skift objektgruppe: Faste udgifter",
  with `aria-haspopup`.
- A press opens a list under the step: one row per object group, by name, then **"Alle"**. Each row has the count of
  bills and the paid sum in the period under its name: "5 stk. · 124.031 kr. i perioden". The chosen row is marked with
  `aria-current`. The rows are the object groups that the overview's key numbers show (D41's set).
- Choosing a row pushes a history entry and removes the chosen unit. Claude's call: a unit's bar may be empty in the
  new set.
- With one object group, the step is plain text with that group's title, and there is no "Alle". Claude's call.

## 4. The key numbers

The key-number row under the top card holds the view's own cards. "ca." before an amount marks an estimate, in a
smaller, lighter font. The cards follow the period, not a chosen unit. Claude's call, a change from D56's overview
cards: the unit narrows the list (§6), and the year's numbers should stay in sight while a month is looked at.

**"I år"** (Thomas's four):

| Card | Value | Under it |
| --- | --- | --- |
| Betalt i år | the paid sum | "1. jan – 4. nov 2026", then "· 1 ikke set" when a payment was not seen |
| Resterende udgifter | ca. the estimates' sum | "5. nov – 31. dec 2026 · 16 betalinger" |
| Estimat for hele 2026 | ca. paid + estimates | "betalt + ca. 13.048 kr. til 31. dec" |
| Pr. måned i snit | ca. the whole year's estimate / 12 | "hele 2026 delt med 12" |

**"Denne måned":** "Betalt i november", "Estimat for hele november" (as above), and "Næste betaling" with the next
expected payment's amount and "5. nov · Mobilabonnement" under it. Claude's call.

**"Alt":** "Betalt i alt" (the range from the first unit to today), "Betalt i <running unit>" and "Estimat for hele
<running unit>". Claude's call.

**Any other period:** "Betalt i perioden" (its dates under it, and "· n ikke set") and "Gennemsnit pr. måned", which
divides the paid sum by the period's length in months as the object-group key number does today
(`objectGroupCards`). A period shorter than 28 days has no average, as today. Claude's call.

Thomas dropped "Dyreste måned" and "Billigste måned"; they are not shown.

## 5. The bars

The left half holds the bars, titled "<object-group step text> pr. måned" (or "pr. dag", "pr. år").

### 5.1 The span and the units

- **The drawn span** starts on the period's first day. It ends on the period's last day, except for the three presets
  that end today and have an end of their own (D54): **"I år"** runs to 31 December, **"Denne måned"** to the month's
  last day, and **"Alt"** to the last day of its last unit. Claude's call; D54 already runs these on as empty slots.
- The units are those of the drawn span: `groupingFor` on it, and its days when the span is one month, as `finerUnits`
  draws them. So "I år" is always twelve months (also in January), "Denne måned" draws its days, "Alt" draws months or
  years by D59's rule.
- The payments after today and up to the drawn span's end are **estimates** (§5.3). A period that ends today, such as
  "Sidste 12 måneder", has no estimates; its running unit is drawn lighter, as on the overview.

### 5.2 Colours follow the tree

Thomas: "forskellige farver … afhængigt af hvor i træet de er".

- At **Alt forbrug**, each bar is stacked by main group; in a **main group**, by category; in a **category**, by fixed
  expense.
- A main group or category keeps its colour from the overview's circle at that level, so the same part has the same
  colour on both screens. A part that is grey in the circle, or has no piece there, takes the first palette colour
  (`PALETTE` in `shared/src/circle.ts`) that no other part of these bars uses, the largest part first. When the palette
  runs out, the rest are greys, as in the circle. Fixed expenses in a category take the palette by size. Claude's call.
- The payment's part is its posting's category (and that category's main group) for a paid payment, and the
  subscription's last payment's category for an estimate, as the Faste udgifter tab does. No category is "Uden
  kategori", and no main group "Uden hovedgruppe".

### 5.3 Paid, estimate, not seen

- **Paid** is a posting in the period linked to a bill of the chosen object groups (`Posting.subscription`), in the
  chosen accounts and level, as the object-group key number counts it. A refund counts negative, as there.
- **An estimate** is a due date of a subscription of the chosen object groups, after today and up to the drawn span's
  end. The due dates start at `nextDate` and step by the subscription's repeat and skip, and stop at its end date. A new
  function in `shared/src/subscriptions.ts` lists them. The amount is `amountPerPayment` (D63). A subscription counts
  in the chosen accounts and level as the Faste udgifter tab decides it (`shown` in `model/subscriptions.ts`).
- **A due payment** (D64's "Forfalden", `nextDate` before today and not yet "Ikke set") is an estimate too, in its own
  unit. Claude's call: it is still expected.
- **Not seen:** a subscription whose status is "Ikke set" adds a row in its expected date's unit (§6) and nothing to
  the sums. Only that one expected date is known; older misses do not show. Claude's call.

### 5.4 How they look

- Paid is drawn in the part's colour. An estimate is drawn **hatched** in the same colour, lighter, stacked above all
  the paid parts of its bar. So the running unit shows its paid part at the bottom and its estimate on top.
- A dashed vertical line marked **"i dag"** sits on the running unit, when the drawn span runs past today.
- The legend lists the parts with their colours, then a hatched swatch: "Skraveret: estimat efter i dag".
- The tooltip names the unit and its sums: "Betalt: …", and when it has estimates "Estimat: ca. …" and "I alt: ca. …".
- Each bar is a button as on the overview (D19), named with the unit and its sums, so a test and a screen reader can
  tell paid from estimate. A press chooses the unit (the trail's unit step); a second press or its × removes it. The
  other bars are drawn faded while a unit is chosen. In a one-unit period the bars are not buttons (D59).

## 6. The payments

The right half lists the payments.

### 6.1 Without a chosen unit

- Title: "Poster i perioden". Under it one line: "117 betalinger · betalt 129.260 kr. · estimat ca. 13.048 kr. · i alt
  ca. 142.308 kr.", the estimate parts only when there are estimates.
- The rows are grouped by unit, the newest unit first, so the estimates come first. Each group line has the unit's
  name, its count ("10 betalinger", with "· estimat" when all are estimates and "· i gang" for the running unit) and its
  sum ("9.799 kr. + ca. 1.074 kr." for a mixed unit).
- Inside a group the rows go by date, oldest first. Claude's call.

### 6.2 With a chosen unit

- Title: the unit's name ("August 2026"). The sum line counts that unit only. The rows are the unit's, with no group
  line.

### 6.3 The rows

| Column | Paid | Estimate | Not seen |
| --- | --- | --- | --- |
| Dato | "1. aug" | the due date | the expected date |
| Fast udgift | the colour dot of its part, the bill's name, its object-group badge | the same | the same |
| Kategori | the posting's category | the last payment's category | the same |
| Beløb | "9.500 kr." | "ca. 9.500 kr.", in italics | "–" |
| Status | "Betalt 1. aug" (green) | "Estimat · forventes 1. dec" (grey, dashed border) | "Ikke set · ventet 4. okt" (red) |

Thomas: under Estimat, also when it is expected to be paid. A due estimate reads "Estimat · forfalden 3. nov".

- **A year unit** ("Alt" by År) holds about 150 payments, so its rows are one per fixed expense: the name with "12
  betalinger · heraf 2 estimat, næste forventes 1. dec · 1 ikke set" under it (each part only when it applies), the
  category and the sum ("ca. 3.343 kr." when it holds an estimate). Biggest sum first. Claude's call.
- No cell wraps; a long text ends in "…" with its full text in a tooltip, as in Posteringer.
- **Empty:** "Ingen faste udgifter i <level> i perioden" (`levelName`).

### 6.4 Not in this view

The rows are not buttons and open no detail; the table has no sort headers; the quick filter is not shown. Claude's
call: the view is the overview Thomas asked for, and each can follow as its own issue.

## 7. The hash

D20's rules hold. One new value and one new key, placed as follows:

| Key | Meaning |
| --- | --- |
| `view` | `full` as today, or **`fixed`** for this view |
| `og` | **new:** the chosen object group's title; absent is "Alle faste udgifter". Read only with `view=fixed`, after `view` |

- `og` falls back to absent (Alle) when the answer has no object group of that title, or only one object group.
- With `view=fixed`, `card` keeps the overview's tab, so leaving the view shows the tab it was opened from. `detail`
  is dropped. Claude's call.
- This brings `og` back, which D62 removed, with a new meaning: the view's object group, not a filter of the postings.

## 8. Loading and errors

While the answer loads, the view shows the trail's steps from the state and placeholders for the key numbers, the bars
and the list, as the overview does. On an error it shows the overview's error line. The period step, Konti and the ←
button work in both, as on the overview (top filter spec §2.2). Claude's call.

## 9. Tests and checks

Made-up data only. Hard rule 5: behaviour through roles, accessible names and rendered text.

- §2: "Vis faste udgifter" under an object-group card opens the view with that group in the object-group step, the
  same period and level, and `view=fixed` and `og` in the hash; `history.back()` returns to the overview's tab; ← and
  Escape leave the view and a following Back does not reopen it. The Faste udgifter tab's ⤢ still opens its table in
  full screen.
- §3: the "Sti" text reads "Alt forbrug › Faste udgifter I år Hovedgruppe"; "Skift objektgruppe: Faste udgifter"
  opens the groups and Alle with their counts and sums; choosing Alle reads "Alle faste udgifter" and removes a chosen
  unit; with one object group there is no list.
- §4: with "I år" on 4 November, the four cards' values match the fake data: "Betalt i år" equals the overview's
  key-number value for the same object group; "Resterende udgifter" is the sum of the estimate rows; "Estimat for hele
  2026" is their sum; "Pr. måned i snit" is a twelfth of it. "Denne måned", "Alt" and "Sidste 12 måneder" show §4's
  cards. No card reads "Dyreste" or "Billigste".
- §5: "I år" draws twelve bar buttons, also in January; "Denne måned" draws its days; the bar buttons' names tell paid
  from estimate; November's name has both; December's has only an estimate; "Sidste 12 måneder" has no estimate. The
  legend names the main groups at Alt forbrug, the categories in Bolig and the fixed expenses in Forsikring.
- §5.3: a weekly, a quarterly and a yearly subscription give their due dates in the right units; a subscription with
  an end date stops; a "Forfalden" one is an estimate; an "Ikke set" one adds a row and no amount. The new due-date
  function has unit tests in `shared`.
- §6: without a unit the groups run newest first with their sums; a bar press shows only its unit and the unit step;
  the rows' status texts read "Betalt …", "Estimat · forventes …" and "Ikke set · ventet …"; "Alt" shows one row per
  fixed expense in a year; the empty text shows for a level with no fixed expenses.
- §7: `view=fixed` and `og` round-trip; an unknown `og` reads as Alle; `detail` is dropped with `view=fixed`.
- The Chrome check ([`testing.md`](../../testing.md#chrome-check)) at 1440 and 1728 px: the way in from both
  object-group cards, the object-group list, "I år", "Denne måned", "Sidste 12 måneder" and "Alt", the hatched
  estimates and the "i dag" line, a chosen unit, the three levels' colours, the way out by ← and Back.

## 10. Docs

Changed in the same PR:

- `addon/DOCS.md`: the view, its way in and out, the estimates.
- `docs/domain-language.md`: the fixed-expenses view, an estimate (`estimate` in code), the drawn span; the line on the
  hash keys gets D66.
- `docs/architecture.md`: the overview's screens, if it lists them.
- `docs/testing.md`: the Chrome check gets §9's steps.
- `docs/mockups/README.md`: a row for `v7/`.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D66 below, and the statuses it changes.

## 11. Decisions

- **D66: A view of the fixed expenses over time.** "Vis faste udgifter →" opens a view with bars per unit and the
  payments under them. Paid is solid; the due dates after today are hatched estimates of `amountPerPayment`, up to
  31 December for "I år". The bars stack by the tree's next level in the overview's colours. A trail step chooses the
  object group or all of them. The view is `view=fixed` with `og` in the hash.

| Decision | Status after this change |
| --- | --- |
| D20 | active; key list superseded by D35, D42, D44, D60, D61 and D66 |
| D62 | active; "opens the Faste udgifter tab" and "the object-group filter (`og`) goes" superseded by D66 |
