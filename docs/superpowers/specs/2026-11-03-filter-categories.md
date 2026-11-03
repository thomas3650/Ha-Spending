# The filter panel's categories by main group – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issue:** #106. One branch, one PR.

**Approved:** by Claude, 2026-11-03, under Thomas's ruling that day to file an issue, fix it alone and release.

In Alle posteringer, "+ Filter" lists every category in one flat list under "Kategorier", by name
([UI spec §4.3](2026-10-30-ui-ux-design.md)). Nothing tells which main group a category belongs to. Once the panel is
scrolled, the "Kategorier" heading is gone and the list reads as a mix of categories and shop-like names.

This spec changes only how the "Kategorier" part of the panel is laid out. What a choice does, the chips, the hash, the
other parts of the panel and the search stay as they are.

## 1. The layout

- The "Kategorier" part keeps its heading and its group (`role="group"`, named "Kategorier").
- Inside it, one group per main group, named by the main group and headed by its name. The order is the order of the
  "Hovedgrupper" part above: the main groups by name, then "Uden hovedgruppe" for the categories with no main group.
- Within a main group, its categories by name, as today (`compareKeys`).
- "Uden kategori" stays last in the "Kategorier" part, outside the main groups.
- The two heading levels differ in colour and weight: a part heading ("Kategorier", "Hovedgrupper") stays muted and
  normal weight; a main group's heading is in the normal text colour, semi-bold (600), at the same 11px. Its
  categories are indented 12px more than today, so they read as under it.

## 2. The search

- A category shows when its own name fits the search, as today.
- A main group's heading shows only when at least one of its categories shows. A main group with no category that fits
  is left out, heading and all.
- The "Ingen filtre passer" text shows on the same terms as today.

## 3. What does not change

- A click on a category fires `set-category` with its main group and name, and marks it pressed on the same terms.
- The "Hovedgrupper" part, the amount part, the object groups and the order of the parts.
- No new `da` key: the main group headings use `partName(key, "mainGroup")`.

## 4. Tests

- With the panel open, the "Kategorier" group holds one group per main group, named by it, in the order above, and each
  holds exactly its categories by name.
- A category with no main group is listed under "Uden hovedgruppe".
- Searching for a category's name shows its main group's group with only the categories that fit, and no other main
  group's group.
- With a category chosen (the hash `group=Mad&category=Café`), "Café" in the "Mad" group is pressed and "Dagligvarer"
  is not.
- The existing tests of choosing a category, "Uden kategori" and the search pass unchanged.
- A Chrome check step in [`testing.md`](../../testing.md#chrome-check) covers the layout, scrolled, searched and by
  keyboard, at 1440, 1728 and 420 px.

A search for a main group's name ("Mad") shows its button under "Hovedgrupper" and none of its categories, as today.
That is a choice, not a gap: the search matches names, and a main group is chosen from its own part.
