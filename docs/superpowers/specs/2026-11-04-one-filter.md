# One filter in the trail – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issues:** closes #121, #123, #124, #125, #126, #127, #128, #129 and #131; closes #97 as no longer needed. One branch,
one PR.

**Approved:** by Claude, 2026-11-04, after `reviewer` rated it Ready, under Thomas's ruling that day after the
brainstorm: "kan du klare resten her fra".

Thomas and Claude brainstormed the issues from the 0.13.0 walkthrough on 2026-11-03 and 2026-11-04. The rulings are
Thomas's unless marked "Claude's call". Everything else in the [UI spec](2026-10-30-ui-ux-design.md) and the later
specs holds.

## 1. The trail is the overview's filter (#127)

Thomas, 2026-11-03: "jeg skal finde søjler for at komme tilbage vil gerne have et ensartet filter". He chose the trail
with the chosen unit in it (A2), a × on each chosen step, and no chip row under it.

### 1.1 What it shows

- On the overview, the top card's trail names the chosen unit, main group and category, in this fixed order: "Alt
  forbrug", the unit, the main group, the category. Example: "Alt forbrug › Januar 2026 › Bolig › Husleje". The unit
  comes before the main group whatever order they were chosen in.
- The unit's step is the unit's name as the key numbers write it (`unitName` with the grouping, for example "Januar
  2026").
- The unit's name needs the answer (the units of "Alt" depend on the earliest posting, and an unknown unit is dropped
  only after the load). While the answer loads, and on an error, the trail leaves the unit's step out and shows the
  main group and the category from the state. Claude's call: the top card stays usable at once (UI spec §6).
- The steps are plain text, not links (Thomas, 2026-11-04: "ok"). The last step is the `h1`, as today. The trail is a
  navigation landmark named "Sti", as today; its text reads the steps and the separators in order.
- The chips in the right card go: the unit's chip and the category's chip under the card's title
  (`Overview.chips()`). The shop's chip under the search field stays: it filters the list, not the page.
- The Faste udgifter tab's list keeps ignoring the unit and shows the present plan, while the trail names the unit.
  Claude's call: accepted on purpose. The key-number cards above follow the unit (§2).
- Choosing stays as today: a bar chooses a unit, the circle chooses a main group and then a category. Clicking the
  chosen bar again still clears the unit.

### 1.2 The × and "Alt forbrug"

- Each chosen step (unit, main group, category) has a × button right after it. Its accessible name and tooltip are
  `da.remove(<step's text>)`, as the chips' are: "Fjern Januar 2026", "Fjern Bolig", "Fjern Husleje". The same text
  names the unit's chip on Alle posteringer.
  - × on the unit removes the unit only.
  - × on the main group removes the main group and its category (D21).
  - × on the category removes the category only.
- After a ×, the focus moves to the trail's `h1` (it has `tabindex="-1"` today), so the keyboard does not fall back to
  the page's start. Claude's call.
- "Alt forbrug" is a link when a unit, a main group or a category is chosen. On the overview it removes all three and
  keeps the rest: the search, the chosen shop (D31, D35), the card and the period. With nothing chosen the trail is
  "Alt forbrug" alone, as the `h1`, with no link and no ×.
- The ×'s look (Thomas chose B1 of the mockups): a thin light-grey ×, about 10 px, always shown, in a round hit area of
  24 px. The × is drawn as an SVG with no text node, so the trail's text holds only the steps and the
  separators. On hover and focus the round area gets a light background and the × the text colour. The trail's font and
  the steps' colour do not change. 24 px meets WCAG 2.5.8's minimum without the spacing exception.

## 2. The key-number cards follow the chosen unit (#127, #121)

- With a unit chosen, the object-group cards ("Abonnementer", "Faste udgifter", or whatever Firefly III's object groups
  are called, D38) count the payments in that unit only: the sum, the bills, and the "N posteringer →" link's count.
  Their label is "<group> i <unit>", for example "Abonnementer i januar 2026", in place of "<group> i perioden". The
  unit's name is written as the first card's label writes it today.
- The set of object-group cards does not change when a unit is chosen: it stays the period's, so the row does not
  change when a bar is clicked. A group with no payment in the unit shows 0 kr. and "ingen betalinger", as a group with
  none in the period does today. Claude's call.
- Their second line for a chosen unit is the bill count alone ("2 stk."), with no "pr. måned". Claude's call, played
  back to Thomas: a rate per month says nothing for one unit.
- Their link opens Alle posteringer with the object group and the chosen unit both as filters. This changes D42's "and
  the chosen unit".
