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

The page has one screen after this change: the overview. "Alle posteringer" becomes the Posteringer tab in full screen
(§3).

## 2. The top card

### 2.1 What it holds

- The **Periode** and **Gruppér pr.** dropdowns go. The top card holds the trail on the left and **Konti** on the
  right, as today.
- The page opens on **I år**, as today.
- The trail's steps, in this fixed order: "Alt forbrug", the period, the chosen unit, the main group, the category.
  After the last step comes a dashed button that offers the next level (§2.5). Examples:
  - `Alt forbrug › I år ▾ [Hovedgruppe]`
  - `Alt forbrug › I år ▾ › Januar 2026 × › Bolig ▾ × [Kategori]`
  - `Alt forbrug › Sidste år ▾ › Bolig ▾ × › Husleje ▾ ×`
- The ▾ and the × are SVGs with no text node, as the × is today. So the "Sti" navigation's text reads the steps, the
  separators and the dashed button's text: "Alt forbrug › I år Hovedgruppe".
- **The heading:** the last step is the `h1` (`tabindex="-1"`), as today. When that step is a button (the period, a
  main group or a category), the `h1` wraps the button, and the heading's text is the button's text. Its accessible
  name is then the button's name (below), so tests check the heading's text, not its name. The dashed button is outside
  the `h1`. Claude's call.
- **"Alt forbrug"** is a link when a unit, a main group or a category is chosen, and plain text otherwise (D55). The
  link removes the unit, the main group and the category, and keeps the period, the accounts and the quick filter.
- The trail stays the navigation landmark "Sti".

### 2.2 The period step

- The period is always shown, as a button with ▾. Its text is the preset's name ("I år", "Sidste 3 måneder", "Alt"),
  or for "Vælg periode …" the dates as the closed Periode field writes them today ("1. jan – 15. mar 2026").
- Its accessible name says the dates too: "Periode: I år, 1. jan – 4. nov 2026". Claude's call: the dates were in the
  closed field and must stay findable.
- A press opens today's Periode panel under the step: the presets, the two-month calendar with Fra and Til, and Vis.
  It behaves as the Periode dropdown does today (`components/period-picker.ts`); only its anchor and its closed look
  change. Choosing a period pushes a history entry, as today.
- The period has no ×. Claude's call: there is always a period.
- The period step and Konti work while the answer loads and on an error, as the dropdowns do today, so a period or an
  account choice can recover from an error.

### 2.3 The grouping follows the period

Gruppér pr. goes; the page picks the grouping from the period (Thomas: one year gives months, several years give
years).

- A period of **at most 12 months** is grouped by **Måned**. A longer one is grouped by **År**. A period counts as at
  most 12 months when its last day is before the day 12 months after its first day. Claude's call on how "several
  years" is counted: by the period's length, so a period that crosses a new year inside 12 months still gives months,
  not two year bars. Examples: "Sidste 3 måneder" in March (December to February) and "Sidste 12 måneder" in November
  (November to October) give month bars.
- **A one-unit period** is a period with exactly one unit of its grouping (`units.length === 1`, as D54 and
  `finerUnits` mean it, not D16's "at most one whole unit"). It still draws finer bars (D51, D54): a one-month period
  draws its days, and "I år" in January (one month unit) draws January's days.
- So "I år" from February, "Sidste år", "Sidste 12 måneder" and "Alt" with less than 12 months of data draw months;
  "Alt" over more than 12 months draws years, named by year.
- Everything that names the grouping follows it as today: the bars, the average key number ("Gennemsnit pr. måned" or
  "pr. år"), the Posteringer group lines and the unit's name.
- Uge, Kvartal and Dag are no longer chosen. `Grouping` keeps its values: the finer bars still use days (D54).

### 2.4 The unit step

- A click on a bar chooses its unit, and the trail shows it after the period: `I år ▾ › Januar 2026 ×`. A second click
  on the chosen bar, or the ×, removes it (D55).
- The unit step is plain text with its ×, as today (one-filter spec §1.2). While the answer loads, and on an error, the
  trail leaves it out, as today.
- **In a one-unit period the bars are not buttons.** Today a finer bar chooses the period's one unit (D51, D54), which
  would only repeat the period in the trail (`Denne måned ▾ › November 2026 ×`). The finer bars keep their tooltip and
  lose their hidden buttons (D19) and their click. Claude's call. A one-unit period never has a chosen unit; a `unit` in
  the hash is dropped there (§6).
- Changing the period drops the unit, as today (`setPeriod`).

### 2.5 The main group and category steps

- A chosen main group or category is a button with ▾ and its × (`Bolig ▾ ×`). Its accessible name is "Skift
  hovedgruppe: Bolig" or "Skift kategori: Husleje", with `aria-haspopup`. The × works as today: on the main group it
  removes the main group and its category (D21, D55).
- A press opens a list to switch sideways. **Its rows are the circle's pieces** at that level: the main groups with a
  piece at "Alt forbrug", or the chosen main group's categories with a piece. That includes "Uden hovedgruppe" and
  "Uden kategori" when they have a piece, and leaves out what the circle leaves out (D16's parts of 0 or less,
  excluded main groups). Each row has the piece's colour dot, its name and its sum in what the trail shows (the chosen
  unit, else the period), in the circle's order. The chosen one is marked with `aria-current` and is always listed,
  with its sum, even when it has no piece. Claude's call.
