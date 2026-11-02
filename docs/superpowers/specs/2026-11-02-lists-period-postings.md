# Sortable lists, an easier period, one click to all postings – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option.

**Issue:** #62 (Thomas's feedback of 2026-11-01).

Thomas wanted to see all his data, several years back. Safari on his Mac would not let him type the year in the date
field, and a custom interval took too many steps. He also found that no list can be sorted, that Alle posteringer is
two clicks away in the right card, and that three help texts take up room. He wants the page to use standard parts
where they exist, rather than build them from scratch.

This spec changes, where it says so: the [UI spec](2026-10-30-ui-ux-design.md) §3.1, §4.2 and §4.3; the
[subscriptions spec](2026-11-01-subscriptions.md) §1.1 and §1.2 ("The order"); the
[card full-screen spec](2026-11-01-card-full-screen.md) §2 (the fixed costs "in today's order", and "the key number
… unchanged"); and the [object groups spec](2026-11-01-object-groups.md) §1.1 ("nothing goes per month", which held
for the card and the key number; the card keeps it). Everything else there holds.

**Thomas's rulings, 2026-11-02:**

- The period gets a preset **"Alt"**, from the earliest posting to today (§1.1).
- The two date fields give way to **one calendar from a library**, Vanilla Calendar Pro, where a start and an end day
  are picked on the same calendar and the dates can also be typed (§1.2). Mockup: one menu, the presets on the left,
  the calendar with two months on the right.
- **Every table sorts by its column headers.** A click sorts by the column; a second click reverses it (§2). Sorted by
  date, the postings keep their groups per unit; sorted by any other column, they are one flat list. The **Sortér**
  dropdown on Alle posteringer goes; it is the only sort dropdown on the page.
