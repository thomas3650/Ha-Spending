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

- **No object-group badge** on a row in the normal card. The row's colour dot already shows its part, and the
  object-group step names the group. The badge comes back in full screen (§3.3).
- **The status is one word:**

  | Payment | Status |
  | --- | --- |
  | Paid | **Betalt** (green) |
  | Estimate | **Forventes** (grey, dashed border) |
  | Due estimate | **Forfalden** (red, dashed border, §5) |
  | Not seen | **Ikke set** (red, solid) |

  The date it used to carry is the row's Dato cell. A paid row's Dato is its posting's date; an estimate's and a
  not-seen row's is the due date. So nothing is lost. This supersedes fixed expenses over time spec §6.3's status texts
  ("Betalt 1. aug", "Estimat · forventes 1. dec", "Estimat · forfalden 3. nov", "Ikke set · ventet 4. okt"). That spec
  says Thomas asked for the expected date with the estimate. The date stays, in its own column. The estimate is still
  marked by "ca." before the amount, the amount's italics and the status's dashed border.
- **A year unit** ("Alt" by År, one row per fixed expense) has no Dato and no status column, as now. Its line under the
  name ("12 betalinger · heraf 2 estimat, næste forventes 1. dec · 1 ikke set") keeps its dates.

### 2.2 What gives way

- The table never scrolls sideways in the normal card. At a card width of 520 px and up, every column fits.
- Dato, Beløb, Status and a group line's sum never clip.
- When space runs short, the name and the category give way and end in "…", with the full text in a tooltip, as now.
  The category gives way first, down to about 6 em, then the name. Claude's call: the name tells the rows apart.
- A group line's name and count clip before its sum does.

At narrower cards (below 520 px, a window under 1024 px where the halves stack, or a phone) the list may scroll
sideways as it does now. Claude's call: the list stacks under the bars there and has the whole width.

## 3. Full screen

### 3.1 The button

