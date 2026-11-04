# Full screen, a tooltip per part and room in the fixed-expenses view – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`, no server change.

**Issue:** closes #174. One branch, one PR.

**Approved:** pending.

Thomas and Claude walked through the fixed-expenses view ([D66](../../decisions.md)) on 2026-11-04. Thomas asked for
three things, in his words: a full screen "som på det andet kort så der er mere plads til posteringer", "et bedere
tooltip så jeg kan se hvad der er brugt pr søjle pr gruppe", and that an overdue payment "bliver den rød istedet for
grå". Claude proposed how the list gets room without full screen and what full screen shows; Thomas answered "super".
What Thomas said or agreed to is named as his. Every other detail is marked "Claude's call". Everything else in the
[fixed expenses over time spec](2026-11-04-fixed-expenses-over-time.md) and the earlier specs holds. Where they
differ, this spec holds.

"Today" is the answer's `today`, as in the fixed expenses over time spec. The examples use the fast loop's made-up
data.

## 1. Why

- **Goal:** the payments list fits its card at a normal width, with nothing drawn over anything and nothing cut off.
- **Goal:** each of the view's two cards can fill the page.
- **Goal:** a bar's tooltip says what each part of it cost, paid and estimate.
- **Goal:** an overdue payment stands out in red, in the Faste udgifter tab and in the view.
- **Non-goal:** a sort, a detail or the quick filter in the view (fixed expenses over time spec §6.4 stands).
- **Non-goal:** the overview's key numbers. Their link text "Vis faste udgifter →" and their "pr. måned" stay as they
  are. Claude's call: Thomas pointed out the link works from every object-group card, and the two "pr. måned" numbers
  were not agreed as a change.
- **Anti-goal:** a status, an amount or a sum that is cut off or covered.

## 2. Room in the normal card

What the walkthrough found, at about 1200 px of page with Home Assistant's sidebar open: in "Poster i perioden" the
object-group badge was squeezed to one letter and drawn over the start of the category, and the status and the month's
sum were cut off at the right edge.

### 2.1 What changes

Claude proposed these, and Thomas agreed:

- **No object-group badge** on a row in the normal card when one object group is chosen: the object-group step names
  it. The badge comes back in full screen (§3.3).
- **With "Alle faste udgifter"** the rows hold several object groups, and the colour dot shows the part (main group,
  category or fixed expense), not the object group. So in the normal card the object group moves out of the name line:
  - a payment row's name has a tooltip "Netflix · Abonnementer" (the name, then the object group);
  - a year row's line under the name starts with the object group: "Abonnementer · 12 betalinger · …", so two bills
    with one name in two object groups stay apart.

  Claude's call: Thomas agreed to drop the badge on the grounds that the step names the group, which holds only with
  one group chosen.
- **The status is one word:**

  | Payment | Status |
  | --- | --- |
  | Paid | **Betalt** (green) |
  | Estimate | **Forventes** (grey, dashed border) |
  | Due estimate | **Forfalden** (red, dashed border, §5.2) |
  | Not seen | **Ikke set** (red, no border) |

  The date it used to carry is the row's Dato cell. A paid row's Dato is its posting's date; an estimate's and a
  not-seen row's is the due date. So nothing is lost. This supersedes fixed expenses over time spec §6.3's status
  texts ("Betalt 1. aug", "Estimat · forventes 1. dec", "Estimat · forfalden 3. nov", "Ikke set · ventet 4. okt").
  That spec says Thomas asked for the expected date with the estimate. The date stays, in its own column. The
  estimate is still marked by "ca." before the amount, the amount's italics and the status's dashed border.
- **A year unit** ("Alt" by År, one row per fixed expense) has no Dato and no status column, as now. Its line under the
  name ("12 betalinger · heraf 2 estimat, næste forventes 1. dec · 1 ikke set") keeps its dates.

### 2.2 What gives way

- The table never scrolls sideways in the normal card when the card's outer width is 520 px or more. A 1200 px page
  gives each half about 565 px.
