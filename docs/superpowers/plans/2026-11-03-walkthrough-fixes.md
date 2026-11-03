# Small fixes from the 0.11.0 walkthrough – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [walkthrough fixes spec](../specs/2026-11-03-walkthrough-fixes.md), in one PR that closes #102, #109,
#110, #111, #112, #113 and #114 and refers to #103.

**Architecture:** the page, plus one function moved into `addon/shared`. No server change, no new route, option, hash
key or dependency.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts behind the chart mock.

**Spec:** [`docs/superpowers/specs/2026-11-03-walkthrough-fixes.md`](../specs/2026-11-03-walkthrough-fixes.md). Every
task reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- The fixture (`addon/web/test/fixture.ts`) is not changed. A test that needs other postings passes them through
  `mount`'s `answer` option, or calls the model function directly with made-up postings.
- Tests do not read the chart's options (D19); the tooltip's text is tested through the function that writes it.
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **Alle posteringer stays reachable:** in full screen through "Vis alle", with the search; in the normal card through
   the key numbers' links (Task 1).
2. **Tab** is only taken while the list is open; it never traps the focus, and Shift+Tab is untouched (Task 3).
3. **The suggestion limit** applies after the new order (Task 3).
4. **The head at 420 px and in full screen:** the full-screen button never on a row of its own (Task 2).

---