- Each of the view's two cards gets the full-screen button in its title row, the overview's (`da.fullScreen`, "Fuld
  skærm", with `aria-pressed`). The bars' card gets one, and the payments' card gets one. Thomas asked for the list's;
  Claude proposed the bars' too, and Thomas agreed.
- A press on the button in a card that fills the page closes full screen, as on the overview.

### 3.2 What it shows

- **One card alone, the page's whole width.** The other card and the view's key numbers are not shown, as the overview
  hides the left card and its key numbers. The top card stays, with the trail and Konti.
- **The bars in full screen** are as tall as the overview's full-screen bars ([D67](../../decisions.md)): they reach
  the window's bottom edge, with a 400 px floor. The legend stays above them. A bar press chooses the unit and stays in
  full screen. The faded other bars and the × in the trail work as in the normal card.
- **The list in full screen** shows the title, the sum line and the rows of the chosen unit or of the whole drawn span,
  as in the normal card (fixed expenses over time spec §6.1, §6.2). Choosing a unit from the trail's list narrows it.

### 3.3 The list in full screen

- Each row has its object-group badge again, after the name.
- The name and the category show in full. Claude's call: at the page's full width they fit. If one does not fit, it
  ends in "…" as in §2.2.
- The status is the same one word as in §2.1. Thomas agreed to one look for both sizes.
- A group line shows its whole sum.

### 3.4 The hash

One new key, written right after `og`:

| Key | Meaning |
| --- | --- |
| `full` | **new:** `bars` or `list`, the card that fills the page; absent is no full screen. Read only with `view=fixed` |

- Any other value of `full` reads as absent.
- With `view=fixed`, `view=full` cannot also be set: the overview's full screen stays `view=full`, and the view's is
  `full`. Claude's call: `view` already holds one value.
- Leaving the view drops `full`. The overview's full screen does not come along.
- A reload or a link with `full` opens that card in full screen.

### 3.5 History, Escape and ←

They work as the overview's full screen does (top filter spec §3.2):

- **Open** pushes a history entry with the full-screen mark, so Back closes full screen.
- **Close** by the button or Escape goes back one entry when that entry is the full-screen open. Otherwise it replaces
  the current entry with full screen off.
- **Escape** closes full screen first. A second Escape leaves the view.
- **The ← button** leaves the view, also from full screen, by the view's rule: back past the open when the entry is the
  view's open, otherwise a replace. From full screen the entry is never the view's open, so ← replaces. Claude's call:
  ← is named "Tilbage til overblikket", and one press should get there.
- Choosing a unit, a period, a level or an object group in full screen pushes an entry as in the normal card, and
  keeps full screen.
- The focus: opening and closing by the button leave it on the button, which stays in its card. When the focus is
  lost, as after Escape or Back from an element that is gone, it goes to the heading, as on the overview
  (`focusHeadingIfLost`).

### 3.6 Widths

Full screen works at every width. Below 1024 px the halves stack, so it mainly hides the other card and the key
numbers. Claude's call: the button then still does what its name says.

### 3.7 Loading and errors

While the answer loads in full screen, there is one placeholder card and no key numbers, as on the overview. On an
error the overview's error line shows, and the button is not there.

## 4. The bar tooltip

Thomas: "så jeg kan se hvad der er brugt pr søjle pr gruppe".

- The first line names the unit, as now ("August").
- Then one line per part of the bar, with its colour swatch, in the stack's order from the top down. Each line has the
  part's name and its sums:

  | The part's payments in the unit | Line |
  | --- | --- |
  | Paid only | "Bolig: 8.000 kr." |
  | Paid and estimates | "Bolig: 8.000 kr. + ca. 900 kr." |
  | Estimates only | "Bolig: ca. 900 kr." |
  | Holds a due estimate | as above, then " · forfalden" |

  A part with no payment in the unit has no line. A not-seen row has no amount and adds no line. A refund counts
  negative, as in the sums.
- The last line is the bar's total, in bold: "I alt: 9.000 kr.", or with estimates "I alt: 8.000 kr. + ca. 900 kr.".
  Claude's call: the paid and estimated parts stay apart, so the total does not read as paid.
- An empty bar's tooltip has the unit and "Ingen betalinger".
- The parts are the bar's stack (fixed expenses over time spec §5.2): main groups at Alt forbrug, categories in a main
  group, fixed expenses in a category. With more than ten parts in one bar, the ten biggest get a line, and the rest are
  one line "n andre: …". Claude's call: a tooltip must fit the chart.
- The tooltip stays inside the chart, as now. It works the same in full screen.
- The bars' buttons keep their accessible names (fixed expenses over time spec §5.4).
- The lines come from one exported function over the view's model. The chart only draws them.

## 5. Overdue in red

Thomas: "når en betaling er overskredet bliver den rød istedet for grå".

### 5.1 The Faste udgifter tab

- The status "Forfalden 30. okt" (D64) is red: the not-seen colours, `--hs-not-seen` on `--hs-not-seen-soft`. Its text
  keeps the date, since that table has no date column.
- "Ikke set" keeps the same red. They differ by their text. Claude's call: both say a payment is missing.
- "Forventes" stays grey.

### 5.2 The view's list

- **Forfalden** is red with a dashed border: red because it is overdue, dashed because it is still an estimate.
- **Ikke set** stays red with no border.
- The row's amount stays "ca. …" in italics. Claude's call: the row is an estimate in the grey of the others; only the
  status is red, so the amount does not read as paid.

### 5.3 The bars

A due estimate can lie in a unit that has ended, such as a monthly fixed expense due on 30 October and not paid by
4 November. Today it is hatched like every estimate, while the legend says "Skraveret: estimat efter i dag".

- A due estimate is drawn hatched in its part's colour, as now, **with a red outline** in `--hs-not-seen`. Claude's
  call: a red fill would lose the part's colour, and `PALETTE` has a red (`#e34948`) that a red hatch would be taken
  for. `--hs-not-seen` (`#b71c1c`) is darker.
- **The legend** says "Skraveret: estimat". When the drawn bars hold a due estimate, a red-outlined swatch follows with
  "Rød kant: forfalden". Claude's call: an estimate can lie before today, so "efter i dag" was not true.
- The tooltip marks the part " · forfalden" (§4).

## 6. Tests and checks

Made-up data only. Hard rule 5: behaviour through roles, accessible names and rendered text. The layout (§2.2, §3.3)
is checked in Chrome, not in tests.

- §2.1: in the normal card the rows have no object-group badge. The statuses read "Betalt", "Forventes", "Forfalden"
  and "Ikke set", with no date. A paid row's Dato is its posting's date. "Alt" by År still has its line with dates. The
  fixed expenses over time spec's status tests change with it.
- §3.1, §3.2: each card has a "Fuld skærm" button with `aria-pressed="false"`. A press on the bars' button shows the
  bars' region alone, with no payments region and no key numbers. The button reads `aria-pressed="true"`. A second
  press brings both cards and the key numbers back. The same for the list's button. A bar press in full screen
  chooses the unit, and the bars stay alone.
- §3.3: the list in full screen has the object-group badge on its rows.
- §3.4: `full=bars` and `full=list` round-trip with `view=fixed`. An unknown `full` reads as absent. `full` without
  `view=fixed` is ignored. Leaving the view drops it. A reload with `full=list` opens the list in full screen.
- §3.5: open, then `history.back()` closes full screen and stays in the view. Escape in full screen closes it, and a
  second Escape leaves the view. ← in full screen leaves the view. A unit chosen in full screen, then Escape, replaces,
  and Back then goes to the view's state before full screen.
- §3.7: while loading with `full=bars` there is one placeholder region and no key numbers.
- §4: unit tests of the tooltip function. A bar with paid only, a mixed bar, an estimates-only bar, a part with a due
  estimate, a refund, an empty bar, and eleven parts giving ten lines and "1 andre". The order is the stack's, top
  down. The total line keeps paid and estimates apart.
- §5.1: the tab's Fitnessabonnement row reads "Forfalden …" and carries the overdue mark in its accessible output
  (the status's text). Claude's call: the colour itself is checked in Chrome.
- §5.3: with a due estimate in the bars the legend has "Rød kant: forfalden"; without one it does not. The legend
  reads "Skraveret: estimat" when there are estimates.
- The Chrome check ([`testing.md`](../../testing.md#chrome-check)) at a page width of about 1200 px with a 256 px
  sidebar beside it (that is, a 1456 px window in Home Assistant's layout, or the fast loop at 1200 px), at 1440 and at
  1728 px:
  - the normal list fits with no sideways scroll, no badge and no cut status or sum;
  - each card's full screen, the list's badges in full screen, and the bars reaching the bottom edge;
  - the tooltip on a mixed bar at Alt forbrug and in a main group;
  - Forfalden red in the tab and in the list, and the red outline and legend line in the bars;
  - Back, Escape twice, and ← out of full screen.

## 7. Docs

Changed in the same PR:

- `addon/DOCS.md`: the view's full screen and its way out; the tooltip per part; Forfalden in red; the legend's red
  outline.
- `docs/domain-language.md`: the Full screen row gets the view's `full=bars|list` with D72. The Subscription status row
  notes that Forfalden is red with D72.
- `docs/testing.md`: the Chrome check gets §6's steps.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D72 below, and the status it changes.

## 8. Decisions

### D72: Full screen in the fixed-expenses view, one-word statuses, and Forfalden in red

- **Date:** 2026-11-04 · **Status:** active
- **Decision:**
  - Each of the fixed-expenses view's two cards can fill the page, as the overview's right card does; the hash has
    `full=bars|list` with `view=fixed`.
  - The view's payments list has no object-group badge in the normal card, and its status is one word (Betalt,
    Forventes, Forfalden, Ikke set), since its Dato column holds the date.
  - A bar's tooltip lists each part's paid and estimated sums.
  - Forfalden is red in the Faste udgifter tab and in the view's list. In the bars a due estimate has a red outline.
- **Why:** in a walkthrough the list was covered and cut off at a normal width, and Thomas missed room for the
  payments, the sums per part of a bar, and an overdue payment that stands out.
- **Source:** Thomas, 2026-11-04, [fixed view full screen spec](2026-11-04-fixed-view-full-screen.md) (in
  `decisions.md` the link is `superpowers/specs/…`). The hash key, the red outline, the tooltip's limit of ten parts
  and what gives way first are Claude's call.

| Decision | Status after this change |
| --- | --- |
| D20 | active; key list superseded by D35, D42, D44, D60, D61, D66 and D72 |
| D66 | active; the list's status texts superseded by D72 |