- Dato, Beløb, Status and a group line's sum never clip.
- When space runs short, the name and the category give way and end in "…", with the full text in a tooltip, as now.
  The category gives way first, down to 6 em. Then the name gives way, down to 6 em. Claude's call: the name tells the
  rows apart.
- A group line's name and count clip before its sum does.

At an outer card width under 520 px the list may scroll sideways, as it does now. That is a page from 1024 px to about
1110 px, where the halves stand side by side, or a phone. Claude's call: accepted there, since full screen gives the
list the page's width. Below 1024 px the halves stack, and each card has the whole width.

## 3. Full screen

D60's full screen of the overview's right card is unchanged. This adds a second full screen, the view's own.

### 3.1 The button

- Each of the view's two cards gets a full-screen button in its title row, in the overview's look, with
  `aria-pressed`. The bars' card gets one, and the payments' card gets one. Thomas asked for the list's; Claude
  proposed the bars' too, and Thomas agreed.
- Each button's accessible name names its card: "Fuld skærm: <the card's title>", such as "Fuld skærm: Alle faste
  udgifter pr. måned" and "Fuld skærm: Poster i perioden". Claude's call: two buttons on one page need two names.
- The button is there whenever the answer is ready, also when the list shows its empty text or every bar is empty.
- A press on the button in a card that fills the page closes full screen, as on the overview.

### 3.2 What it shows

- **One card alone, the page's whole width.** The other card and the view's key numbers are not shown, as the overview
  hides the left card and its key numbers. The top card stays, with the trail and Konti.
- **The bars in full screen** are as tall as the overview's full-screen bars ([D67](../../decisions.md)): they reach
  the window's bottom edge, with a 400 px floor. The legend stays above them. A bar press chooses the unit and stays in
  full screen. The faded other bars and the × in the trail work as in the normal card.
- **The list in full screen** shows the title, the sum line and the rows of the chosen unit or of the whole drawn span,
  as in the normal card (fixed expenses over time spec §6.1, §6.2). Choosing a unit from the trail's list narrows it.
  The card is as tall as its rows, and the page scrolls. Claude's call.

### 3.3 The list in full screen

- Each row has its object-group badge again, after the name, with any object group chosen. A year row's line under
  the name does not repeat the object group.
- The name and the category show in full. Claude's call: at the page's full width they fit. If one does not fit, it
  ends in "…" as in §2.2.
- The status is the same one word as in §2.1. Thomas agreed to one look for both sizes.
- A group line shows its whole sum.

### 3.4 The hash

One new key:

| Key | Meaning |
| --- | --- |
| `full` | **new:** `bars` or `list`, the card that fills the page; absent is no full screen. Read only with `view=fixed`. Written right after `og`, or right after `view` when `og` is absent |

- Any other value of `full` reads as absent.
- With `view=fixed`, `view=full` cannot also be set: the overview's full screen stays `view=full`, and the view's is
  `full`. Claude's call: `view` already holds one value.
- Leaving the view drops `full`. The overview's full screen does not come along.
- When `view=fixed` falls back to the overview (the answer has no subscriptions), `full` is dropped as well: the
  overview shows its normal cards, not `view=full`.
- A reload or a link with `full` opens that card in full screen.

### 3.5 History, Escape and ←

They work as the overview's full screen does (top filter spec §3.2):

- **Open** pushes a history entry with the full-screen mark, so Back closes full screen. When the entry under it is the
  view's open (its mark), the full-screen entry also says so, as `DETAIL_OVER_FULL` does for a detail over full screen.
- **Close** by the button or Escape goes back one entry when the current entry is the full-screen open. Otherwise it
  replaces the current entry with full screen off. After a unit chosen in full screen the current entry is not the
  open, so a close replaces, and a following Back lands on the full-screen open's entry, in full screen and without
  the unit. Top filter spec §3.2 accepts the same on the overview.
- **Escape**, after any open list or panel in the trail has closed, closes full screen first. A second Escape leaves
  the view.