- Choosing another main group drops the category, as a trail link does (D21). Choosing another category keeps the main
  group. Each choice pushes a history entry, as a circle click does.
- **The dashed button** comes after the last step: "Hovedgruppe" when no main group is chosen, "Kategori" when a main
  group is, and none when a category is. A press opens the same list as the step above it would. Its accessible name is
  "Vælg hovedgruppe" / "Vælg kategori".
  - It is needed: in full screen there is no circle, so it is the only way to choose a main group or category there.
  - It is disabled while the answer loads, on an error, and when the list would be empty (no pieces). The main group
    and category steps then show their names from the state, as the trail does today, and their ▾ button is disabled
    too. Claude's call, as the unit step (one-filter spec §1.1).

## 3. One full-screen list

### 3.1 Alle posteringer goes

- The Alle posteringer screen goes: its own trail, its "+ Filter" menu (units, Beløb, Faste betalinger, main groups,
  categories) and its chips. This is a change from the issue only in wording: the issue called it "Alle posteringer as
  its own page goes".
- **"N posteringer →" under the first key number** ("Forbrug i perioden", or "<unit> i alt") opens the right card's
  **Posteringer tab in full screen**. It clears the quick filter (§4) and an open detail, so the list's count matches
  the link. Claude's call, as D41 did for the search and the shop. The app handles the link's click (today it is a
  plain `href`), so it can push its entry with the marker of §3.2.
- The top filter does not change: the period, unit, main group and category stay in the trail.
- In full screen the card keeps its tabs, so a press on Søjler shows the bars full width without losing anything. The
  Kategori column stays in full-screen Posteringer (one-filter spec §4).
- The Posteringer card's title stays as today ("Posteringer", "Bolig: posteringer"). Claude's call, a change from the
  issue and the mockup, which wrote "Posteringer i Bolig": the title already says it, and the trail holds the level.

### 3.2 Full screen is in the hash

Thomas, 2026-11-04: full screen goes into the address, so Back and a reload work.

- Full screen is the hash key `view=full`, in `view`'s place today. It holds for every tab.
- Opening it (the ⤢ button, or "N posteringer →") pushes a history entry and marks it as the full-screen open, so Back
  leaves full screen and a reload keeps it.
- ⤢ keeps an open detail, as today. "N posteringer →" closes it (§3.1).
- **Closing** (the ⤡ button, or Escape): the page goes back to the entry before the full-screen open when that open
  was pushed in this page load and the only entries pushed since are one detail open (so it goes back one or two
  entries). Otherwise it replaces the current entry with full screen off and the detail closed. Claude's call, built on
  D44's rule.
  - In the go-back case Back does not reopen what was just closed. In the replace case it can: after ⤢ and a press on
    Søjler, ⤡ replaces the Søjler entry, and Back lands on the ⤢ entry in full screen. Accepted, as D44 accepts the same
    for the detail.
  - **Escape's order is as today:** a dropdown or suggestion list that is open takes Escape first; then an open detail
    closes, alone; then full screen closes. So with a detail open, the first Escape closes only the detail, and the
    second leaves full screen.
- A view still cannot be shared or bookmarked: Home Assistant passes no hash into the frame (D10).

### 3.3 With a posting open

Today the open detail squeezes the full-screen list until dates and account names wrap onto two lines.

- In full screen, with a detail open, the detail keeps a fixed width (about 380 px; the builder picks it), and the
  list hides its **Konto** column: the detail shows the account. Claude's call.
