# One top filter, one quick filter, one full-screen list – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issue:** closes #153. One branch, one PR.

**Approved:** by Claude after `reviewer` rated it Ready, under Thomas's ruling of 2026-11-04: "you take it to it is
released".

Thomas and Claude found the problem in the 0.14.0 walkthrough on 2026-11-04 and brainstormed it the same day with
mockups. The rulings are Thomas's unless marked "Claude's call". Everything else in the
[UI spec](2026-10-30-ui-ux-design.md) and the later specs holds.

## 1. Two parts, two jobs

The page said which data it shows in several places, and they could disagree: a chosen month in the trail beside a
Periode field that said the whole year; a month chosen again in Alle posteringer's "+ Filter"; a main group that moved
from the trail into a chip on Alle posteringer; two full-screen lists with different filters.

- **The top filter decides which data the page uses.** It is the trail plus Konti: period, chosen unit, main group,
  category and accounts. It drives the key numbers, the circle, the bars and the right card's tabs. The Faste udgifter
  tab keeps its exception: it follows the main group, the category and the accounts, not the period or a chosen unit
  ([subscriptions spec](2026-11-01-subscriptions.md) §1.3, [one-filter spec](2026-11-04-one-filter.md) §1.1).
- **The quick filter finds postings.** It sits on the Posteringer tab only: the search (text or a shop) and the amount.
  It narrows that list and never changes the key numbers, the circle or the bars, as the search does today
  ([postings search spec](2026-10-31-postings-search.md) §3).
- **Fixed payments and subscriptions are not filters.** They are seen under the Faste udgifter tab. Posting rows keep
  their badges.

## 2. The top card

### 2.1 What it holds

- The **Periode** and **Gruppér pr.** dropdowns go. The top card holds the trail on the left and **Konti** on the
  right, as today.
- The page opens on **I år**, as today.
- The trail's steps, in this fixed order: "Alt forbrug", the period, the chosen unit, the main group, the category, and
  last a dashed step that offers the next level. Examples:
  - `Alt forbrug › I år ▾ › [Hovedgruppe]`
  - `Alt forbrug › I år ▾ › Januar 2026 × › Bolig ▾ × › [Kategori]`
  - `Alt forbrug › Sidste år ▾ › Bolig ▾ × › Husleje ▾ ×`
- The last step stays the `h1`, as today; the trail stays the navigation landmark "Sti" (D55). Its text reads the
  steps and separators in order.

### 2.2 The period step

- The period is always shown, as a button with ▾. Its text is the preset's name ("I år", "Sidste 3 måneder", "Alt"),
  or for "Vælg periode …" the dates as the closed Periode field writes them today ("1. jan – 15. mar 2026").
- Its accessible name says the dates too: "Periode: I år, 1. jan – 4. nov 2026". Claude's call: the dates were in the
  closed field and must stay findable.
- A press opens today's Periode panel under the step: the presets, the two-month calendar with Fra and Til, and Vis.
  It behaves as the Periode dropdown does today (`components/period-picker.ts`); only its anchor moves.
- The period has no ×. Claude's call: there is always a period.

### 2.3 The grouping follows the period

Gruppér pr. goes; the page picks the grouping from the period (Thomas: one year gives months, several years give
years).

- A period of **at most 12 months** is grouped by **Måned**. A longer one is grouped by **År**. Claude's call on how
  "several years" is counted: by the period's length, so "Sidste 12 måneder" and "Sidste 3 måneder" in January (which
  cross a new year) still give months, not two year bars. A period counts as at most 12 months when its last day is
  before the day 12 months after its first day.
- A one-month period still draws its days (D51, D54): it is grouped by Måned, has one unit, and the Søjler card draws
  the days.
- So "I år", "Sidste år", "Sidste 12 måneder" and "Alt" with less than a year of data draw months; "Alt" over
  several years draws years.
- Everything that names the grouping follows it as today: the bars, the average key number ("Gennemsnit pr. måned" or
  "pr. år"), the Posteringer group lines and the unit's name.
- Uge, Kvartal and Dag are no longer chosen. `Grouping` keeps its values: the finer bars still use days (D54).

### 2.4 The unit step

- A click on a bar chooses its unit, and the trail shows it after the period: `I år ▾ › Januar 2026 ×`. A second click
  on the chosen bar, or the ×, removes it (D55).
- The unit step is plain text with its ×, as today (one-filter spec §1.2).
- **In a one-unit period the bars are not buttons.** Today a day bar in a one-month period chooses its month (D51),
  which would only repeat the period in the trail (`Denne måned ▾ › November 2026 ×`). The day bars keep their tooltip
  and lose their hidden buttons (D19) and their click. Claude's call. A one-unit period never has a chosen unit; an old
  link that names one is read without it.

