# Fixes from the first test of 0.1.0 – design

**Real Home Assistant:** no change there from this work. The fixes reach the house with the next release, through the
house session ([`releasing.md`](../../releasing.md#after-a-release)).

**Issues:** #21, #22, #23, #24, #25, found in the first test of 0.1.0 at 1525 px and 420 px wide. Thomas runs Home
Assistant full screen on a Mac, so wide widths matter as much as the mockups' 1440 px.

This spec changes the [UI and UX spec](2026-10-30-ui-ux-design.md) where it says so. Everything else there holds.

## 1. The page fills the panel (#21)

The page has no maximum width. The cards, the circle, the bars and the postings table grow with the panel. This is
what the UI spec's "fills the panel" asks; the 1360 px cap went against it. D24's breakpoints hold.

## 2. Every field opens from anywhere on it (#22)

A click anywhere on a field opens it: on its value, its caption, its padding or its ▾. This holds for the native
selects "Gruppér pr." and "Sortér" as it already does for the buttons "Periode" and "Konti". The selects stay native:
the select covers the whole field, and the caption and the ▾ let clicks through. All four fields are the same height.

## 3. The fields keep their width (#23)

- Each field has a fixed width, so the toolbar does not move when a value changes:
  - "Periode" 360 px. Its longest preset, "Sidste 12 måneder · 1. okt 2025 – 30. sep 2026", takes 304 px of the
    312 px it has, measured in Chrome on the Mac in the page's font.
  - "Gruppér pr.", "Konti" and "Sortér" 200 px. The selects' longest option ("Mindste først") fits, so a
    select never needs to cut its value.
- A value that does not fit, such as a custom period in a wider font, is cut with an ellipsis. The field's accessible
  name keeps the whole value.
- On a narrow screen a field is never wider than the space it has: the field, its dropdown and its place in the
  toolbar are all capped at 100 %.
- **Changes the UI spec** (§ "The top card", Konti: "or the chosen names"): the closed "Konti" field with some
  accounts ticked shows a count, "4 af 5 konti", not the names. With every known account ticked it shows
  "Alle konti (5)", whether the hash names no accounts or all of them; with none, "Ingen konti". The names are in the
  open panel. [D26](../../decisions.md).

## 4. A category's name selects it (#24)

In a main group, a click on a category's name or amount beside the circle selects the category, as a click on its
slice does, and as a name does on the top level.

The fast loop could not make this fail. In Chrome at 1525 px and at the pane's 800 px, clicks on a name and on an
amount line inside a main group select and unselect the category, also on a faded label while another is chosen. The
labels' hit areas do not depend on §5. So the PR refers to #24 without closing it; Thomas re-tests it in Home
Assistant after the release, and the issue says what to look for.

## 5. A wrapped name keeps its amount below it (#25)

A label in the circle is the name, then the amount and share on the line or lines below it, also when the name wraps.

- **The cause** is in ECharts' text layout (zrender 6.1.0, `parseText.js`). When a label is wrapped to fit, a newline
  that stands alone between the name's and the amount's text styles is dropped, so the amount runs on from the name's
  last line. The newline goes inside the amount's text instead, which survives the wrapping.
- **Narrow screens:** with the amount on its own lines, labels are taller. Below 600 px the left side of the ring
  holds about ten labels of three or four lines, which do not fit in 340 px, so ECharts overlaps them. Below 600 px the
  circle is 480 px high.

## 6. Tests and checks

- §3's count and §5's line layout get unit tests: the closed Konti text, including a full list of accounts, and the
  circle's label laid out by zrender's own text parser, wrapped and unwrapped. happy-dom cannot draw ECharts' text, so
  zrender's parser is the nearest public layout there is; `zrender` becomes a dev dependency of `addon/web` at the
  version ECharts pins.
- §1, §2 and §3's widths are CSS. They are checked in the Chrome check, not by tests (`CLAUDE.md` hard rule 5): at
  1440×960, 1525, 1728 (full screen) and 420 px, with `elementFromPoint` on each select field's ▾, caption and
  padding. Screenshots in `screenshots/2026-10-31-first-test-fixes/`.