- **The ← button** leaves the view, also from full screen, in one press. Claude's call: ← is named "Tilbage til
  overblikket".
  - When the current entry is the full-screen open pushed right over the view's open, ← goes back two entries, so Back
    afterwards does not reopen the view.
  - Otherwise it replaces the current entry with the overview, as the view's ← does after any push (fixed expenses
    over time spec §2). Back then lands on the entry before. That can be the view in the normal card, or, after a
    choice made in full screen, the full-screen open's entry: the view in full screen without that choice, as in the
    Escape case above. Accepted.
- Choosing a unit, a period, a level or an object group in full screen pushes an entry as in the normal card, and
  keeps full screen.
- **The focus:**
  - Opening and closing by the button leave it on the button, which stays in its card.
  - When Escape, Back or Forward leaves the element that had the focus gone, the focus goes to the heading of the card
    that fills, or filled, the page: `#hs-fixed-bars-title` or `#hs-fixed-list-title`. Both headings take the focus
    (`tabindex="-1"`); the list's gets it with this change. A card goes away only when full screen opens, so this is
    mainly Back or Forward onto a full-screen entry.
  - A reload into full screen leaves the focus where the page puts it.

### 3.6 Widths

Full screen works at every width. Below 1024 px the halves stack, so it mainly hides the other card and the key
numbers. Claude's call: the button then still does what its name says.

### 3.7 Loading and errors

While the answer loads in full screen, there is one placeholder card and no key numbers, as on the overview. On an
error the overview's error line shows, and there is no button.

## 4. The bar tooltip

Thomas: "så jeg kan se hvad der er brugt pr søjle pr gruppe". This supersedes fixed expenses over time spec §5.4's
tooltip text ("Betalt: …", "Estimat: ca. …", "I alt: ca. …").

- The first line names the unit, as now ("August").
- Then one line per part with a payment in the unit, with its colour swatch, in the legend's order (the parts' order,
  fixed expenses over time spec §5.2). Each line has the part's name and its sums:

  | The part's payments in the unit | Line |
  | --- | --- |
  | Paid only | "Bolig: 8.000 kr." |
  | Paid and estimates | "Bolig: 8.000 kr. + ca. 900 kr." |
  | Estimates only | "Bolig: ca. 900 kr." |
  | Holds a due estimate | as above, then " · forfalden" |

  A not-seen row has no amount and adds no line. A refund counts negative, as in the sums. A paid sum below zero reads
  as `barKr` writes it, "+500 kr. retur" ([D54](../../decisions.md)).
- **More than ten parts:** the nine biggest get a line, still in the legend's order, and the rest are one line after
  them: "3 andre: 1.200 kr." in the same format, with a grey swatch, and " · forfalden" when any folded part holds a
  due estimate. "Biggest" is the absolute value of paid plus estimates in the unit. So a tooltip has at most ten part
  lines, and the folded line holds at least two parts. Claude's call: a tooltip must fit the chart.
- The last line is the bar's total, in bold: "I alt: 9.000 kr.", or with estimates "I alt: 8.000 kr. + ca. 900 kr.".
  Claude's call: the paid and estimated parts stay apart, so the total does not read as paid.
- An empty bar's tooltip has the unit and "Ingen betalinger".
- The parts are the bar's stack (fixed expenses over time spec §5.2): main groups at Alt forbrug, categories in a main
  group, fixed expenses in a category.
- The tooltip stays inside the chart, as now. It works the same in full screen.
- The bars' buttons keep their accessible names (fixed expenses over time spec §5.4).
- One exported function over the view's model gives the lines: plain text and a colour per line. A second exported
  function builds the tooltip's HTML from them and escapes the text, since part names are Firefly III's data. The
  chart's formatter only calls it.

## 5. Overdue in red

Thomas: "når en betaling er overskredet bliver den rød istedet for grå".

### 5.1 The Faste udgifter tab

- The status "Forfalden 30. okt" ([D64](../../decisions.md)) is red: the not-seen colours, `--hs-not-seen` on
  `--hs-not-seen-soft`. Its text keeps the date, since that table has no date column.