### 2.5 The main group and category steps

- A chosen main group or category is a button with ▾ and its × (`Bolig ▾ ×`). The × works as today (one-filter spec
  §1.2): on the main group it removes the main group and its category.
- A press opens a list of the main groups (or the main group's categories) to switch sideways. Each row has the colour
  dot, the name and the sum in what the trail shows (the chosen unit, else the period), in the circle's order. The
  chosen one is marked. Claude's call: the order and the colours of the circle.
- **The dashed step** comes last: "Hovedgruppe" when no main group is chosen, "Kategori" when a main group is, and none
  when a category is. A press opens the same list. Its accessible name is "Vælg hovedgruppe" / "Vælg kategori".
  - It is needed: in full screen there is no circle, so it is the only way to choose a main group or category there.
  - "Uden hovedgruppe" and "Uden kategori" are in the lists when they have postings, as they are pieces of the circle.
- While the answer loads, and on an error, the dashed step and the lists are disabled; the steps from the state show.
  Claude's call, as the unit step does (one-filter spec §1.1).
- The overview's "Alt forbrug" link removes the unit, the main group and the category and keeps the period, the
  accounts and the quick filter (D55).

## 3. One full-screen list

### 3.1 Alle posteringer goes

- The Alle posteringer page goes: its screen, its own trail, its "+ Filter" menu (units, Beløb, Faste betalinger, main
  groups, categories) and its chips.
- **"N posteringer →" under "Forbrug i perioden"** (and "<unit> i alt") opens the right card's **Posteringer tab in
  full screen**. It clears the quick filter (§4) and an open detail, so the list's count matches the link. Claude's
  call, as D41 did for the search and the shop.
- The top filter does not change: the period, unit, main group and category stay in the trail.
- In full screen the card keeps its tabs, so a press on Søjler shows the bars full width without losing anything. The
  Kategori column stays in full-screen Posteringer (one-filter spec §4).
- The Posteringer card's title stays as today ("Posteringer", "Bolig: posteringer"). Claude's call.

### 3.2 Full screen is in the hash

Thomas, 2026-11-04: full screen goes into the address, so Back and a reload work.

- Full screen is the hash key `view=full`, in `view`'s place today. It holds for every tab.
- Opening it (the ⤢ button, or "N posteringer →") pushes a history entry, so Back leaves full screen and a reload keeps
  it.
- The ⤡ button and Escape close it by going back one entry when the current entry is the one the open pushed, and
  otherwise by replacing the entry. So Back does not reopen what was just closed. Claude's call, D44's rule.
- A view still cannot be shared or bookmarked: Home Assistant passes no hash into the frame (D10).

### 3.3 With a posting open

Today the open detail squeezes the full-screen list until dates and account names wrap onto two lines.

- In full screen, with a detail open, the detail keeps a fixed width (about 380 px; the builder picks it), and the
  list hides its **Konto** column: the detail shows the account. Claude's call.
- No cell in the postings table wraps, in either width; a long text ends in "…" and keeps its full text in a tooltip.
- The detail works as today ([detail view spec](2026-11-02-detail-view.md)). D44's `detail` now resolves on the
  Posteringer and Faste udgifter cards, in both widths.

### 3.4 Sort

- The postings tables keep sorting by their headers (D40). The sort stays held by the app, one for both widths
  (one-filter spec §4), and not in the hash. Claude's call: the hash's `sort` was Alle posteringer's; it goes with the
  page, and an old link's `sort` is ignored.

## 4. The quick filter

It shows on the Posteringer tab, in the normal card and in full screen, on one line over the list: the search field,
then the Beløb pill. Both are 36 px high (Thomas: "få størrelsen til at passe på boksene").

### 4.1 The search

- The search field works as today: typing filters the list by text, and its suggestions offer shops; a chosen shop is a
  chip inside the field ([shop search spec](2026-11-01-shop-search.md)).
- Each shop suggestion shows the shop's count and sum in what the trail shows: `Fjeldgrej · 7 · 5.400 kr.` Today it
  shows the sum only. Thomas liked the count as a way to tell shops apart.
- A click on a shop in the Butikker tab opens Posteringer with that shop, as today (`openShop`).

### 4.2 The Beløb pill

Thomas chose look A of the mockups: a pill like the shop chip, with a symbol and a dropdown.

- **Empty**, it reads "kr. Beløb" with a dashed grey border. A press opens the dropdown.
- **The dropdown** lists four kinds, each with a round symbol and a name:
  - `≈` Omkring, with the hint "±20 %";
  - `<` Under;
  - `>` Over;
  - `↔` Mellem, with the hint "to beløb".
  Choosing a kind closes the dropdown and puts the focus in the pill's number field.
- **Filled**, the pill has a light blue fill and border: the kind's symbol in a blue circle (a button that opens the
  dropdown again and keeps the number), the number, "kr." and a × that clears it. Mellem has two numbers with a dash
  between.
