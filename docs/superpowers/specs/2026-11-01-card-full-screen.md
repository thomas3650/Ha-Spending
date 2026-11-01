# The right card in full screen, and Faste udgifter by group – design

**Real Home Assistant:** no change there from this work. The change reaches the house with the next release, through
the house session ([`releasing.md`](../../releasing.md#after-a-release)).

**Issue:** #59.

Thomas runs the page full screen and wants more room for the right card's lists, Posteringer and Faste udgifter
above all. He also wants to see which main group and category each fixed cost belongs to, in the page's colours. On
2026-11-01 he chose, from three drafts shown in chat, the one that groups the fixed costs under a header per main group
with a colour dot, the count and the sum per year. He said full screen is fine for every view of the card.

This spec changes the [UI and UX spec](2026-10-30-ui-ux-design.md) and the
[subscriptions spec](2026-11-01-subscriptions.md) where it says so. Everything else there holds.

## 1. Full screen for the right card

- **The button:** an icon button at the end of the right card's title row, right after the view switch, on every view
  (Søjler, Posteringer, Forskel, Faste udgifter). When the head wraps (at 420 px, or whenever Faste udgifter exists),
  it stays beside the switch on the switch's line. Its accessible name is "Fuld skærm" and it has `aria-pressed`. The
  icon is "expand" (two arrows apart) when off and "collapse" when on, as inline SVG.
- **On:** the right card takes the whole width of the page's content. The left card (the circle) and the key numbers
  are left out of the render, not hidden with CSS. The top bar (title, period, grouping, accounts), the chips and the
  `noRuleGroup` status line stay.
- **While loading** (a period change starts a fetch): one full-width placeholder in the right card's shape, and no
  key-number placeholder.
- **Off:** the same button, or Escape on the overview while it is on. An Escape that another control uses first (an
  open dropdown, or the search's open suggestion list) does not leave full screen: the search's Escape stops
  propagating, as the dropdowns' does. On Alle posteringer, Escape does nothing to it. After a press, the focus stays
  on the button.
- **How long it lasts:** a view setting of this page load, held by the app (`SpendingApp`), not by the overview, so it
  survives opening Alle posteringer and coming back. It is not in the hash and adds no history entry. It survives
  every action on the overview (a level, a bar, the period, the grouping, the accounts, the card's view, the search).
  A reload starts with it off. This is new decision D37: a layout setting that a shared link should not carry stays
  out of the hash.
- **Widths:** at every width, including 420 px where the halves stack, on means the right card alone.

## 2. Faste udgifter grouped

**Changes the subscriptions spec** §1.2 (one flat table). The fixed costs are grouped by the level below the one
shown, as the circle is:

| Level | Groups | Kategori column |
| --- | --- | --- |
| Alt forbrug | main group | yes |
| A main group | category | no: the group names it |
| A category | none: one flat table, as today | no |

- A fixed cost's main group and category come from its latest payment's category, as the level filter already does.
  At Alt forbrug, one with no payment, or whose category has no main group or is missing from the categories, falls
  in "Uden hovedgruppe" (`da.noMainGroup`). At a main group or a category such a fixed cost is not shown at all, as
  today, so there is no "Uden kategori" group. In the Kategori column, a row with no payment or an unknown category
  reads "Uden kategori" (`da.noCategory`).
- **A group's colour** is the period circle's colour for that key: `partColours(ctx).get(key) ?? NO_PIECE`. It is the
  same at every unit choice. A group with no piece in the period's circle (no spending there in the period, or none on
  the chosen accounts) gets `NO_PIECE` grey, as such a part does in the circle's legend. Uden hovedgruppe takes its
  circle colour like any other part.
- **A group** is a header row, styled like the posting list's group rows: a dot in the group's colour, the name, the
  count ("2 faste udgifter", with `da.subscriptionCount`), and the group's sum per year in the "Om året" column. The
  header cell is a row header (`<th scope="rowgroup">` in its own `<tbody>`), so a screen reader reads each fixed cost
  under its group. Under it, its fixed costs in today's order (status, then next date, then name).
- **Group order:** the biggest sum per year first; ties by name with `localeCompare(…, "da")`; Uden hovedgruppe last.
- The groups do not fold. The card's head sum (per year) and the key number are unchanged.

## 3. What is left to the builder

The icon's drawing, and the group row's look within the posting list's group-row style. The layout of full screen,
within §1.

## 4. Tests and checks

- **Full screen, by role, name and text:**
  - the button "Fuld skærm" is on every view of the card;
  - pressing it leaves out the circle's region and the key numbers (not found by role), sets `aria-pressed="true"`,
    and keeps the focus on the button; pressing again brings them back;
  - Escape on the overview turns it off; Escape with the search's suggestions open closes the list and keeps it on;
  - the hash does not change and no history entry is added;
  - it stays on after choosing a bar, changing the card's view, changing the period (with the loading state showing no
    key-number placeholder), and opening and leaving Alle posteringer.
- **Groups:** at Alt forbrug the table has group rows by main group, biggest sum per year first, each with its count
  and sum per year, and a Kategori column; a fixed cost with no payment falls in Uden hovedgruppe, last, and its
  Kategori reads "Uden kategori"; at a main group, group rows by category and no Kategori column; at a category, no
  group rows.
- **Colours** are not tested by value (hard rule 5); the Chrome check compares them with the circle.

The Chrome check ([`testing.md`](../../testing.md)): full screen on and off on each view at 1440, 1728 and 420 px;
Faste udgifter at Alt forbrug and at a main group, each dot matching its part in the circle.

## 5. Docs in the same PR

- `docs/decisions.md`: D37, full screen is a layout setting of the page load, out of the hash.
- `addon/DOCS.md`: the Faste udgifter paragraph says the costs are grouped by main group with their category, and one
  sentence on full screen.
- `docs/testing.md`: new screens for full screen and the grouped Faste udgifter.
- `docs/README.md`: this spec and its plan in the lists.