- Only its colour changes. It keeps its place in the Status sort (D64: Forventes' place). The row model marks a due
  status apart from its kind, so the sort does not move it.
- "Ikke set" keeps the same red. They differ by their text. Claude's call: both say a payment is missing.
- "Forventes" stays grey.

### 5.2 The view's list

- **Forfalden** is red with a dashed border: red because it is overdue, dashed because it is still an estimate.
- **Ikke set** stays red with no border.
- The row's amount stays "ca. …" in italics, in the grey of the other estimates. Claude's call: only the status is
  red, so the amount does not read as paid.

### 5.3 The bars

A due estimate can lie in a unit that has ended, such as a monthly fixed expense due on 30 October and not paid by
4 November. Today it is hatched like every estimate, while the legend says "Skraveret: estimat efter i dag". This
supersedes fixed expenses over time spec §5.4's legend text.

- **A third kind of segment.** A part's due estimates in a unit are drawn as their own segment: hatched in the part's
  colour, as an estimate, with a 2 px outline in `--hs-not-seen`. It is stacked above the paid segments and below the
  other estimates. A part with a due estimate and a future one in the running unit has both segments. Claude's call:
  a red fill would lose the part's colour, and `PALETTE` has a red (`#e34948`) a red hatch would be taken for.
- When the part's own colour is the palette red, the outline is hard to see. The tooltip's " · forfalden" and the list
  still say it. Claude's call: accepted.
- **The legend** says "Skraveret: estimat". When the drawn bars hold a due estimate, a red-outlined swatch follows with
  "Rød kant: forfalden". Claude's call: an estimate can lie before today, so "efter i dag" was not true.
- The tooltip marks the part " · forfalden" (§4).

## 6. Tests and checks

Made-up data only. Hard rule 5: behaviour through roles, accessible names and rendered text. The layout (§2.2, §3.3)
and the colours (§5) are checked in Chrome, not in tests.

- **§2.1:**
  - With one object group chosen, the normal card's rows have no object-group badge.
  - With "Alle", a row's name has the tooltip "<name> · <object group>". A year row's line starts with the object
    group.
  - The statuses read "Betalt", "Forventes", "Forfalden" and "Ikke set", with no date. A paid row's Dato is its
    posting's date.
  - "Alt" by År still has its line with dates.
  - The fixed expenses over time spec's status tests change with it.
- **§3.1, §3.2:**
  - Each card has its button, named "Fuld skærm: …" after its card, with `aria-pressed="false"`. Tests find each by
    that name.
  - A press on the bars' button shows the bars' region alone, with no payments region and no key numbers. The button
    reads `aria-pressed="true"`. A second press brings both cards and the key numbers back. The same for the list's
    button.
  - The buttons are there when the list shows its empty text.
  - A bar press in full screen chooses the unit, and the bars stay alone. In the list's full screen, a unit from the
    trail's list narrows the list, and full screen stays.
- **§3.3:** the list in full screen has the object-group badge on its rows.
- **§3.4:**
  - `full=bars` and `full=list` round-trip with `view=fixed`, with and without `og`.
  - An unknown `full` reads as absent. `full` without `view=fixed` is ignored.
  - Leaving the view drops it. A reload with `full=list` opens the list in full screen.
  - `view=fixed&full=list` with no subscriptions shows the overview not in full screen, and the hash has no `full`.
- **§3.5:**
  - Open, then `history.back()`, closes full screen and stays in the view.
  - Open, then the button's close, then `history.back()`: full screen does not reopen, and Back leaves the view.
  - Escape in full screen closes it, and a second Escape leaves the view. With the trail's list open, the first Escape
    closes the list, and full screen stays.
  - ← in full screen right after the view's open and full screen's open leaves the view; a following Back does not
    reopen the view.
  - A unit chosen in full screen, then Escape: the view in the normal card with the unit; Back then lands in full
    screen without the unit.
  - A unit chosen in full screen, then ←: the overview; Back then lands in full screen without the unit.
  - The focus stays on the button after open and after close.
  - Escape from the list's full screen with the focus on the list's scroll region: the focus stays there.
  - The focus in the list, then Forward onto the bars' full-screen entry: the focus is on `#hs-fixed-bars-title`.
- **§3.7:** while loading with `full=bars` there is one placeholder region and no key numbers.
- **§4:** unit tests of the tooltip function:
  - a bar with paid only, a mixed bar, an estimates-only bar, a part with a due estimate;
  - a refund reading "+… kr. retur";
  - an empty bar;
  - eleven parts giving nine lines and "2 andre: …", and ten parts giving ten lines and no folded line;
  - the legend's order, and the total line keeping paid and estimates apart;
  - the folded line's grey swatch, and its " · forfalden" when a folded part is due;
  - the exported step that turns the lines into the tooltip's HTML escapes a part name holding `<`
    ([D68](../../decisions.md): the chart's wiring is not read in tests).
- **§5.1:** a model unit test: the tab's row for a due subscription is marked due, keeps the Forventes kind, and keeps
  its place in the Status sort. Its text reads "Forfalden …".
- **§5.3:**
  - With a due estimate in the bars the legend has "Rød kant: forfalden"; without one it does not.
  - The legend reads "Skraveret: estimat" when there are estimates.
  - A model test: a part with a due estimate and a future one in the running unit gives a due sum and an estimate sum.
- **The Chrome check** ([`testing.md`](../../testing.md#chrome-check)), in the fast loop at 1100, 1200, 1440 and
  1728 px, at 900 px for the stacked halves, and in a window about 500 px high:
  - from 1200 px up, the normal list fits with no sideways scroll, no badge and no cut status or sum, with one object
    group and with "Alle"; at 1100 px nothing is cut off or covered, and any sideways scroll stays inside the list;
  - each card's full screen, the list's badges in full screen, and the bars reaching the bottom edge, or keeping
    400 px and scrolling in the low window;
  - the tooltip on a mixed bar at Alt forbrug and in a main group;
  - Forfalden red in the tab and in the list, and the red outline and legend line in the bars;
  - Back, Escape twice, and ← out of full screen.

## 7. Docs

Changed in the same PR:

- `addon/DOCS.md`:
  - the view's full screen and its way out;
  - the line "The ← button before the trail, Escape and the browser's Back button leave the view": in full screen,
    Escape and Back close full screen first;
  - the tooltip per part; Forfalden in red; the legend's red outline;
  - the overview's "Fuld skærm" paragraph names the view's full screen as its sibling.
- `docs/domain-language.md`:
  - the Full screen row gets the view's `full=bars|list` with D72;
  - the line on the hash keys gets D72;
  - the Subscription status row notes that Forfalden is red, with D72.
- `docs/testing.md`: the Chrome check gets §6's steps.
- `docs/README.md`: the map gets this spec's plan. This branch already adds the spec to the map.
- `docs/decisions.md`: D72 below, and the statuses it changes.

## 8. Decisions

### D72: Full screen in the fixed-expenses view, one-word statuses, and Forfalden in red

- **Date:** 2026-11-04 · **Status:** active
- **Decision:**
  - Each of the fixed-expenses view's two cards can fill the page; the hash has `full=bars|list` with `view=fixed`.
    It is a second full screen beside D60's, which it does not change.
  - The view's payments list has no object-group badge in the normal card, and its status is one word (Betalt,
    Forventes, Forfalden, Ikke set), since its Dato column holds the date.
  - A bar's tooltip lists each part's paid and estimated sums.
  - Forfalden is red in the Faste udgifter tab and in the view's list. In the bars a due estimate is its own segment
    with a red outline.
- **Why:** in a walkthrough the list was covered and cut off at a normal width, and Thomas missed room for the
  payments, the sums per part of a bar, and an overdue payment that stands out.
- **Source:** Thomas, 2026-11-04, [fixed view full screen spec](2026-11-04-fixed-view-full-screen.md) (in
  `decisions.md` the link is `superpowers/specs/…`). The hash key, the red outline, the object group under "Alle", the
  tooltip's limit and what gives way first are Claude's call.

| Decision | Status after this change |
| --- | --- |
| D20 | active; key list superseded by D35, D42, D44, D60, D61, D66 and D72 |
| D64 | active; its colour superseded by D72 |