- "Gennemsnit pr. måned" stays hidden while a unit is chosen, as today (Thomas, 2026-11-04: "fint det forsvinder").
- The list under the Faste udgifter tab does not change with a chosen unit, as today (§1.1).
- No key-number card is a button (Thomas, 2026-11-04: "kun at man skal kunne klikke på posterings linkene"). The
  object-group cards lose the toggle to Faste udgifter, its hover border and `aria-pressed`. Every card is a group
  named by its label, in the plain card's order: label, value, link, second line. Only the link can be clicked. The
  Faste udgifter tab in the right card is the way to that view.

## 3. Alle posteringer keeps its own filter row (#128, #129)

Thomas, 2026-11-04: Alle posteringer is reached from the overview's key-number links; on it, filters are chosen in
"+ Filter" and show under the search.

- The trail on Alle posteringer is "Alt forbrug › Alle posteringer". It has no unit, main group or category step, and
  no ×.
- "Alt forbrug" there goes back to the overview with the shared choices as they now are: the unit, the main group, the
  category, the search and the shop. It drops what belongs to Alle posteringer only (the sort, the amount, the object
  group), as the trail does today. Unlike the overview's "Alt forbrug", it clears nothing shared. Claude's call,
  played back to Thomas and agreed.
- The page's chips under the search show every filter, as today: unit, main group, category, amount, object group,
  each with ×. A key-number link brings the overview's choices with it, so the list matches the link's count.
- The page and the overview share the unit, the main group and the category (one view state, D20). Removing January on
  the page and then clicking "Alt forbrug" shows the overview without January. Each change is its own step in the
  browser's history, so Back restores January.
- "+ Filter" gets a section for the period's units, first in the panel after the search field. Its heading is named
  after the grouping: "Dage", "Uger", "Måneder", "Kvartaler" or "År". It lists the period's units in time order
  (`unitsOf`), each by its `unitName`.
  - One unit at a time. Pressing a unit chooses it and replaces the chosen one. Pressing the chosen one (shown pressed)
    removes it, as clicking the chosen bar does.
  - Choosing a unit here changes no card, so an open detail stays ([detail view spec](2026-11-02-detail-view.md) §5). Claude's call.
  - The panel's search field filters the units by name, as it filters the other sections.
  - The section shows only when the period has from 2 to 62 units. Claude's call: one unit is the whole period (D54),
    and "Dage" under "Alt" would list thousands of buttons. 62 covers the days of two months, the weeks of a year and
    the months of five years.
- The section heading over the object groups changes from "Faste udgifter" to "Faste betalinger". Claude's call: the
  items are Firefly III's object group titles (D38), so the heading must not name one of them.

## 4. Posteringer in full screen (#125, #128)

- In full screen, the Posteringer table has the Kategori column with the main group's colour dot, as Alle posteringer
  has (Thomas, 2026-11-04: "ja"). The normal, half-width card does not get it. Claude's call: no room.
- The column's header sorts, as on Alle posteringer. The overview keeps one sort for both widths. When the normal card
  shows and the sort's column is Kategori, the card shows the default sort (newest first) instead, as
  `shownSubscriptionSort` does for the bills. Back in full screen, the Kategori sort shows again. Claude's call.
- "Vis alle" goes from full screen too. Alle posteringer is reached from the key numbers' links only, which full screen
  does not show. Claude's call, accepted on purpose: full screen then has no way to Alle posteringer, and no way into
  it keeps the search and the shop. The event `open-all-postings`, `da.showAll` and whatever only they use go.

## 5. No Forskel tab (#126)

- The right card's Forskel tab, its view, the hidden placeholder that kept its place (`button.kept`) and whatever only
  they use go: `components/difference.ts`, the `difference` card, its titles and hint in `da.ts`, and the shared
  differences rule in `shared/src/money.ts` with its tests, if nothing else uses it.
