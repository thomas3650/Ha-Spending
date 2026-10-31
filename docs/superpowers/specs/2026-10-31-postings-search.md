# A bar opens Posteringer, and Posteringer has a search – design

**Real Home Assistant:** no change there from this work. The change reaches the house with the next release, through
the house session ([`releasing.md`](../../releasing.md#after-a-release)).

**Issue:** #39. Store suggestions as you type are #40, not this work.

Thomas wants two things from the page. A click on a month's bar should show that month's postings. And he wants to
find what a store costs a month and a year. Alle posteringer can answer the second today, but its search sits behind a
small "Vis alle" link below the whole list, so he did not find it. This first step moves the search he has to where
he looks. Thomas saw the layout in §2 as a mockup in Chrome.

This spec changes the [UI and UX spec](2026-10-30-ui-ux-design.md) where it says so. Everything else there holds.

## 1. A bar click opens Posteringer

**Changes the UI spec** §4.4 ("and opens on it"). Bars are shown only in Søjler, so every bar click starts there:

- **A click on a bar that is not chosen** chooses its unit, also when another unit was chosen, and switches the card to
  **Posteringer**, which shows only that unit's postings. Forskel stays the third choice while a unit is chosen.
- **A click on the chosen bar** unchooses the unit. The card stays on Søjler.
- The chip's ✕ unchooses the unit and leaves the card where it is, except that Forskel goes back to Søjler, as today.
  Changing the period or the grouping, and a unit the answer does not know, also send Forskel back to Søjler, as today.

The circle, the key numbers and the unit's chip are as §4.4 says.

## 2. A search at the top of the Posteringer card

On every level (screens 1 and 2), the Posteringer view of the right card has, under its title row:

- **The search**, the same field as on Alle posteringer: the placeholder "Søg i teksten, fx "pizza"", the accessible
  name "Søg", and the same match (the posting's text contains what is typed, ignoring case and the spaces around it).
  The field stays in place, and keeps the focus, whatever the list below it turns into while typing.
- **"Vis alle"** as a button on the same line, right of the field, at the field's height. The field takes the rest of
  the line; at 420 px both still fit on one line. The button opens Alle posteringer with the same choices, the search
  included. It leaves the card's foot, which keeps only the grouping note ("Grupperet pr. måned, som "Gruppér
  pr.".").
- **The count and the sum**, right-aligned under the search, worded as on Alle posteringer ("38 posteringer · 7.412
  kr."). They count every posting the list holds (the level, the accounts, the period or the chosen unit, and the
  search), whatever is folded or not yet shown behind "Vis ældre". They are there with or without a search.
- **The list** holds the matching postings, grouped as §4.2 says.
  - **Changes the UI spec** §4.2 ("a group's postings add up to its line, and its line is its bar"): under a search,
    a group line counts and sums only its matching postings, so it is what the store cost that month, not the bar.
  - A change of the search, from typing, from the hash or from Back, starts the list afresh: the two newest groups
    open, the rest folded, the first page shown.
- **Nothing to show:**
  - With a search and no match: "Ingen posteringer passer til filtrene", as on Alle posteringer.
  - With no search and nothing in the period or the chosen unit (a unit after today, D23): "Ingen forbrug i perioden".
  - The search row shows in both cases, also when the whole period has no spending, so a search can always be seen
    and cleared.

The search filters the list only. The circle, the key numbers and the bars do not change with it (Claude's call: they
answer "what did the level cost", the search answers "which postings"). The amount range is not applied here; it
belongs to Alle posteringer.

## 3. One search for the page

**Changes the UI spec** §5 ("the search and the amount range belong to Alle posteringer only"): the search is one of
the shared choices. Only typing in a search field changes it. Every other action keeps it: the card's switch, the
period, the grouping, the accounts, a part of the circle, a bar, a chip's ✕, "+ Filter", a trail link, "Vis alle" and
Back. Today opening Alle posteringer and following a trail link clear it; both stop doing so. Sortér and the amount
range still belong to Alle posteringer only, and are still cleared as today.

**In the hash:** `parseHash` reads `q` and `toHash` writes it on every screen, not only with `view=all-postings`. D20's
keys and their order are unchanged, and typing still replaces the history entry, now on the overview too. This is
new decision D31 (Thomas, 2026-10-31); D20 stays active.

## 4. Tests and checks

Tests that flip on purpose: `chosen-unit.test.ts` "chooses July from its bar and shows Forskel", the bar-click and
trail cases in `actions.test.ts` that expect Forskel or an empty search, and `all-postings.test.ts` "leaves the search
behind through the trail".

New tests:

- **State:** a bar opens `postings`; the chosen bar unchooses and keeps `bars`; `q` parses and is written without
  `view=all-postings`; opening Alle posteringer, a trail link and opening a part keep the search; sort and the amount
  range are still cleared; `min` and `max` without `view=all-postings` still parse to no amount range.
- **The overview, by role, accessible name and text:**
  - the search box "Søg" filters the rows, and the count and the sum follow it;
  - the key numbers and the circle's total stay the same with a search;
  - the search is still in the field after Posteringer → Søjler → Posteringer;
  - a deep link `#card=postings&q=…` shows the filtered list;
  - after folding a group and pressing "Vis ældre", a search that keeps the same newest group brings the group lines
    back to the start (the two newest open, the first page);
  - both empty texts, with the search box still there, and still the focused element after typing until nothing
    matches;
  - the button "Vis alle" opens Alle posteringer with the search in its field.

The Chrome check ([`testing.md`](../../testing.md)): a bar click at 1440 and 1728 px wide and at 420 px, the search
row at those widths, and Back after typing.

## 5. Docs in the same PR

- `docs/decisions.md`: D31, the search is a shared choice in the hash on every screen.
- `docs/testing.md`: `23-soejle` and `24-soejle-kategori` switch to Forskel after the bar click; new screens for the
  overview's search and its no-match text.
- `docs/README.md`: this spec and its plan in the lists.
- The comment on `ViewState.search` in `addon/web/src/state/view.ts`.