- The number fields take Danish numbers as today's Beløb fields do (D47): a dot groups thousands, a comma starts one or
  two decimals. Enter or leaving the field applies the filter. A number that does not parse shows
  `da.amountInvalid` under the pill and applies nothing, as today.
- **What each kind keeps** (bounds compared as today's Beløb range compares the posting's amount):
  - Under X: amounts below X, X not included. Thomas's task: "under 4.000" must leave out a 4.000 kr. transfer.
  - Over X: amounts above X, X not included.
  - Mellem X–Y: from X to Y, both included, as today's range.
  - Omkring X: ±20 % of X. When X is 250 kr. or more, each end is rounded to the nearest 50 kr.; below 250 kr., to
    whole kroner. Both ends included. 800 gives 640–960, kept as 650–950 kr.; 100 gives 80–120 kr. Claude's call.
- The pill's accessible name says the filter: "Beløb: omkring 800 kr." / "Beløb" when empty. The symbol button is
  "Vælg beløbstype", with `aria-haspopup`.

### 4.3 The sentence over the list

- Without a quick filter, the line over the list reads as today: `1.040 posteringer · 412.300 kr.`
- With one, it says what is filtered, with **Ryd** at its end: `Viser 3 af 1.040 posteringer · 2.469 kr. — Fjeldgrej ·
  omkring 800 kr. (650–950 kr.)`. The parts are the shop or the search text in quotes, then the amount in words:
  "under 4.000 kr.", "over 500 kr.", "800–1.200 kr.", "omkring 800 kr. (650–950 kr.)".
- **Ryd** clears the search, the shop and the amount, and puts the focus in the search field.

### 4.4 How long it lasts

- The search, the shop and the amount are shared choices (D31, D35): they stay when the top filter or the tab changes,
  and are in the hash on every screen.
- "N posteringer →" clears them (§3.1). The overview's "Alt forbrug" keeps them (D55).

## 5. Fixed payments

Thomas, 2026-11-04: the object-group key numbers' links open the Faste udgifter tab.

- The link under each object-group key number (Abonnementer, Faste udgifter, or whatever Firefly III's object groups
  are called, D38) reads **"Vis faste udgifter →"** and opens the right card's **Faste udgifter tab** in the normal card.
  It pushes a history entry and changes nothing else. Claude's call: the text, since it no longer opens postings; and
  the normal card, since the key numbers are not shown in full screen.
- The tab keeps grouping by main group (card full-screen spec §2), so the object group's rows sit among the others, told
  apart by their badge. A click on a fixed cost shows its postings in the detail, as today. Claude's call: the tab does
  not narrow to the object group.
- The object-group filter (`og`) goes. The card's value and count stay as D56 says; they no longer match one list.

## 6. The hash

D20's rules hold: default values are left out, a value that does not parse or that the answer does not know falls
back. The keys after this change, in this order:

| Key | Meaning |
| --- | --- |
| `period`, `from`, `to` | the period, as today |
| `accounts` | as today |
| `group`, `category` | as today |
| `unit` | the chosen unit's start, as today; dropped when the derived grouping has no such unit, and always in a one-unit period |
| `card` | as today |
| `view` | `full` for full screen; absent otherwise |
| `q`, `shop` | as today |
| `about` | Omkring, in kroner as D47 writes `min` and `max` |
| `under`, `over` | Under and Over, in kroner |
| `min`, `max` | Mellem, both written; read on every screen now |
| `detail` | as today (D44) |

- At most one amount kind is read: `about`, then `under`, then `over`, then `min`/`max`. A link with `min` alone reads
  as Over with that bound included, and `max` alone as Under with it included, so old links keep their meaning.
  Claude's call.
- **Old links:** `by` is ignored. `view=all-postings` reads as `view=full` with `card=postings`. `sort` and `og` are
  ignored. A `unit` from another grouping (a week, say) is unknown and dropped.

## 7. What goes

- `components/period-picker.ts` keeps its panel; the dropdown field that holds it goes. The Gruppér pr. dropdown goes.
- `screens/all-postings.ts`, the `allPostings` screen, its trail, "+ Filter", its chips and whatever only they use
  (`da.addFilter`, `da.filterSearch`, `da.noFilterHits`, `da.mainGroupChip`, `da.categoryChip`, `da.amountChip`,
  `da.unitsHeading`, `da.fixedPayments` and the like), if nothing else uses them.
- `objectGroup` in the view state and the `og` key.
- D21's rule goes with its subject (no "Hovedgruppe: …" chip and no "+ Filter" category).

## 8. Tests and checks