- No cell in the postings table wraps, in either width; a long text ends in "…" and keeps its full text in a tooltip.
- The detail works as today ([detail view spec](2026-11-02-detail-view.md)). D44's `detail` resolves on the Posteringer
  and Faste udgifter cards, in both widths.

### 3.4 Sort

- The postings tables keep sorting by their headers (D40). The sort stays held by the app, one for both widths
  (one-filter spec §4), and not in the hash. Claude's call: the hash's `sort` was Alle posteringer's; it goes with that
  screen, and an old link's `sort` is ignored.

## 4. The quick filter

It shows on the Posteringer tab, in the normal card and in full screen, on one line over the list: the search field,
then the Beløb pill. Both are 36 px high (Thomas: "få størrelsen til at passe på boksene").

### 4.1 The search

- The search field works as today: typing filters the list by text, and its suggestions offer shops; a chosen shop is a
  chip inside the field ([shop search spec](2026-11-01-shop-search.md)).
- Each shop suggestion shows the shop's count and sum in what the trail shows: `Fjeldgrej · 7 · 5.400 kr.` Today it
  shows the sum only. Thomas liked the count as a way to tell shops apart.
- The mockup's last suggestion line, "Søg efter "…" i al tekst", is not added: typing already filters by text. Claude's
  call, a change from the issue.
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
  dropdown again), the number, "kr." and a × that clears it. Mellem has two numbers with a dash between.
