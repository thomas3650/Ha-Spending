# Inactive bills with an end date – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [inactive ended bills spec](../specs/2026-11-05-inactive-ended-bills.md), in one PR that closes #183.

**Architecture:** the server only. `keepSubscriptions` changes its inactive rule; the two fake seeds each get one
inactive ended bill; the docs and D79 follow. No page code, no route, no option.

**Tech stack:** TypeScript, Vitest; the fake Firefly III in `addon/dev/`.

**Approved:** by Claude, 2026-11-05, after `reviewer` rated it Ready.

**Spec:** [`docs/superpowers/specs/2026-11-05-inactive-ended-bills.md`](../specs/2026-11-05-inactive-ended-bills.md).
Every task reads its sections there.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests through public interfaces (`keepSubscriptions`, `/api/data`), made-up data,
  English, comments only for why, docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass at every commit; `node scripts/check-links.mjs` in the
  repo root.
- An existing test changed on purpose is named in the report.
- Commits: Conventional Commits, `git commit -F <file>`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. The boundaries: an inactive bill's end date before today, today, after today, and before the range's start
   (Task 1, spec §2).
2. An active bill whose end date is after today is unchanged (Task 1).
3. Turning Gammel forsikring inactive in the example seed moves no count silently (Task 1).
4. The fast loop still shows both an inactive (Avisabonnement) and an active (Tidsskrift) ended bill (Task 1).
5. The docs no longer say every inactive bill is left out (Task 2).

The real Firefly III check is the integration test "gives the same subscriptions as the fake does for the same seed",
which runs in `scripts/integration` and the CI job `integration`, not in the local gates. It must pass in CI before the
merge.

---

## Task 1: Keep an inactive bill with an end date

Model: sonnet · Review: yes

**Spec:** §2, §3.

**Files:** modify `addon/server/src/firefly/subscriptions.ts` (`keepSubscriptions`, the `if (!a.active) continue;`
line), `addon/dev/src/generate.ts` (Avisabonnement), `addon/dev/src/example.ts` (Gammel forsikring); tests in
`addon/server/test/subscriptions.test.ts`, `addon/dev/test/generate.test.ts`, and any server test over the example
seed whose count moves; the comment in `addon/web/test/key-numbers.test.ts` (~520).

**Interfaces:** `keepSubscriptions(raw, mainGroupOf, excluded, today, rangeStart, warn)` keeps its signature. The rule:
an inactive bill is left out when `end_date` is null or after `today`; otherwise it falls through to the existing end
rule (`end < today && end < rangeStart` → left out).

- [ ] **Step 1: failing tests** in `subscriptions.test.ts`, replacing "leaves out an inactive bill, with or without an
  end date":
  - `keeps an inactive bill whose end date is before today and on or after the range's start, with that end`;
  - `keeps an inactive bill whose end date is today, with that end`;
  - `leaves out an inactive bill whose end date is before the range's start`;
  - `leaves out an inactive bill with no end date`;
  - `leaves out an inactive bill whose end date is after today`;
  - `keeps an active bill whose end date is after today, with that end`.
- [ ] **Step 2:** run `npm test --prefix addon -w server -- test/subscriptions.test.ts`; the keep cases fail.
- [ ] **Step 3:** change the rule in `keepSubscriptions`.
- [ ] **Step 4:** set `active: false` on Avisabonnement in `generate.ts` and on Gammel forsikring in `example.ts`.
  Add `active: false` to Avisabonnement's assertions in `generate.test.ts`. The kept-names list in
  `subscriptions.test.ts` (~75-86) already holds Gammel forsikring and stays exactly as it is: it now proves over
  `/api/data` that an inactive ended bill is kept, and goes red if the seed changes without the rule. Add to that test
  (or one beside it) `expect(named("Gammel forsikring")).toMatchObject({ end: "2026-10-29" })`. No other count should
  move; name any that does. Narrow the `key-numbers.test.ts` comment to an inactive bill without an end date.
- [ ] **Step 5:** the full gates pass; commit `fix: keep an inactive bill with an end date as an ended one`.

## Task 2: Docs and D79

Model: sonnet · Review: no

**Spec:** §3 (the #180 comment), §4, §5.

**Files:** `addon/DOCS.md` (~79), `docs/architecture.md` (~70), `docs/testing.md` (step 55), `docs/decisions.md` (D79
and D78's status, as spec §5 gives them; D79's link is `superpowers/specs/2026-11-05-inactive-ended-bills.md`).
`docs/README.md` already maps the spec and this plan.

- [ ] **Step 1:** make each change spec §4 lists, with the texts it gives.
- [ ] **Step 2:** comment on #180 with spec §3's text (`gh issue comment 180`).
- [ ] **Step 3:** `node scripts/check-links.mjs` and the addon gates pass; commit `docs: inactive bills with an end
  date`.
