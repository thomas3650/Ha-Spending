# Small fixes from the 2026-11-04 walkthrough – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [small walkthrough fixes spec](../specs/2026-11-04-walkthrough-small-fixes.md), in one PR that closes
#142, #144, #146, #147, #148, #149 and #151.

**Architecture:** the page, plus the status and amount rules in `addon/shared`. No server change, no new route, option,
hash key or dependency.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts behind the chart mock.

**Spec:** [`docs/superpowers/specs/2026-11-04-walkthrough-small-fixes.md`](../specs/2026-11-04-walkthrough-small-fixes.md).
Every task reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- Another branch (`feat/top-filter`, #153) changes `app.ts`, `components/top-card.ts`, `components/period-picker.ts`,
  `state/view.ts`, `state/actions.ts`, `components/postings.ts`, `components/search.ts`, `components/key-numbers.ts`,
  `screens/*` and much of `da.ts`. Stay out of those files; in `da.ts` change only the lines named here.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- The fixture (`addon/web/test/fixture.ts`) is not changed. A test that needs other subscriptions or postings passes
  them through `mount`'s `answer` option, or calls the model function directly.
- Tests do not read the chart's options (D19).
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **The rise rule is in one place:** `subscriptionStatus` and `amountPerPayment` use one predicate; the status carries
   the amounts the text shows; no øre left in the step's text (Task 1).
2. **Forfalden** only for a date strictly before today; the status kind and order unchanged (Task 2).
3. **"< 1 %"** only when the amount is not 0; shops and the circle read the same (Task 3).

---

## Task 1: A rise counts from 1 kr., and Beløb shows what is paid now

Model: sonnet · Review: yes

**Files:** modify `addon/shared/src/subscriptions.ts`, `addon/web/src/format.ts` (`stepAmounts`),
`addon/web/src/i18n/da.ts` (`subscriptionsFoot` only); tests in `addon/shared/test/subscriptions.test.ts`,
`addon/web/test/format.test.ts`, `addon/web/test/subscriptions.test.ts`, `addon/web/test/da.test.ts`, and any test
that breaks on the new amounts (`detail.test.ts`, `key-numbers.test.ts`, `addon/server/test/read.test.ts`: check with
`npm test`). Tests that change on purpose: the øre cases of `stepAmounts` in `format.test.ts` and the øre Steget
example in `da.test.ts`; list every other changed test in the report.

**Spec:** §1.

- [ ] Write the failing tests. Shared: a payment 50 øre and 99 øre above the max is no rise (the status is the next
  that holds); exactly 100 øre above is a rise; `amountPerPayment` is P's amount when risen, the middle otherwise;
  `amountPerYear` follows it; next to "lets notSeen win over risen", a subscription with a rise of 1 kr. or more whose
  status is notSeen still has P's amount per payment. Format: `stepAmounts` gives whole kroner for every input,
  for example 9900 and 10060 → "99" and "101". Page: the Streaming row's Beløb, Om året and status follow the new rule; the foot has the new text.
- [ ] Run them and see them fail.
- [ ] In `shared/src/subscriptions.ts`: one constant for the threshold (100 øre, exported only if a test needs it)
  and one predicate, `risen(s)`, used by both `amountPerPayment` and `subscriptionStatus`. The status keeps carrying `max` and `paid` in
  øre.
- [ ] `stepAmounts` formats both in whole kroner, with no øre branch; update its doc comment.
- [ ] `da.subscriptionsFoot` gets the spec's text.
- [ ] Tests and gates pass. Commit: `fix: a fixed expense has risen only from 1 kr., and its amount is what is paid now`.

## Task 2: A due payment says "Forfalden"

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/model/subscriptions.ts` (`statusText`, the row's `next`), `addon/dev/src/generate.ts`, `addon/web/src/i18n/da.ts`
(one line in the `status` block); tests in `addon/web/test/subscriptions.test.ts`, `addon/web/test/detail.test.ts` if
the detail view's status is checked there.

**Spec:** §5.

- [ ] Write the failing tests through the rendered table: a subscription whose next date is 2 days before the answer's
  today and with no payment since reads "Forfalden {date}" and its name cell has no "næste"; one due today reads
  "Forventes {date}" and keeps "næste {date}".
- [ ] Run them and see them fail.
- [ ] In `addon/dev/src/generate.ts`, add a `recurring` monthly fixed expense whose last payment is `soon(-2)`
  (one month and 2 days before today) and inside its amount range, so its next date is 2 days before today (a Forfalden row in the fast loop), with its test in
  `addon/dev/test/generate.test.ts` if that file checks the statuses.
- [ ] `da.status.due(date)` gives "Forfalden {date}". `statusText` uses it for `expected` with a date before `today`.
  The row's `next` is null for such a row, as for `notSeen`. Keep the date rule in one helper used by both.
- [ ] Tests and gates pass. Commit: `fix: a due fixed expense says Forfalden, not Forventes with a past date`.

## Task 3: A share above zero never reads 0 %

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/format.ts` (`percent`), `addon/web/src/model/shops.ts` (`ShopRow.share` as a fraction),
`addon/web/src/components/shops.ts` (use `percent`), `addon/web/src/i18n/da.ts` (remove `share` if nothing else uses
it); tests in `addon/web/test/format.test.ts`, `addon/web/test/shops.test.ts`, `addon/web/test/circle.test.ts`. Tests
that change on purpose: those in `shops.test.ts` that build the expected share with `da.share(...)`; they build it
with `percent(...)` instead.

**Spec:** §7.

- [ ] Write the failing tests: `percent(0.001)` and `percent(-0.001)` read "< 1 %" (with the same no-break spaces as
  "69 %"); `percent(0)` reads "0 %"; `percent(0.005)` reads "1 %". A shop with 200 kr. of 120.000 kr. shows "< 1 %" in
  the Butikker list; a shop in a base whose total is not above zero (refunds outweigh spending) shows no share; and a
  circle part with a tiny share has "< 1 %" in its button's name.
- [ ] Run them and see them fail.
- [ ] Implement. `ShopRow.share` is a fraction, or null when the base's total is not above zero; update its doc
  comment.
- [ ] Tests and gates pass. Commit: `fix: a share above zero reads < 1 %, not 0 %`.

## Task 4: The Faste udgifter table: the group header and the repeat line

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/subscriptions.ts`, `addon/web/src/model/subscriptions.ts` (the row gets the
amount and the repeat apart); tests in `addon/web/test/subscriptions.test.ts`.

**Spec:** §2, §6.

- [ ] Write the failing test for §6: in a grouped table, with and without Kategori, the group's row has one row header
  (the name and the count) and two cells after it (Om året and the empty Status).
- [ ] Run it and see it fail.
- [ ] §6: the group's `th` gets `colspan` over the columns before Om året; drop the empty `td`s it covers.
- [ ] §2: `SubscriptionRow` has `amount` ("8.000 kr.") and `repeat` ("pr. måned") apart; the cell renders them as two
  block lines, the second styled as `.subscription-next`, with whitespace between the two spans in the template, so
  the cell's text still reads "8.000 kr. pr. måned" and the existing cell tests hold. `paymentText` stays for the
  detail view. Update the doc comments on `paymentText` and on the row's `amount` field.
- [ ] Tests and gates pass. Commit: `fix: the fixed-expense table keeps a group's count on its line and the repeat on its own line`.

## Task 5: The shop tracks and the circle's labels

Model: sonnet · Review: no

**Files:** modify `addon/web/src/components/shops.ts` (styles, and a class on the lists when hiding is allowed),
`addon/web/src/components/circle.ts` (the series' label and label-line options).

**Spec:** §3, §4.

- [ ] §4: the sum column a fixed width for "1.234.567 kr."; the share column a fixed width for "100 %" and "< 1 %";
  the hide column a fixed width for "Skjul", only on lists that can hide. The 480 px layout keeps its bar on its own row.
- [ ] §3: longer `labelLine.length` and `length2` and a larger `minMargin`, so the small pieces' labels have room;
  keep the ring inside the label room (`LABEL_ROOM`, `ringRadius`), changing it with its tests if the lines need more.
- [ ] Check both in the fast loop at 1440 and 1728 px, normal and full screen. Say the widths and values in the report.
- [ ] Existing tests and gates pass. Commit: `fix: the shop tracks end at one place, and small pieces' labels get room`.

## Task 6: Docs

Model: haiku · Review: no

**Files:** modify `docs/decisions.md`, `docs/testing.md`, `docs/README.md`, `docs/domain-language.md`,
`addon/DOCS.md` (one sentence only: #153 edits it too).

- [ ] `docs/decisions.md`: add, in the log's format, with source "Claude, 2026-11-04, under the controller session's
  brief, and the small walkthrough fixes spec §n":
  - D63, "A fixed expense has risen from 1 kr., and its amount is the latest payment": spec §1. Why: a rise of a few
    øre showed as a whole krone, or needed øre, and the Beløb column disagreed with the status. It changes
    subscriptions spec §1.2, §2.1 and §2.3, and supersedes UI polish spec §5.4.
  - D64, "A due payment says Forfalden": spec §5. Why: "Forventes" with a past date read like a mistake. It changes
    subscriptions spec §2.3 and UI polish spec §5.5.
  - D65, "A share above zero reads < 1 %": spec §7. Why: "0 %" beside a real amount read as nothing. It changes
    top-shops spec §2.
- [ ] `docs/domain-language.md`: the amount per payment is the middle of the range, or the latest payment when it has
  risen (D63); the amount and status rows also link D63 and D64.
- [ ] `addon/DOCS.md`: the sentence on a subscription without a payment says it reads "Forfalden" for a few days after
  a due date, and "Forventes" while its start is in the future, then "Ikke set".
- [ ] `docs/testing.md`: add the next step at the end of the screens and states, `63-smaa-rettelser` (its number and
  screen name are taken again at the merge with `main`, if #153 has added steps first), at 1440 and
  1728 px, normal and full screen, linking the spec: Faste udgifter with a Steget row in whole kroner and its Beløb, a
  Forfalden row with no "næste", the repeat on its own line in every row, a long group name with its count on one
  line; Butikker with the tracks ending at one place, shown and hidden lists; the circle's small labels apart; a
  "< 1 %" share.
- [ ] `docs/README.md`: add the spec and the plan to the map rows, as "small walkthrough fixes". #153 appends to the
  same rows; whichever merges second resolves the conflict, keeping both.
- [ ] `node scripts/check-links.mjs` passes. Commit: `docs: the small walkthrough fixes in the decision log and the Chrome check`.