- **Entering numbers:** the fields take Danish numbers as today's Beløb fields do (D47): a dot groups thousands, a
  comma starts one or two decimals. The pill applies its filter on Enter, or when the focus leaves the pill (not when
  it moves between Mellem's two fields).
  - A number that does not parse shows `da.amountInvalid` under the pill and applies nothing, as today.
  - A kind chosen and left with no number clears the pill back to empty.
  - Mellem applies only with both numbers. With X greater than Y, the bounds swap, as today.
  - Switching kinds keeps the number: to Mellem it becomes the first bound; from Mellem the first bound is kept.
  - Applying, switching an applied kind and the × each push a history entry, as a click does (D20). Claude's call.
- **What each kind keeps** (compared as today's Beløb range compares the posting's amount):
  - Under X: amounts below X, X not included. Thomas's task: "under 4.000" must leave out a 4.000 kr. transfer.
  - Over X: amounts above X, X not included.
  - Mellem X–Y: from X to Y, both included, as today's range.
  - Omkring X: ±20 % of X. When X is 250 kr. or more, each end is rounded to the nearest 50 kr.; below 250 kr., to
    whole kroner. Both ends included. 800 gives 640–960, kept as 650–950 kr.; 100 gives 80–120 kr. Claude's call.
- The pill's accessible name says the filter: "Beløb: omkring 800 kr.", or "Beløb" when empty. The symbol button is
  "Vælg beløbstype", with `aria-haspopup`; the × is "Fjern beløb".

### 4.3 The sentence over the list

- Without a quick filter, the line over the list reads as today: `1.040 posteringer · 412.300 kr.`
- With one, it says what is filtered, with **Ryd** at its end: `Viser 3 af 1.040 posteringer · 2.469 kr. — Fjeldgrej ·
  omkring 800 kr. (650–950 kr.)`. The parts, in order: the shop, then the search text in quotes, then the amount in
  words ("under 4.000 kr.", "over 500 kr.", "800–1.200 kr.", "omkring 800 kr. (650–950 kr.)"), each only when set.
- With no hits it reads `Viser 0 af 1.040 posteringer — …` with Ryd, and the list shows `da.noMatch` ("Ingen
  posteringer passer til filtrene"), as today.
- **Ryd** clears the search, the shop and the amount in one history entry, and puts the focus in the search field.

### 4.4 How long it lasts

- The search, the shop and the amount are shared choices (D31, D35): they stay when the top filter or the tab changes,
  and are always in the hash when set.
- "N posteringer →" clears them (§3.1). "Alt forbrug" keeps them (§2.1).

## 5. Fixed payments

Thomas, 2026-11-04: the object-group key numbers' links open the Faste udgifter tab.

- The link under each object-group key number (Abonnementer, Faste udgifter, or whatever Firefly III's object groups
  are called, D38) reads **"Vis faste udgifter →"** and opens the right card's **Faste udgifter tab** in the normal
  card. It pushes a history entry. As any card change today, it closes an open detail. Claude's call: the text, since it no
  longer opens postings; and the normal card, since the key numbers are not shown in full screen.
- The tab keeps grouping by main group (card full-screen spec §2), so the object group's rows sit among the others, told
  apart by their badge. A click on a fixed cost shows its postings in the detail, as today. Claude's call: the tab does
  not narrow to the object group.
- The object-group filter (`og`) goes. The card's value and count stay as D56 says; they no longer match one list.

## 6. The hash

D20's rules hold: default values are left out, and a value that does not parse or that the answer does not know falls
back. The keys after this change, in this order:

| Key | Meaning |
| --- | --- |
| `period`, `from`, `to` | the period, as today |
| `accounts` | as today |
| `group`, `category` | as today |
| `unit` | the chosen unit's start, as today |
| `card` | as today |
| `view` | `full` for full screen; absent otherwise |
| `q`, `shop` | as today |
| `about` | Omkring, in kroner as D47 writes `min` and `max` |
| `under`, `over` | Under and Over, in kroner |
| `min`, `max` | Mellem, both written |
| `detail` | as today (D44) |

- At most one amount kind is read: `about`, then `under`, then `over`, then `min` and `max`. Claude's call.
- **`unit`** is kept when the derived grouping has a unit starting on that date, and dropped otherwise. A quarter's
  start, and a week that starts on a month's first day, are a month's start and are kept as that month. A week that
  starts mid-month is dropped. In a one-unit period `unit` is always dropped (§2.4).
- **Old links:** `by` is ignored. `view=all-postings` reads as `view=full` with `card=postings`. `sort` and `og` are
  ignored. `min` alone reads as Over and `max` alone as Under, both exclusive, so the pill can show them and `toHash`
  writes them back as `over` and `under`. Claude's call: links cannot be shared (D10), so only Back meets old hashes.

## 7. What goes

- The Periode dropdown's closed field (the panel stays, §2.2), and the Gruppér pr. dropdown.
- The Alle posteringer screen (`screens/all-postings.ts`, the `allPostings` screen value), its trail, "+ Filter", its
  chips and whatever only they use (`da.addFilter`, `da.filterSearch`, `da.noFilterHits`, `da.mainGroupChip`,
  `da.categoryChip`, `da.amountChip`, `da.unitsHeading`, `da.fixedPayments` and the like), if nothing else uses them.
- `objectGroup` in the view state and the `og` key; `sort` in the hash.

## 8. Tests and checks

Made-up data only. Hard rule 5: behaviour through roles, accessible names and rendered text.

- §2.1: the top card has no "Periode" or "Gruppér pr." control; on an empty hash the "Sti" text reads "Alt forbrug ›
  I år Hovedgruppe", "Alt forbrug" is not a link, and the heading's text is "I år". With a main group chosen, "Alt
  forbrug" is a link that removes it and keeps the period and the quick filter.
- §2.2: the period step's name is "Periode: I år, …"; pressing it opens the panel; choosing "Sidste år" changes the
  trail and the bars; a custom period shows its dates in the step. On an error the period step and Konti still work.
- §2.3: "I år" from February, "Sidste 3 måneder" in March and "Sidste 12 måneder" in November give month bars; "Alt"
  over three years gives three year bars named by year; "Denne måned" and "I år" in January give day bars; the average
  key number names the grouping.
- §2.4: a bar's button chooses its unit, and the trail shows it after the period; its × and a second press remove it.
  In a one-unit period there are no bar buttons, and a `unit` in the hash shows no unit step.
- §2.5: with a main group chosen, its step ("Skift hovedgruppe: …") opens a list of the circle's main groups with
  their sums and the chosen one current; choosing another switches and drops the category; a category step switches
  sideways and keeps the main group. The dashed button's names are "Vælg hovedgruppe" and "Vælg kategori"; in full screen it chooses a main group;
  it is disabled while loading and on an error.
- §3: "N posteringer →" shows the Posteringer tab in full screen with the trail unchanged, an empty quick filter and an
  open detail closed; the hash has `view=full`; `history.back()` leaves full screen. ⤡ and Escape after the link leave
  full screen, and a following Back does not reopen it, also after a detail was opened in full screen. With a detail
  open in full screen, the first Escape closes only the detail and the second leaves full screen. There is no
  Alle posteringer screen. With a detail open in full screen, the table has no Konto column.
- §4: the search and the pill are on the Posteringer tab in both widths; a shop suggestion's name includes its count.
  The pill: empty name "Beløb"; the symbol button "Vælg beløbstype" opens the four kinds and keeps the number; each kind
  filters as §4.2 says (Under and Over leave out the bound itself; Omkring 800 keeps 650–950, Omkring 100 keeps
  80–120; Mellem swaps reversed bounds and needs both); an invalid number shows `da.amountInvalid`; a kind left empty
  clears the pill; "Fjern beløb" clears it. The sentence names the filters and reads "Viser 0 af …" with no hits; Ryd
  clears them and focuses the search. The quick filter stays when the tab and the period change; the key numbers and
  the circle do not change with it.
- §5: an object-group card's link is named "Vis faste udgifter" and shows the Faste udgifter tab; Back returns to the
  card before.
- §6: each row of the hash table round-trips through `parseHash` and `toHash`. Old links with `by`,
  `view=all-postings`, `sort`, `og`, `min` alone and `max` alone read as §6 says. A quarter's `unit` is kept as its
  first month, and a week's `unit` that starts mid-month is dropped.
- The Chrome check ([`testing.md`](../../testing.md#chrome-check)) at 1440 and 1728 px, normal and full screen: the
  trail with its dropdown steps and the dashed button, the period panel under its step, the pill empty, open and filled
  (all four kinds), both boxes the same height, the sentence and Ryd, the full-screen list with a detail open (no
  wrapped cells), Back and ⤡ out of full screen.

## 9. Docs

Changed in the same PR:

- `addon/DOCS.md`: the top card (no Periode or Gruppér pr.; the period in the trail; the grouping follows the period),
  no Alle posteringer, the quick filter, the object-group links.
- `docs/domain-language.md`: its Alle posteringer, "+ Filter" and Gruppér pr. mentions; the quick filter and the Beløb
  kinds; the line that lists where the hash keys are decided gets D60 and D61.
- `docs/architecture.md`: its sentence on where the detail opens (no Alle posteringer).
- `docs/testing.md`: the Chrome-check steps on Periode, Gruppér pr., Alle posteringer and "+ Filter" change to this
  spec's checks.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D59 to D62 below, and the status of each decision they change.

## 10. Decisions

- **D59: The trail holds the period, and the grouping follows it.** §2. No Periode or Gruppér pr. field. The period is
  the trail's first chosen step and opens the Periode panel. At most 12 months group by Måned, longer by År. A
  one-unit period's finer bars are not buttons. The main group and category steps open lists of the circle's pieces,
  and a dashed button offers the next level.
- **D60: One full-screen list, in the hash.** §3. Alle posteringer goes; "N posteringer →" opens full-screen
  Posteringer and clears the quick filter and the detail; full screen is `view=full` and closes as §3.2 says; the
  sort is not in the hash.
- **D61: The quick filter is the search and the Beløb pill.** §4. Omkring, Under, Over and Mellem; the amount is a
  shared choice, in the hash as `about`, `under`, `over`, or `min` and `max`, in D47's number format.
- **D62: The object-group links open the Faste udgifter tab.** §5. The object-group filter goes.

The statuses they set, in the decision log's format:

| Decision | Status after this change |
| --- | --- |
| D19 | active; the chunk-size limit superseded by D39, the Forskel table by D57, "one button per bar" for a one-unit period's finer bars by D59 |
| D20 | active; key list superseded by D35, D42, D44, D60 and D61 |
| D21 | active; its Alle posteringer chip and "+ Filter" parts superseded by D60 |
| D31 | active; the way into Alle posteringer superseded by D57, leaving it through the trail by D60 |
| D35 | active; the way into Alle posteringer superseded by D57, "before `sort`" by D60 |
| D37 | superseded by D60 |
| D40 | active; Alle posteringer's `sort` in the hash and the why that rests on D37 superseded by D60 |
| D41 | active; the period's payments with the sum per month superseded by D56, the first key number's link to Alle posteringer by D60 |
| D42 | superseded by D62 |
| D44 | active; "on Alle posteringer" superseded by D60 |
| D51 | its status today, with ", the click on a day bar by D59" added at the end |
| D54 | active; "a click on a finer bar chooses the period's unit" and its one-unit Uge, Kvartal and År periods superseded by D59 |
| D55 | active; the step order (the period first), "plain text" for the main group and category steps, and its Alle posteringer part superseded by D59 and D60 |
| D56 | active; "the card's link keeps the unit" superseded by D62 |
| D57 | active; its Alle posteringer reach superseded by D60 |

UI spec §3.1's Periode and Gruppér pr. dropdowns (D59), §4.3 Alle posteringer (D60) and §5's "the search and the
amount range belong to Alle posteringer only" (D61) are superseded. D47 stays active: D61 uses its number format for
the new keys.
