# The spending overview: UI and UX – design

- **Date:** 2026-10-30 · **Status:** draft, for Thomas to approve
- **Why:** an overview of the household's spending with drill-down, the way a netbank's spending overview has it: click
  a group to see what it is made of, for any period. Thomas wants it on the computer, in Home Assistant's side menu,
  with nothing to build himself ([#1](https://github.com/thomas3650/Ha-Spending/issues/1)).
- **Scope:** what the page shows and how it behaves. How it is built (the server, the API, the data from Firefly III,
  the add-on, CI) is the technical spec, written after this one.
- **Source of the screens:** the chosen mockups in [`docs/mockups/`](../../mockups/README.md) ("Refined, in light
  mode"). Every decision below is Thomas's, made screen by screen on 2026-10-30, unless marked **Claude's call**.

## 1. Intent

Thomas opens the page to see where the money went, and follows a question down: from all spending to a main group, to
a category, to the single postings, or from a month that stood out to what made it stand out. The page answers
"what did we spend on X in this period" and "why was this month different" in a few clicks, without a spreadsheet.

- **Goals:** every posting is reachable; any period, grouped by day, week, month, quarter or year; new categories and
  main groups appear by themselves; the numbers on every level add up to the level above.
- **Non-goals (v1):** budgets; changing postings, categories or rules (that stays in Firefly III); a phone layout;
  per-receiver grouping (tried on screen 3, not chosen); income and savings (open, §8).
- **Anti-goals:** a number that does not add up to its parent; a category that silently drops out because no rule
  places it; anything to configure before it is useful.

## 2. The words

- **Main group** (*hovedgruppe*): Mad, Bolig, Bil … In Firefly III a main group is a tag that the rules give each
  category ([#1](https://github.com/thomas3650/Ha-Spending/issues/1)). **Category** (*kategori*): Dagligvarer, Café og
  restaurant … A category belongs to one main group.
- **Posting** (*postering*): one transaction line from the bank.
- **Spending** (*forbrug*): withdrawals from the chosen accounts, **less refunds**: a deposit with a spending category
  (money back for a return) is subtracted from that category and shows among its postings as a plus line, so the sums
  are net and always add up to the postings (Thomas, 2026-10-30). A category whose refunds exceed its withdrawals in a
  period shows a negative sum and no piece in the circle. Transfers between the household's own accounts are never
  spending, whichever accounts are chosen. Deposits without a spending category (salary, other income) are not on the
  page in v1 (§9).
- **Uden hovedgruppe:** the main group shown for a category that no rule places under a main group, so nothing goes
  missing. **Uden kategori:** the category shown for a posting without a category.
- **Period** (*periode*), **grouping** (*gruppering*, "Gruppér pr."): see §3.

## 3. Every screen

### 3.1 The frame

- The page sits in Home Assistant's side menu ("Forbrug") and fills the panel. Light colours (Thomas asked for light
  mode).
- **The top card** on every screen: the **trail** on the left, the three **dropdowns** on the right.
  - The trail: "Alt forbrug › Mad › Café og restaurant …"; every part but the last is a link back to that level.
  - **Periode:** Denne måned, Sidste måned, Sidste 3 måneder, Sidste 12 måneder, I år, Sidste år, then "Vælg periode …"
    with a from and a to date and a Vis button. The closed field shows the choice and its dates ("I år · 1. jan – 30.
    okt 2026"). [Mockup](../../mockups/v2/1-alt-forbrug-period.png).
  - **Gruppér pr.:** Dag, Uge, Måned, Kvartal, År. **Claude's call:** Kvartal and År were added to Thomas's Dag, Uge,
    Måned, for long periods. Weeks are ISO weeks, Monday first ("uge 29"). [Mockup](../../mockups/v2/1-alt-forbrug-grain.png).
  - **Konti:** a dropdown with a tick per asset account in Firefly III and "Alle konti" on top; all are ticked by
    default; the closed field shows "Alle konti (2)" or the chosen names. New accounts appear by themselves.
    [Mockup](../../mockups/v2/1-alt-forbrug-konti.png).
- **The three key numbers** under the top card, for whatever is shown: the sum in the period, the average per grouping
  unit, and the last whole unit against the one before ("September mod august", up red ▲, down ▼). The second line of
  the first number says what share it is of the level above ("20 % af alt forbrug").
- **Units, averages and comparisons (Claude's call):**
  - A unit that lies partly outside the period is clipped to it: with "I år" by Uge, the first bar is 1.–4. jan, not
    ISO week 1 from 29 Dec. The unit still running today (October on 30 Oct) is a **partial unit**: shown, with a
    lighter bar and "i gang" under its label, and its dates in the tooltip.
  - **The average** counts whole units only; a partial unit is not in it.
  - **"Last against the one before"** compares the last whole unit with the unit before it, which may lie before the
    period (it is fetched for the comparison only, and not shown otherwise).
  - **One-unit periods** ("Denne måned" by Måned, or any period with a single whole unit): the average is that of the 12
    units before the period, labelled so ("gns. de 12 måneder før"), and the comparison is with the unit before.
  - **"Sidste 3 måneder" and "Sidste 12 måneder"** are whole calendar months before the current one; "Sidste år" is the
    previous calendar year.
  - The mockups' numbers were made before these rules (their average counts October); these rules win.
- **Claude's call:** the page opens on "I år", grouped by Måned, all accounts. The three dropdowns keep their choice as
  the user drills down and back up.
- **Claude's call:** the page's state (level, filters, period, grouping, accounts, toggle) is kept in the address, so
  the browser's back button steps back one click and a view can be bookmarked.

### 3.2 The circle

Used on every level that splits into parts (screens 1, 2 and 4).

- **A piece for every part**, largest first, with its name, amount and share beside it on a line out from the piece.
  The total sits in the middle with the level's name above it ("Alt forbrug", "Mad", "Juli 2026").
- **Colours:** the eight largest parts get the eight colours of the palette in
  [`v2/1-alt-forbrug.html`](../../mockups/v2/1-alt-forbrug.html) (checked for colour blindness on white); any further
  parts get greys, lighter the smaller they are. A part keeps its colour while the level is shown, also when a month is
  chosen (screen 4).
- **The ring is turned** so the small pieces sit where their names have room, and the names stand in a column in the
  ring's order, so no line crosses the ring.
- **A piece and its name are one button.** On hover the name gets a light blue background and an underline, its line
  turns blue and the piece moves a little out. [Mockup](../../mockups/v2/1-alt-forbrug.png) (hover on Sommerhus).
- Øvrige and "Mindre grupper" are gone (Thomas chose every group, 2026-10-30). Screens 2 and 4 were drawn before that
  and still show five pieces and Øvrige; this section wins.

### 3.3 The bars

- One bar per grouping unit in the period, one colour (or the chosen category's colour), a dashed line for the average
  with its amount, the axis in kr. ("62k"). **Claude's call:** a unit with no spending shows as an empty slot, not left
  out.
- A click on a bar chooses that unit (§4.4).

### 3.4 Numbers and text

- Danish number format: "472.447 kr." for sums, rounded to whole kroner; postings with sign and øre ("-1.722,86").
  Shares as whole per cents ("25 %").
- **Claude's call:** the texts are Danish, from one language file, so English can be added later.
- Dates as "26.10.2026" in tables; month names in full in group lines ("Oktober 2026").

## 4. The screens

### 4.1 Alt forbrug (screen 1, variant H)

[Mockup](../../mockups/v2/1-alt-forbrug.png)

- The top card with "Alt forbrug" alone in the trail; the key numbers for all spending.
- Left half: **Hovedgrupper**, the circle (§3.2) with every main group. A click on a piece or a name opens that main
  group (§4.2).
- Right half: **Pr. måned** (or the chosen grouping), the bars (§3.3).

### 4.2 A main group (screen 2, variant C refined)

[Mockup](../../mockups/v2/2-hovedgruppe.png)

- The trail "Alt forbrug › Mad"; the key numbers for the group, the first with its share of all spending.
- Left: **Kategorier**, the circle of the group's categories.
- Right: one card that **toggles between Søjler and Posteringer** (a switch at its top right), and **Forskel** as a
  third choice while a unit is chosen (§4.4). **Claude's call:** the same card, with the same switch, is on screen 1
  too, so every level reaches its postings the same way.
  - **Søjler:** the group per grouping unit, with the average.
  - **Posteringer:** the group's postings **grouped by the chosen grouping**, newest first. Each group line shows the
    unit, the count and the sum ("Oktober 2026 · 4 posteringer · -1.722,86"); the two newest are open, the rest folded;
    a click on a group line folds it in or out; "Vis ældre" shows more groups. A group's postings add up to its line,
    and its line is its bar. Columns: date, text, account, amount. A click on a posting opens it in Firefly III.
    [Mockup](../../mockups/v2/2-hovedgruppe-filter-posts.png).
- **A click on a category filters the page to it,** without leaving it:
  [bars](../../mockups/v2/2-hovedgruppe-filter-bars.png), [postings](../../mockups/v2/2-hovedgruppe-filter-posts.png).
  - The piece moves out and its name turns bold; the others fade but stay clickable, to switch the filter.
  - The trail gets the category ("Alt forbrug › Mad › Café og restaurant"); the key numbers are the category's, the
    first with its share of the group.
  - The right card's title gets a chip with the category and ✕. ✕, or a second click on the chosen piece, shows the
    whole group again.
  - The bars take the category's colour.
- "Vis alle" (in the Posteringer view) opens all postings (§4.3) with the same filters.

### 4.3 Alle posteringer (screen 3, variant A)

[Mockup](../../mockups/v2/3-posteringer.png)

- The trail ends in "Alle posteringer"; no key numbers, no circle.
- One wide card:
  - **A search** in the posting's text ("Søg i teksten, fx 'pizza'"), and **Sortér**: Nyeste først, Ældste først,
    Største først, Mindste først.
  - **The filters as chips** under it, carried over from the page before ("Hovedgruppe: Mad ✕", "Kategori: Café og
    restaurant ✕", and a chosen unit, "Juli 2026 ✕"); "+ Filter" adds a main group, a category or an amount range.
    Accounts are chosen only in the Konti dropdown (Claude's call: one place for them). On the right: the count
    and the sum of what the filters and the search let through ("46 posteringer · 17.837 kr.").
  - **The table**, grouped by the chosen grouping as in §4.2, with a category column (its colour dot and name).
    **Claude's call:** sorted by amount, the groups give way to one flat list, as an order by size across months
    means nothing within a month group.
- A click on a posting opens it in Firefly III.

### 4.4 A click on a bar (screen 4, variant C)

[Mockup](../../mockups/v2/4-soejle.png)

- The page **filters to that unit** (July here) and stays where it is: the bar keeps its colour, the others fade, and a
  chip "Juli 2026 ✕" stands at the right card's title. ✕, or a second click on the bar, shows the whole period again.
- The circle and the key numbers show that unit: its sum, **against the average unit** ("+19 %, ▲ 8.752 kr. mod
  47.245 kr. pr. måned"), and against the unit before ("Juli mod juni").
- The right card gets **Forskel** as a third choice beside Søjler and Posteringer, and opens on it. Forskel shows, per
  part of the level (main groups on screen 1, categories on screen 2), how much the unit differs from an average unit
  (the average of the other whole units, §3.1): a bar to the right in orange for more, to the left in blue for less,
  the amount beside it, largest difference first. Posteringer shows only the chosen unit's postings.
- **Claude's call:** a unit is chosen from a bar only; in Posteringer a group line folds in and out.
- **Claude's call:** the same works on every level and for every grouping (a week against an average week). A chosen
  unit and a chosen category can both be on; each has its chip, and both apply. With a category chosen, Forskel still
  lists all the level's parts, with the chosen one in bold.

## 5. One set of choices (Claude's call)

The period, grouping, accounts, chosen main group, chosen category and chosen unit are **one set of choices** shared by
every screen, kept in the address (§3.1).

- Drilling down keeps them: a click on Mad while July is chosen shows Mad in July.
- **The trail follows the choices:** removing "Hovedgruppe: Mad ✕" on Alle posteringer removes Mad from the trail; a
  link in the trail goes to that level and drops the choices below it (Mad › keeps the main group and drops the
  category); the search and the amount range belong to Alle posteringer only.

## 6. States

- **Loading:** each card shows a quiet placeholder of its own shape; the top card is usable at once.
- **No spending in the period** (or the filters let nothing through): the cards say so in one line ("Ingen forbrug i
  perioden") instead of an empty chart; the dropdowns stay.
- **Firefly III cannot be reached, or refuses the token:** one line across the page saying which, and that the numbers
  are not shown; no stale numbers are presented as current.
- **Uncategorised spending:** shows as "Uden hovedgruppe" or "Uden kategori" like any other part, so the sums add up.

## 7. Accessibility

- Every piece, name, bar, chip, toggle and posting can be reached and used with the keyboard, and has an accessible
  name that says what it is and its amount ("Mad, 95.831 kr., 20 %").
- No part is told by colour alone: the circle has its names, the Forskel view its signs and amounts.

## 8. The window

- On the computer, in the panel beside Home Assistant's side menu; laid out for 1280 px and wider.
- **Claude's call:** narrower, the two halves stack (circle above, the right card below); there is no phone layout.

## 9. Open

- **Money in and savings:** whether the page shows only spending, or also income and savings (Indskud, Opsparing,
  Overførsel til egen konto). Not decided; v1 shows spending only.
- **Dark mode:** the mockups are light, as Thomas asked. Whether the page follows Home Assistant's dark theme is not
  decided.

## 10. What is left to the builder

- The exact sizes, spacing, animations and placeholders, within the mockups' look.
- The hover and focus styles beyond §3.2.
- How many postings and groups load at a time behind "Vis ældre".
- The category dots' colours on Alle posteringer, where categories of several main groups meet.
