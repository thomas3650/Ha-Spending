# Fixes from the first test of 0.1.0 – implementation plan

**Goal:** the five fixes of the [first-test fixes spec](../specs/2026-10-31-first-test-fixes.md), in one PR that
closes #21, #22, #23 and #25 and refers to #24.

**Architecture:** CSS in `addon/web/src/theme.ts`, `addon/web/src/app.ts`, `components/top-card.ts`,
`components/dropdown.ts` and `components/circle.ts`; the Konti text in `components/accounts-picker.ts` and
`i18n/da.ts`; the circle's label in `components/circle.ts`. Nothing on the server or in shared.

**Ruling (Claude):** the tasks are small, touch few files and were found while reproducing the issues, so the
controller builds them itself, test-first, instead of one subagent per task. `reviewer` reviews the spec and plan,
then the whole branch, which covers every `Review: yes` task.

## Task 1: the wrapped label (#25)

Model: opus · Review: yes

- Test first in `addon/web/test/circle.test.ts`: a name that wraps, laid out by zrender's `parseRichText` at 110 px
  with `overflow: "break"`, has only name lines before the first amount line and only amount lines after it; the same
  holds unwrapped. `zrender` 6.1.0 is a dev dependency of `addon/web`.
- `labelText` is exported and puts the newline inside the `sub` token, with a comment on why.
- Below 600 px the circle's chart is 480 px high.

## Task 2: the label click (#24)

Model: opus · Review: yes

- After Task 1, the Chrome check clicks a name and an amount line inside a main group, at 1525 px and at the pane's
  width, also on a faded label.
- If a click fails, the cause is found and fixed with a test. If none fails, the PR says `Refs #24`, and a comment on
  #24 asks for a re-test in Home Assistant after the release.

## Task 3: the Konti count (#23)

Model: sonnet · Review: yes

- Test first: `accountsClosedText` gives "4 af 5 konti" (`da.someAccounts`) for 4 of 5; "Alle konti (5)" for `null`
  and for a full list; "Ingen konti" for none. `frame.test.ts`'s check of the closed field changes to the count.
- `decisions.md` gets D26.

## Task 4: the fields and the width (#21, #22, #23)

Model: sonnet · Review: yes

- `.page` loses `max-width`.
- `.field` is `var(--hs-field-width, 200px)` wide, 360 px for Periode, `max-width: 100%`, and its value an ellipsis.
  `.dd`, `.top-filters` and its children get `max-width: 100%` and `min-width: 0`.
- A field holding a select: the select covers the whole field with the padding inside it; the caption and the `::after`
  ▾ have `pointer-events: none`. The field is as high as a button field.

## Task 5: check and PR

Model: opus · Review: no

- Both gate lines. The Chrome check at 1440×960, 1525, 1728 and 420 px. `elementFromPoint` at each select field's ▾,
  caption and padding returns the `select`.
- `reviewer` on the branch. PR `fix: the page fills the screen, and the fields and circle labels behave`, with
  `Closes #21`, `Closes #22`, `Closes #23`, `Closes #25` and `Refs #24`.