Made-up data only. Hard rule 5: behaviour through roles, accessible names and rendered text.

- §2.1: the top card has no "Periode" or "Gruppér pr." control; the trail reads "Alt forbrug › I år" on an empty hash,
  with the period step a button named "Periode: I år, …".
- §2.2: pressing the period step opens the panel; choosing "Sidste år" changes the trail and the bars; a custom period
  shows its dates in the step.
- §2.3: "I år", "Sidste 12 måneder" and "Sidste 3 måneder" in January give month bars; "Alt" over three years gives
  three year bars named by year; "Denne måned" gives day bars; the average key number names the grouping.
- §2.4: a bar's button chooses its unit and the trail shows it after the period; its × and a second press remove it.
  In a one-month period there are no bar buttons, and `#unit=<that month>` shows no unit step.
- §2.5: with a main group chosen, its step opens a list with the main groups and their sums; choosing another switches;
  the dashed step's names are "Vælg hovedgruppe" and "Vælg kategori"; in full screen the dashed step chooses a main
  group. "Alt forbrug" keeps the period and the quick filter.
- §3: "N posteringer →" shows the Posteringer tab in full screen with the trail unchanged and an empty quick filter;
  the hash has `view=full`; `history.back()` leaves full screen; ⤡ after the link leaves full screen and a following
  Back does not reopen it; there is no Alle posteringer screen. With a detail open in full screen, the table has no
  Konto column.
- §4: the search and the pill are on the Posteringer tab in both widths; a shop suggestion's name includes its count;
  each amount kind filters as §4.2 says (with Under and Over leaving out the bound itself); Omkring 800 keeps 650–950
  and Omkring 100 keeps 80–120; the sentence names the filters; Ryd clears them; the key numbers and the circle do not
  change with the quick filter.
- §5: an object-group card's link is named "Vis faste udgifter" and shows the Faste udgifter tab.
- §6: each row of the hash table round-trips through `parseHash` and `toHash`; old links with `by`, `view=all-postings`,
  `sort`, `og`, a week's `unit`, `min` alone and `max` alone read as §6 says.
- The Chrome check ([`testing.md`](../../testing.md#chrome-check)) at 1440 and 1728 px, normal and full screen: the
  trail with its dropdown steps and the dashed step, the period panel under its step, the pill empty, open and filled
  (all four kinds), both boxes the same height, the sentence and Ryd, the full-screen list with a detail open (no
  wrapped cells), Back and ⤡ out of full screen.

## 9. Docs

Changed in the same PR:

- `addon/DOCS.md`: the top card (no Periode or Gruppér pr.; the period in the trail; the grouping follows the period),
  no Alle posteringer, the quick filter, the object-group links.
- `docs/domain-language.md`: Gruppér pr., Alle posteringer, "+ Filter" and the screen `allPostings`, where named; the
  quick filter and the Beløb kinds.
- `docs/architecture.md`, if it names the screens or the hash keys.
- `docs/testing.md`: the Chrome-check steps on Periode, Gruppér pr., Alle posteringer and "+ Filter" change to this
  spec's checks.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D59 to D62 below, and the status of each decision they change.

## 10. Decisions

- **D59: The trail holds the period, and the grouping follows it.** §2. No Periode or Gruppér pr. field; the period is
  the trail's first chosen step and opens the Periode panel; at most 12 months group by Måned, longer by År; a one-unit
  period's bars are not buttons; the main group and category steps open lists, and a dashed step offers the next
  level. It supersedes UI spec §3.1's Periode and Gruppér pr. dropdowns, D51's and D54's "a click on a finer bar
  chooses the period's unit", D54's one-unit Uge, Kvartal and År periods, and D55's "the steps are plain text".
- **D60: One full-screen list, in the hash.** §3. Alle posteringer goes; "N posteringer →" opens full-screen
  Posteringer; full screen is `view=full` and closes by D44's rule. It supersedes D37, D40's `sort` in the hash and its
  why, D44's "on Alle posteringer", D55's and D57's Alle posteringer parts, D21, and UI spec §4.3.
- **D61: The quick filter is the search and the Beløb pill.** §4. Omkring, Under, Over and Mellem; the amount is a
  shared choice in the hash on every screen. It supersedes UI spec §5's "the search and the amount range belong to Alle
  posteringer only", and extends D47's format to `about`, `under` and `over`.
- **D62: The object-group links open the Faste udgifter tab.** §5. It supersedes D41's link to Alle posteringer, D42,
  and D56's "the card's link keeps the unit".

D10, D16, D19, D20, D21, D31, D35, D37, D40, D41, D42, D44, D47, D51, D53, D54, D55, D56 and D57 are checked against
these, and those that change get their status set as the decision log's format says: "superseded by D5x/D6x", or
"active; <part> superseded by D6x".