## Task 1: "Vis alle" only in full screen

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/screens/overview.ts` (`postings()`: render the button only when `this.fullScreen`);
tests in `addon/web/test/overview.test.ts`, `postings.test.ts`, `subscriptions.test.ts`, `full-screen.test.ts`,
`detail-history.test.ts`, and any other test that clicks or queries `da.showAll` on the right card (`grep -rn showAll
addon/web/test`; `detail.test.ts` and `shops.test.ts` mean other buttons and stay).

**Spec:** §1.

- [ ] Write the failing test in `overview.test.ts`: on `card=postings`, no button named `da.showAll` in the right card;
  with full screen on, the button is there.
- [ ] Run it and see it fail.
- [ ] Render the button only in full screen. Keep `hs-search` in the row so the field keeps its focus while typing.
  The event, `openAllPostings`, its handler and `da.showAll` stay.
- [ ] For each test that pressed "Vis alle" in the normal card: turn full screen on first when the test checks what
  "Vis alle" carries (the search, the card's filters); otherwise use the key number's link. Tests already in full
  screen (`full-screen.test.ts`, the full-screen row of `detail-history.test.ts`) stay. List each changed test in the
  report.
- [ ] Tests and gates pass. Commit: `fix: Vis alle shows only in full screen`.

## Task 2: The key-number ring and the full-screen button

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/key-numbers.ts` (styles), `addon/web/src/screens/overview.ts` (the right
card's head markup and styles).

**Spec:** §2, §3.

- [ ] §2: drop the `.kpi-group:has(.kpi-toggle[aria-pressed="true"])` rule. Keep the hover and focus rules.
- [ ] §3: make the head a grid with the title, the switch and the button. Wide: one row, `title switch button`. When the
  card is too narrow for that, two rows: `title button` over `switch switch`. Use a container query on the right card
  (`container-type: inline-size` on `.half`), not a viewport media query, since the card's width depends on full
  screen. Give `.card-tools` `display: contents` so the switch and the button are grid items of the head, or move the
  button out of it; say which in the report. Remove the `wraps` class toggle on `.half-head` and the
  `.half-head.wraps` rules and their comment, which the grid replaces. Pick the breakpoint by measuring in the fast loop where the switch with all five buttons (Forskel kept)
  stops fitting beside a 10em title; say the value in the report.
- [ ] The existing tests pass unchanged (the DOM order of title, switch and button may stay as it is).
- [ ] Check in the fast loop (`scripts/develop`) at 1440, 1728 and 420 px, normal and full screen, on Søjler,
  Posteringer and Faste udgifter: the button is always on the title's row, at the right edge.
- [ ] Gates pass. Commit: `fix: the full-screen button sits on the title's row, and a chosen key number has no ring`.

## Task 3: The shop search: chip row, Tab and order

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/search.ts`, `addon/web/src/model/filter.ts` (`shopSuggestions`); tests in
`addon/web/test/search.test.ts`, `addon/web/test/filter.test.ts`.

**Spec:** §4, §5, §6.

- [ ] Write the failing tests (spec §9 for §5 and §6). For §6 call `shopSuggestions` with made-up postings, for example
  shops "Havesol" (largest sum), "Solbær Café", "Parasol & Co" and "Solo Kiosk", searched with "sol": the order is
  "Solbær Café", "Solo Kiosk" by sum, then "Havesol", "Parasol & Co" by sum. Add a case with more matching shops than
  the limit where the only starting name has the smallest sum: it is still listed, first.
- [ ] Run them and see them fail.
- [ ] §6: sort by (starts with the folded text ? 0 : 1), then sum descending, then name; slice after.
- [ ] §5: in `onKeyDown`, `case "Tab"`: when the list is open and Shift is not held, `preventDefault()` and choose
  `suggestions[active]`, or `suggestions[0]` when `active` is -1. Otherwise return without touching the event.
- [ ] §4: render the chip after the input, in a row that takes the full width (`flex-basis: 100%`), and keep the input
  on its own row. The suggestion list keeps its position under the field.
- [ ] Tests and gates pass. Commit: `fix: the shop search chooses with Tab, lists starting names first and puts the chip under the field`.

## Task 4: The day tooltip, and `isRunning` and the running opacity in one place

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/bars.ts`, `addon/web/src/components/detail.ts` (styles),
`addon/web/src/model/circle.ts`, `addon/web/src/model/detail.ts`, `addon/web/src/theme.ts`,
`addon/shared/src/units.ts`; tests in `addon/web/test/bars.test.ts`, `addon/shared/test/` (the units tests).

**Spec:** §7, §8.

- [ ] Write the failing tests: an exported `barTooltip(item: BarItem): string` in `bars.ts` gives name, range and
  amount for a whole month item and for a month item clipped to one day (`start === end`, `fullStart !== fullEnd`), and
  name and amount for a day item (`fullStart === fullEnd`), lines joined by `<br>`, each escaped as today. In the shared units tests, `isRunning` for a partial unit started by today (true), a partial
  unit after today (false) and a whole unit (false).
- [ ] Run them and see them fail.
- [ ] §7: move the formatter's text into `barTooltip`, used by the formatter.
- [ ] §8: move `isRunning` to `shared/src/units.ts`; import it from `@ha-spending/shared` in `bars.ts`,
  `model/circle.ts` and `model/detail.ts`. Add `--hs-running-opacity: 0.5` to the theme tokens in `theme.ts`, read it in
  `bars.ts` where `RUNNING` is used (as `Number(token("--hs-running-opacity"))`, with no fallback, as the other tokens
  it reads), and use `opacity: var(--hs-running-opacity)` in `.detail-bar.running`.
- [ ] Tests and gates pass. Commit: `refactor: isRunning lives with the units, the running opacity is one token, and a day's tooltip says its date once`.

## Task 5: Docs

Model: haiku · Review: no

**Files:** modify `docs/decisions.md`, `docs/testing.md`, `docs/README.md`.

- [ ] `docs/decisions.md`: add D52, "Vis alle only in full screen", in the log's format: in the normal right card,
  Posteringer has no "Vis alle" and Alle posteringer is reached from the key numbers' links; in full screen, where the
  key numbers are not shown, "Vis alle" stays and keeps the search (D31, D35 unchanged). Why: Thomas found the button
  unneeded beside the key number's link in the 0.11.0 walkthrough; full screen has no other way in. Source: Thomas,
  2026-11-03, and the walkthrough fixes spec §1.
- [ ] `docs/testing.md`: step 20 (`33-posteringer-soeg`) has "Vis alle" on the search row in full screen only; step 23
  (`37-butik-forslag`) says names starting with the text come first, then by sum; step 24 (`38-butik-valgt`) has the
  chip under the field; step 25 (`39-fuld-skaerm`) has the button on the title's row. Add step 46,
  `60-gennemgang-rettelser`, at 1440, 1728 and 420 px, normal and full screen: the full-screen button on the title's
  row on Søjler, Posteringer and Faste udgifter; "Vis alle" in full screen only; no ring on the chosen key-number card; a chosen shop's chip under the
  search field; Tab in the suggestions chooses the first; a day bar's tooltip names its date once.
- [ ] `docs/README.md`: add the spec and the plan to the map rows, as "walkthrough fixes".
- [ ] `node scripts/check-links.mjs` passes. Commit: `docs: the walkthrough fixes in the decision log and the Chrome check`.