- An old link with `card=difference` falls back to Søjler, as any unknown card does (D20).
- With the placeholder gone the full-screen button follows the last tab without a gap. The tabs no longer change with a
  chosen unit, so the switch does not jump (#85).
- #97 (a click on a Forskel row) closes as no longer needed.

## 6. Small fixes

- **The bar tooltip hides (#123).** A bar's tooltip hides when the mouse leaves the chart. Find the cause first
  (`components/bars.ts`, its ECharts tooltip settings). The detail's bars get the same fix if they share the cause.
- **The full-screen button matches the tabs (#124).** It has the tabs' height and the app's font, and sits level with
  them, in both the normal card and full screen.
- **Follow-ups from finer bars (#131).**
  - Move `barsList`, `names` and `pressed` from `finer-units.test.ts` and `month-days.test.ts` into one shared test
    helper.
  - Split the `name` expression out of `common`'s return in `model/detail.ts`.
  - Make the two tooltip checks in `finer-units.test.ts` read the mounted page's context rather than building their
    own `viewContext`.
  - The y-axis formatter gap: find a way to test that the bars use `axisTickKr` without reading the chart's options
    (D19). If there is none, open an issue for it (way of working §4) and the Chrome check keeps guarding it.
  - The day name 9 px past the bar list at 420 px needs no change; it is a note for later changes to the padding.

## 7. Tests and checks

Made-up data only. Hard rule 5: behaviour through roles, accessible names and rendered text.

- §1.1: with a unit, a main group and a category chosen, the "Sti" navigation's text reads "Alt forbrug › <unit> ›
  <main group> › <category>" and the heading is the category. With the main group chosen before the unit, the order is
  the same. While the answer loads, the trail shows no unit step. The right card has no unit or category chip.
- §1.2: each × by its name ("Fjern …") removes what §1.2 says, and the focus is then on the heading. The overview's
  "Alt forbrug" removes the unit, the main group and the category and keeps the search and the shop. With nothing
  chosen the trail has no link and no ×.
- §2: with a unit chosen, the object-group cards' labels name the unit, their sums and counts are the unit's, their
  second line is "N stk." with no "pr. måned", and a group with no payment in the unit keeps its card with "ingen
  betalinger". The link opens Alle posteringer with the unit's and the group's chips. No key-number card is a button.
- §3: Alle posteringer's trail has no unit, main group or category step and no ×. Its "Alt forbrug" opens the overview
  with the unit, the main group, the search and the shop kept. After removing the unit's chip there and going back to
  the overview, the unit is gone; `history.back()` brings it back. "+ Filter" lists the period's units under the
  grouping's heading; choosing one shows its chip and filters the list; choosing another replaces it; pressing the
  chosen one removes it; the panel's search narrows the units. A one-unit period has no unit section. The object
  groups' heading reads "Faste betalinger".
- §4: full-screen Posteringer has a Kategori column and no "Vis alle"; the normal card has neither. Sorted by Kategori
  in full screen, the normal card shows the newest-first order, and full screen shows the Kategori order again.
- §5: there is no Forskel tab with or without a unit; `#card=difference` shows Søjler.
- §6: #123 gets a test if the cause can be shown through the page's events; otherwise the Chrome check covers it. #124
  is layout: the Chrome check.
- The Chrome check ([`testing.md`](../../testing.md#chrome-check)) at 1440, 1728 and 420 px, normal and full screen:
  the trail with its × (B1's look), the key cards with and without a unit, the full-screen button level with the tabs,
  the bar tooltip hiding when the mouse leaves the chart, the unit section in "+ Filter".

## 8. Docs

Changed in the same PR:

- `addon/DOCS.md`: the key numbers' text (no "sum per month" with a unit, no click on the card, the link keeps the
  unit); the trail with its ×; no Forskel; no "Vis alle" in Posteringer (Butikker's "Vis alle" stays).
- `docs/domain-language.md`: the Card row loses Forskel and `"difference"`; the trail's × if the trail is named there.
- `docs/testing.md`: the Chrome-check steps on Forskel, on "Vis alle" in full screen, on "No button moves when Forskel
  comes and goes", and on the key card's hover border change to this spec's checks.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D55 to D57 below, and the status of each decision they change.

## 9. Decisions

- **D55: The trail is the overview's filter.** §1 and §3: the trail names the chosen unit, main group and category in
  that order, each with a ×; no chips for them on the overview; Alle posteringer keeps its chips, a plain trail and a
  unit section in "+ Filter". It supersedes UI spec §3.1's trail, §4.2's category chip at the right card's title,
  §4.3's list of what "+ Filter" adds, §4.4's unit chip at the right card's title and its "a unit is chosen from a bar
  only", and §5's trail.
- **D56: The key-number cards follow the chosen unit and are not buttons.** §2. With a unit chosen, D41's "the
  period's payments with the sum per month" becomes the unit's payments and the bill count. D42's link keeps the unit:
  its "and the chosen unit" exception and the why that rests on it are superseded.
- **D57: No Forskel and no "Vis alle".** §4 and §5. It supersedes D52. D31's and D35's "opening Alle posteringer keeps
  the search" (and the shop) no longer has a way in that does it. D19's Forskel table and D51's "the month's Forskel
  reachable" no longer apply. Also superseded: UI spec §4.2's and §4.4's Forskel, §7's sign of the Forskel view, and
  the technical spec's Forskel bars.

D19, D31, D35, D41, D42, D51 and D52 get their status set as the decision log's format says: "superseded by D5x", or
"active; <part> superseded by D5x".
