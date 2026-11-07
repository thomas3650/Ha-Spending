# The date in the status in full screen – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [full-screen status dates spec](../specs/2026-11-07-full-screen-status-dates.md), in one PR that closes
#189.

**Architecture:** the page only. The list's row model (`fixedList` in `addon/web/src/model/fixed-list.ts`) writes a
dated status text when `opts.full` is set, from the existing `da.status` texts. The component renders `status.text`
as today. No server, route or option.

**Tech stack:** TypeScript, Lit, Vitest.

**Approved:** by Claude, 2026-11-07, after `reviewer` rated it Ready.

**Spec:** [`docs/superpowers/specs/2026-11-07-full-screen-status-dates.md`](../specs/2026-11-07-full-screen-status-dates.md).
Every task reads its sections there.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests through public interfaces (the row model `fixedList`), made-up data, English,
  comments only for why, docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass at every commit; `node scripts/check-links.mjs` in the
  repo root.
- An existing test changed on purpose is named in the report.
- Commits: Conventional Commits, `git commit -F <file>`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. The four kinds in full screen, and that the normal card is unchanged (spec §2).
2. The date in the pill is the row's Dato, the year included outside the current year.

## Task 1: the dated status in full screen

**Model:** sonnet · **Review:** yes

**Files:** `addon/web/src/model/fixed-list.ts`, `addon/web/src/i18n/da.ts`, `addon/web/test/fixed-model.test.ts`.

1. Write a failing test in the "the view's list" block of `fixed-model.test.ts`: with `{ full: true, oneGroup: true }`
   on the existing made-up data (the paid, estimate and not-seen rows from `viewOf(FIXED)`: the July rows and the
   December estimate; the due row from its own view, `viewOf(FIXED, linked([due]))` as in "names a due estimate
   forfalden", since `FIXED` alone has no due estimate), each row's `status.text` is `da.status.paid(date)`, `da.status.expected(date)`,
   `da.status.due(date)` and `da.status.notSeen(date)` with the row's `date`, and one checked as literal text too
   (such as `"Forventes 1. dec"`). Add a row dated outside the current year (`period=lastYear&${FIXED}`, whose paid
   row is in last year): its `date` is the literal `"1. dec 2025"` and its pill the literal `"Betalt 1. dec 2025"`, so
   the year check does not lean on `shortDate` alone. A year unit (`period=all` by År, as in
   "gives Alt by År one row per fixed expense") with `full: true` keeps `status: null`. In the normal card the same
   rows keep the one word.
2. Run it; it fails.
3. In `paymentRows`, pass `opts.full` and the row's date to the status text: in full screen `statusText` returns the
   `da.status` text for the kind (`due` → `da.status.due`), else the one word as today. In
   `addon/web/src/i18n/da.ts` the comment on `da.fixed.status` says the one word is the normal card's, and full screen
   uses `da.status` (spec §4).
4. Run the tests, lint and build; they pass. Commit `feat: the date in the fixed list's status in full screen`.

## Task 2: the docs

**Model:** sonnet · **Review:** no

**Files:** `addon/DOCS.md`, `docs/decisions.md`, `docs/domain-language.md`, `docs/testing.md`, `docs/README.md`.

1. `addon/DOCS.md` around line 112: the status is one word in the normal card, and in full screen it names its date
   ("Forventes 2. dec").
2. `docs/decisions.md`: add D81 in the log's format, with `**Date:** 2026-11-07 · **Status:** active` and the
   Decision, Why and Source of spec §5, linking the spec. Set D77's status to `active; "Forfalden is red in the Faste udgifter tab" superseded by D78 (the tab is in the
   view); the one-word status in full screen superseded by D81`.
3. `docs/domain-language.md`, the Subscription status row: the clause of spec §4, linking D77 and D81.
4. `docs/testing.md` step 54: the text of spec §4 (the four dated statuses in full screen, one word in the normal
   card, the step's widths with "Sidste år" for the longest dated status the fast loop shows there, named as it reads,
   nothing cut), linking the spec and D81.
5. `docs/README.md`: add the spec and the plan to the two lists.
6. Run `node scripts/check-links.mjs`; it passes. Commit `docs: the dated status in the fixed list's full screen`.
