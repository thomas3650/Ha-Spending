# The filter panel's categories by main group – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [filter categories spec](../specs/2026-11-03-filter-categories.md), in one PR that closes #106.

**Architecture:** the page only. `FilterPicker.panel()` in `addon/web/src/screens/all-postings.ts` groups the shown
categories by main group and renders one named group per main group inside the "Kategorier" group. No change to the
state, the hash, the events, the server or the shared types. No new `da` key or dependency.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-03-filter-categories.md`](../specs/2026-11-03-filter-categories.md). The task
reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- The fixture (`addon/web/test/fixture.ts`) is not changed. Its categories already cover three main groups and one
  category with no main group ("Gaver").
- Commits: Conventional Commits, `git commit -F <file>`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **"Uden hovedgruppe" last,** after the named main groups, and "Uden kategori" after it, outside every main group.
2. **The search** leaves out a main group with no category that fits, heading and all.
3. **Unique heading ids:** each main group's heading id is unique in the panel, also for "Uden hovedgruppe" and names
   with spaces or Danish letters.

---

## Task 1: Categories under their main group

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/screens/all-postings.ts` (`FilterPicker.panel()` and its styles); tests in
`addon/web/test/all-postings.test.ts`.

**Spec:** §1 to §4.

- [ ] Write the failing tests (spec §4) in `all-postings.test.ts`, next to "adds a category, and Uden kategori, through
  + Filter", using `openFilter`. With the fixture: the "Kategorier" group holds the groups "Bil" (Brændstof), "Bolig"
  (Husleje), "Mad" (Café, Dagligvarer) and "Uden hovedgruppe" (Gaver), in that order, read with `getAllByRole(…,
  "group")` inside it; "Uden kategori" is a button in "Kategorier" but in none of those groups. Searching "caf" shows
  only the "Mad" group, holding only Café. With the `CAFE` hash, "Café" in the "Mad" group has `aria-pressed="true"`
  and "Dagligvarer" `"false"`.
- [ ] Run `npm test --prefix addon -- all-postings` and see them fail.
- [ ] In `panel()`, for each key of `[...data.mainGroups, null]`, take the shown categories whose `mainGroup` is that
  key; skip the key when there are none. Render each as `<div role="group" aria-labelledby=…>` with an `h4` holding
  `partName(key, "mainGroup")`. The heading id is `hs-filter-category-group-${index}`, by the key's index in that
  list, so it is unique whatever the name. Keep `this.option(...)` for each category, unchanged.
- [ ] Style (spec §1): the `h4` at 11px, `font-weight: 600`, in the normal text colour (not `--hs-muted`), margin
  `6px 16px 2px`; the part `h3` stays as it is. The category buttons inside a main group get `padding-left` 12px more
  than `.dd-option`'s own. The nested groups get no border line (the `[role="group"] + [role="group"]` rule
  must only apply to the parts, so scope it to the panel's direct children: `.filter-menu > [role="group"] + [role="group"]`).
- [ ] Run the tests and see them pass, then the gates.
- [ ] Add step 45 to the Chrome check in `docs/testing.md`, after step 44: `59-filter-kategorier`, at 1440, 1728 and
  420 px: the panel open and scrolled to the middle of Kategorier, where the two heading levels can be told apart; a
  search for "caf"; "Uden hovedgruppe" last, then "Uden kategori" outside every group; Tab through the groups.
- [ ] Commit: `feat: the filter panel lists the categories under their main group`.
