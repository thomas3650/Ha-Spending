# Small fixes from the 0.11.0 walkthrough – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issues:** closes #109, #110, #111, #112, #113 and #114; does the second part of #103; closes #102. One branch, one PR.

**Approved:** by Claude, 2026-11-03, under Thomas's ruling that day: "lav" on the list of small fixes from the live
walkthrough (the six walkthrough points, #103's second part and #102).

Thomas and Claude went through 0.11.0 live on 2026-11-03. These are the small findings; §1 holds the one new decision (D52). Each section
changes one thing; everything else in the [UI spec](2026-10-30-ui-ux-design.md) and the later specs holds.

## 1. "Vis alle" only in full screen (#109)

- In the normal right card, the Posteringer view loses the "Vis alle" button next to its search. The search field
  takes the row's whole width. This changes UI spec §4.2 ("Vis alle … opens all postings") for the normal card.
- In full screen, "Vis alle" stays as it is. There the key numbers are not shown, so it is the only way into Alle
  posteringer, and it keeps the search and the chosen shop (D31, D35).
- In the normal card, Alle posteringer is reached from the key numbers' links ("N posteringer →"), which clear the
  search and the shop, as today (D41). The search's hits are already the Posteringer list beside the field.
- `da.showAll`, the `open-all-postings` event and `openAllPostings` stay, since full screen uses them.
- Thomas's ruling, 2026-11-03, in the live walkthrough: remove the button from the normal card; Claude's call, agreed
  with Thomas: keep it in full screen. This is D52.

## 2. No ring on a chosen key-number card (#110)

- When the right card shows Faste udgifter, the key-number cards that switch to it ("Abonnementer i perioden", "Faste
  udgifter i perioden") no longer get the accent border and inset ring.
- The cards stay toggle buttons with `aria-pressed`; only the drawn mark of the pressed state goes. The hover border and
  the focus outline stay.
- The view switch's pressed "Faste udgifter" button already shows the choice.

## 3. The full-screen button on the title's row (#111)

- In the right card, the full-screen button sits at the top right, on the row of the card's title, at every width and
  in both the normal card and full screen.
- The view switch sits between the title and the button when the row has room. When it has not, the switch moves to
  its own row under the title and the button stays on the title's row. The switch never pushes the button to a row of
  its own.
- Nothing else of the head changes: the title still ends in "…" when long, and the kept Forskel place stays (it keeps
  the switch's width when Forskel shows).

## 4. The shop chip under the search field (#112)

- In the Posteringer search (`hs-search`, used by the right card and Alle posteringer), the chosen shop's chip
  ("Butik: X ×") sits on its own row under the search field, not to the left of it. The field keeps the row's whole
  width.
- The chip still clears the shop on a click, and Backspace in an empty field still removes it.
- The suggestion list only opens with no shop chosen, so it never overlaps the chip row.

## 5. Tab chooses a suggestion (#113)

- While the suggestion list is open, Tab chooses the highlighted suggestion, or the first one when none is highlighted,
  as Enter does on a highlighted one. The focus stays in the field, and the shop's chip shows.
- Shift+Tab is not changed. With the list closed, Tab moves the focus as usual.

## 6. Suggestions that start with the text come first (#114)

- `shopSuggestions` puts the shops whose name starts with the search text first, then the shops whose name holds it
  elsewhere. Within each, by the sum, largest first, then by name, as today. Names are compared folded, as today.
- The limit of suggestions applies after this order, so a matching name at the start is never cut by a larger one
  elsewhere.

## 7. A day's tooltip says its date once (#103, second part)

- A bar's tooltip has the bar's name, the unit's range and the amount. For a day unit (`fullStart === fullEnd`), the
  range is left out: the name already is the date. A month or week clipped to one day by the period keeps its range,
  since its name is not a date.
- Other units keep all three lines. #103's first part (the sign below zero) is not in this spec; #103 stays open.

## 8. `isRunning` and the running opacity in one place each (#102)

- `isRunning` moves from `components/bars.ts` to `shared/src/units.ts`, next to the other unit rules. `model/circle.ts`
  and `model/detail.ts` import it from `@ha-spending/shared`, so the models no longer load the chart component.
- The running bar's opacity 0.5 is written once, as a theme token `--hs-running-opacity` in `theme.ts`. The bars read it
  as the other tokens they read; `.detail-bar.running` uses `var(--hs-running-opacity)`.
- No change shows on the page.

## 9. Tests and checks

- §1: the normal card's Posteringer view has no "Vis alle" button; in full screen it has, and it still opens Alle
  posteringer with the search. The tests that pressed it in the normal card turn full screen on first, or go through
  the key number's link where the search does not matter.
- §5: with suggestions open, Tab chooses the first one; after ArrowDown twice, Tab chooses the second; the chip shows;
  Shift+Tab chooses nothing.
- §6: `shopSuggestions` with made-up shops lists the names starting with the text first, each tier by sum; a starting
  name outside the old limit is kept.
- §7: the tooltip text, through the exported function that writes it, has two lines for a day, and three for a whole
  month and for a month clipped to one day.
- §8: the existing tests pass; `isRunning` gets its tests in the shared package's unit tests.
- §2, §3, §4 are layout only. Hard rule 5 rules out CSS tests, so a Chrome check step in
  [`testing.md`](../../testing.md#chrome-check) covers them, at 1440, 1728 and 420 px, normal and full screen.