- **The way to Alle posteringer is the key number** (draft B of three in #62): "2.417 posteringer →" under the amount
  in the first key number, on every level (§3).
- **Key numbers for the period**, "Abonnementer i perioden" and "Faste udgifter i perioden", replace "Faste udgifter
  om året". Each shows the payments in the period, and under it the sum per month and the count (§4).
- **Three help texts go** (§5).

**Claude's calls, for Thomas to see before approving:**

- "Alt" before the first answer: the page loads "I år"'s range first, learns the earliest date from that answer, and
  loads once more (§1.1).
- Typed dates are day, month and year with dots (`3.1.2024` or `03.01.2024`); the month and the year are also chosen
  from two lists over the calendar, the years from five before the earliest posting's (§1.2).
- The first click on Beløb sorts the largest first; on a text column, A to Å (§2.1).
- The Faste udgifter card keeps its groups when sorted; the rows sort inside each group (§2.3). Its order of today is
  the Status column, ascending.
- The tables that sort are the postings (in the Posteringer card and on Alle posteringer) and Faste udgifter. The
  circle's list of names and Forskel keep their order (§2).
- The sort on Alle posteringer stays in the hash, and the old `sort` values still work. The cards' sort is not in the
  hash; it lasts until the page reloads (§2.4).
- The key number's link clears the search and the chosen shop, so the count it shows is what Alle posteringer lists.
  This is an exception to [D31](../../decisions.md) and [D35](../../decisions.md) (§3).
- "Vis alle" in the Posteringer card stays (§3).
- There is one key number per object group, not two fixed ones, since the object groups' names are Firefly III's
  ([D38](../../decisions.md)). With the house's two groups that is the two Thomas asked for (§4).
- The key numbers for the object groups follow the period, the level and the accounts, but not a chosen unit, as the
  Faste udgifter card they open does not (§4).
- "Pr. måned" is the sum over the period's length in days, at 365.25 / 12 days a month; for a period shorter than a
  month it is left out (§4).

## 1. The period

### 1.1 The preset "Alt"

**Changes the UI spec** §3.1 (the period's presets): "Alt" is added after "Sidste år".

- **The period:** from the earliest posting date to today. When the earliest date is null (no postings) or after
  today, it is "I år"'s period.
- **Where the date is kept:** `SpendingApp` keeps the `earliestPostingDate` of the latest answer. The server works it
  out for every answer, whatever the range ([D12](../../decisions.md)). Every use of the shown period (`periodOf` and
  its callers: the wanted range, `normalise`, the view context and the period's closed text) gets the kept date.
- **Before the first answer** the date is unknown. With `period=all` the page then asks for "I år"'s range. When that
  answer comes, the page keeps its date and, since the wanted range changed, asks once more with "Alt"'s range. That
  first answer is not shown and not normalised: the page stays loading until the second answer, so a `unit=` from an
  earlier year is not dropped. It asks once more at most, whatever the second answer holds. A later change of the
  period reuses the kept date and makes no extra request.
- **The closed field** reads "Alt · 3. jan 2023 – 2. nov 2026", as the other presets do. Before the first answer it
  reads "Alt" alone.
- **The hash:** `period=all`. Old hashes are unchanged ([D20](../../decisions.md)).
- How `Preset` and `presetPeriod` in `addon/shared` gain "Alt" is left to the builder.

### 1.2 The calendar

**Changes the UI spec** §3.1 (the custom interval) and **replaces the two `<input type="date">` fields.**

- **The menu:** the presets on the left, the calendar on the right, as in the mockup. Below 600 px of frame width the
  calendar goes under the presets. **The open menu stays inside the frame** at every width (§6's widths); it may
  open to the left of the field or span the frame. Today's `.dd-menu` is anchored to the field's left edge, so this
  needs a change.
- **The calendar:** [Vanilla Calendar Pro](https://vanilla-calendar.pro/) (MIT, no dependencies), pinned to an exact
  version in `addon/web/package.json` like the other dependencies. It is **mounted inline in the menu**, inside the
  app's shadow root: not as a popup, not on an input, and nothing attached to `document.body`. It shows two months
  side by side (one below 600 px), Danish month and day names, and weeks starting on Monday.
- **Month and year:** over the calendar, a list of months and a list of years. The years run from five years before
  the earliest posting's year (before this year, with no earliest date) to this year. Days after today cannot be
  picked.
- **Picking:** a click on a day sets the start; a click on a second day sets the end. A second day before the start
  swaps them. The same day clicked twice is a one-day period. While only the start is picked, the end is empty and
  **Vis** cannot be pressed. The days between are marked.
- **The menu stays open while picking.** A click on a day, a change of month or year, and the calendar redrawing its
  days do not close the menu. Today's `Dropdown` closes on a `focusout` to outside the menu
  (`addon/web/src/components/dropdown.ts`), and a redraw that removes the focused day must not count as that.
- **Typing:** two fields over the calendar, **Fra** and **Til**, show the picked dates as `dd.mm.yyyy` and take typed
  ones. A typed date parses when it is a day, a month and a four-digit year separated by dots, with one or two digits
  for the day and the month, and is a real date (`isDate`). A parsed date moves the calendar there. A date that does
  not parse, a date after today, or an end before the start leaves **Vis** unpressable. A typed date has no lower
  bound; it may be before the years in the list, and then the list gains that year, so it always shows the year the
  calendar is on.
- **Opening:** the calendar opens on the shown period, with its start and end picked and its last month on the right.
- **Vis** takes the picked period as a custom period (`hs-period` with `{ preset: "custom", start, end }`), as the
  button does today. Escape and a click outside close the menu without a change, as today.
- **Accessibility:** every day is reachable and pickable by keyboard, and the picked start and end are announced. The
  library's own keyboard support is used where it covers this. The fields have the labels Fra and Til.
- **Styles:** the library's styles go into the component's styles, not the document. The calendar uses the page's
  colours (`--hs-…`). The page has a light theme only (UI spec §3.1).

## 2. Sortable tables

**Changes the UI spec** §4.3 (Sortér) and §4.2 (the Posteringer card's order), the subscriptions spec §1.2 ("The
order") and the card full-screen spec §2 ("in today's order").

### 2.1 The headers

- Every column header of a postings table and of the Faste udgifter table is a button inside the `th`. The button's
  accessible name is the header's text as today: "Måned / dato" (`da.columns.unitAndDate`, by the grouping), "Butik /
  tekst", "Kategori", "Konto", "Beløb"; "Fast udgift", "Kategori", "Beløb", "Om året", "Status".
- The `th` of the column the table is sorted by has `aria-sort` (`ascending` or `descending`); the others have none.
- The sorted column shows its text in bold and an arrow, ▼ for descending and ▲ for ascending.
- A click on another column sorts by it in its first direction. A click on the sorted column reverses it.
- **What a column sorts by** is what its cell shows: the date; the shop, or the text when there is no shop; the
  category's name; the account's name; the amount in øre; the bill's name; the amount per payment in øre; the amount
  per year; the status (§2.3). Text compares with `localeCompare(…, "da")`.
- **The first direction:** the date, newest first; Beløb and Om året, largest first; Butik / tekst, Kategori, Konto
  and Fast udgift, A to Å; Status, as in §2.3.

### 2.2 The postings

The postings tables are the Posteringer card and Alle posteringer, with their columns as today.

- **Sorted by the date** (either way), the postings are grouped by the chosen grouping, with each group's title and
  sum, as today. Descending is today's order; ascending is today's "Ældste først".
- **Sorted by any other column**, the groups give way to one flat list, as "Største først" does today (UI spec §4.3,
  Claude's call there).
- **Ties** go by the date, newest first.
- A posting with no category ("Uden kategori") sorts last by Kategori in both directions.
- The search, the shop, the chips, and the count and sum above the table are unchanged.

### 2.3 Faste udgifter

- The groups by main group or category, their sums and their order stay as the card full-screen spec §2 and the
  object groups spec §1 say. The rows sort **inside each group**. With no groups (at a category) the sort applies to
  the one list.
- **Status** sorts by today's order: the status's kind, then the next date, then the name (`STATUS_ORDER` in
  `addon/web/src/model/subscriptions.ts`). Ascending is today's order and is the table's default.
- **Ties** on any other column go by today's order.
- "Uden kategori" sorts last by Kategori in both directions, as on the postings.

### 2.4 Where the sort is kept

- **Alle posteringer:** in the hash as `sort`, as today. The values `newest`, `oldest`, `largest` and `smallest` keep
  meaning what they do today, so an old link opens the same list. The other columns and directions get values of
  their own, left to the builder. A value that does not parse falls back to the default ([D20](../../decisions.md)).
  Opening Alle posteringer, by the key number or by "Vis alle", and leaving it reset the sort, as today.
- **The Posteringer card and the Faste udgifter card:** `SpendingApp` keeps their sort, as it keeps full screen
  ([D37](../../decisions.md)), since the cards' components are made anew when the right card switches. Each starts at
  its default (the date descending; Status ascending) when the page loads and keeps its sort until the page reloads.
  It is not in the hash.
- `Sort`, `da.sort` and `da.sorts` change or go with the dropdown.

## 3. One click to Alle posteringer

**Changes the UI spec** §3.1 (the first key number).

- **Where:** the first key number on the overview, on every level and with a chosen unit: "Forbrug i perioden", "Bil
  og transport i perioden", a category's, "Juli 2026 i alt" and "Mad i juli 2026" (`levelInUnit`).
- **What:** under the amount, a link "2.417 posteringer →" (one posting: "1 postering →"). The count is the number of
  postings Alle posteringer will list after the click: the shown postings at the level, the accounts and the period,
  or the chosen unit, with no search and no shop. Its accessible name is its text.
- **The click** opens Alle posteringer (UI spec §4.3) with the level, the accounts, the period and the chosen unit as
  they are, and with **the search and the chosen shop cleared**. This is an exception to D31 and D35, which keep them
  when Alle posteringer opens; "Vis alle" still keeps them. The sort is the default. With no postings the line reads
  "0 posteringer" and is not a link.
- **The line under it:** the range ("1. jan – 2. nov 2026") or the share ("16 % af alt forbrug") moves under the
  link. The look is left to the builder.
- **"Vis alle"** in the Posteringer card stays as it is.

## 4. The key numbers for the object groups

**Changes the subscriptions spec** §1.1 and **the object groups spec** §1.1 (the key number "Faste udgifter om
året"). The Faste udgifter card itself is unchanged: its amounts stay per payment and per year.

- **Which:** one key number for each object group that is either a kept bill's (`subscriptions`) or on the
  `subscription` of a shown posting in the period (the level and the accounts applied, as for the value). So a group
  whose bills have all ended gets one when the period holds its payments. The fetched range, which is wider than the
  period, does not count, so the set does not change with the grouping. They are ordered by name with
  `localeCompare(…, "da")`. With the house's data: "Abonnementer i perioden", then "Faste udgifter i perioden". The
  label is the object group's title and " i perioden".
- **The value:** the sum of the shown postings (the level, the accounts, the period) whose `subscription.objectGroup`
  is the group, in whole kroner. A refund linked to a bill counts against it, as everywhere. At a main group the
  number is that group's share, by the postings' own categories. A chosen unit does not change it.
- **The sub-line:** "{per month} pr. måned · {n} {word}".
  - **Per month:** the value divided by the period's length in days over 365.25 / 12, in whole kroner. When the
    period is shorter than 28 days the per-month part is left out and the line holds the count only.
  - **n** is the number of different bills, by name, with a linked posting in the sum, a refund included. Firefly III
    keeps a bill's name unique per user. The word after n must read naturally under any object group's title, since
    the titles are data; the page calls a bill "fast udgift" ([D36](../../decisions.md)), which reads oddly under
    "Abonnementer", so the word is left to the builder ("12 stk." or alike).
  - With no payment: the value "0 kr." and the line "ingen betalinger".
- **The search and the chosen shop do not change them,** as they change no key number.
- **They are toggle buttons** when the household has kept bills, as the key number is today: a click switches the right
  card to Faste udgifter, and a click while it shows Faste udgifter switches it to Søjler. While the card shows Faste
  udgifter every one of them has `aria-pressed="true"`. When `subscriptions` is empty they are plain key numbers, as
  there is no Faste udgifter card (subscriptions spec §1.4).
- **The layout:** from 1024 px of frame width at most five key numbers in a row (the house's data gives five), and
  the row wraps beyond that; two columns from 600 px; one below. The placeholder while loading keeps its three bones.
- **No object group at all** (none on a kept bill or a shown posting in the period): three key numbers, as today.
- **The texts:** `subscriptionsPerYear` in `da.ts` gives way to the new ones. `subscriptionCount` stays for the card's
  group rows.

## 5. The help texts that go

These three lines and their texts in `da.ts` are removed:

- "Klik på et stykke eller et navn for at gå til hovedgruppen." (`circleHintAll`, under the circle on Alt forbrug).
- "Grupperet pr. måned, som "Gruppér pr."." (`postingsHint`, under the Posteringer card).
- "klik på en søjle for kun den måned" (`barsHint`, under the bars).

The other lines under the cards stay: the circle's hints in a main group and for a chosen piece, and Forskel's.

## 6. Tests

By role, name and text, made-up data only (hard rule 5). Fra, Til and Vis are a plain input and a plain button, so
everything about typing is a gate test whatever the library allows in happy-dom.

- **"Alt":** it is a preset; choosing it shows the period from the earliest posting to today and puts `period=all` in
  the hash; with no postings, or an earliest date after today, it is "I år"'s period. A hash with `period=all` asks
  for "I år"'s range, then once for "Alt"'s, and shows only the second answer; `period=all` with a `unit=` from an
  earlier year keeps the unit; a later change of the period makes one request, not two; the closed field reads "Alt"
  before the first answer.
- **Typing:** `03.01.2024` and `3.1.2024` in Fra set the start; Vis then fires `hs-period` with the custom period; a
  date that does not parse (`31.02.2024`, `2024-01-03`), a date after today, or an end before the start leaves Vis
  disabled; a date before the year list is accepted.
- **The calendar,** where happy-dom can drive it (the plan finds out; the rest goes in the Chrome check): picking two
  days and pressing Vis gives that custom period; a second day before the first swaps them; the same day twice is a
  one-day period; a day after today cannot be picked; a pick and a change of month keep the menu open.
- **Sorting the postings:** each header is a button and its `th` carries `aria-sort`; a click on Beløb gives one flat
  list, largest first, with `aria-sort="descending"`; a second click gives the smallest first; a click on the date
  gives the groups back; a click on Butik / tekst sorts by the shop, or the text without one, A to Å; Uden kategori
  sorts last both ways; the Sortér dropdown is gone.
- **The hash:** Alle posteringer puts the sort in the hash and a new value round-trips; an old hash with
  `sort=largest` opens sorted by Beløb, largest first; an unknown `sort=` value gives the default.
- **The cards' sort:** Faste udgifter starts with `aria-sort="ascending"` on Status; a click on Om året sorts the rows
  inside each group, largest first, and the groups keep their order; a card's sort survives switching to Søjler and
  back; it is not in the hash.
- **The link:** the first key number has a link with the posting count; its click opens Alle posteringer with the
  level, the accounts, the period and the unit, and with no search or shop; at a main group and at a category the
  count is that level's; with a chosen unit it is the unit's; with no postings there is no link.
- **The object group key numbers:** one per object group, ordered by name; a group whose bills have all ended has one
  when the period holds its payments, and none when only the fetched range before the period does; the value is the
  period's linked payments and follows the period, the level and the accounts, not the chosen unit, the search or the
  shop; the per-month part is the value over the period's months by days, and is left out for a period under 28 days; n counts different bills, not payments; a
  refund counts against; with no payment, "0 kr." and "ingen betalinger"; a click toggles the Faste udgifter card;
  with no object group at all there are three key numbers.
- **The help texts:** the three texts are not on the page.

The Chrome check ([`testing.md`](../../testing.md)): the period menu with "Alt" and the calendar, picked by mouse, by
keyboard and by typing, in Safari as well as Chrome, since Safari is where the trouble was; the open menu inside the
frame at each width; Alle posteringer and the Posteringer card sorted by each column; the key numbers with the link at
Alt forbrug, a main group, a category and a chosen unit. At 1440, 1728, 1024, 900 and 420 px.

## 7. Docs in the same PR

- `docs/decisions.md`:
  - **D39**, the period's custom interval uses Vanilla Calendar Pro instead of the browser's date fields, because
    Safari's date field would not take a typed year and the fields differ between browsers. It adds a runtime
    dependency beside Lit and ECharts (technical spec §6).
  - **D40**, tables sort by their headers and there is no sort dropdown; Alle posteringer's sort is in the hash, the
    cards' sort is kept by the app and not in the hash.
  - **D41**, the key numbers for Firefly III's object groups show the period's payments, with a sum per month, and
    the first key number links to Alle posteringer with the search and the shop cleared (an exception to D31 and
    D35). D33's status becomes `active; the key number superseded by D41`.
- `docs/domain-language.md`: the Object group row says the page also shows it as a key number; a row for sorting by
  a column header.
- `addon/DOCS.md`: the period's "Alt" and the calendar; sorting by the headers; the key numbers for the object groups
  in place of "a key number with their cost per year".
- `docs/testing.md`: step 5's `08-periode` against the new menu; step 12's `20-stoerste-foerst` by the Beløb header;
  step 14's `28-empty` by typing a period in a year with no data; steps 16–18's "four key numbers" and step 22's
  "Faste udgifter om året pressed" for the new key numbers; the screens of §6's Chrome check, and Safari for the
  period.
- `docs/README.md`: this spec and its plan in the lists.

## 8. What is left to the builder

The calendar's look within the page's colours; how the menu stays inside the frame; the hash values for the new
sorts; how `Preset` gains "Alt"; the arrow's look; where the link and the share line sit in the key number; the word
after the count in §4.
