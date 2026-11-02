# A link from each object group's key number to its postings – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [object-group postings spec](../specs/2026-11-02-object-group-postings.md), in one PR that closes #71.

**Architecture:** the page only. `ViewState` gains `objectGroup`, a filter of Alle posteringer in the hash as `og`. It
joins `searchBase`, gets a chip and a group in "+ Filter". Each object group's key number becomes a card group that
holds today's toggle button and, after it, a link built from a new action.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-02-object-group-postings.md`](../specs/2026-11-02-object-group-postings.md).
Every task reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 7: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- No change to `addon/server`, `addon/dev` or the answer's shape. No object-group title in `addon/web/src` (D38).
- Names, exactly:
  - `ViewState.objectGroup: string | null`, default null; hash key `og`, after `max`, Alle posteringer only.
  - `openObjectGroupPostings(s: ViewState, title: string): ViewState` in `state/actions.ts`: `openAllPostingsFresh`,
    then `withoutUnit`, then `objectGroup: title` (amount null, sort default come from `openAllPostings`).
  - `setObjectGroup(s: ViewState, title: string | null): ViewState` in `state/actions.ts`.
  - `KeyCard.postings` stays `{ count: number; href: string }`; `objectGroupCards(ctx, hrefOf: (title: string) =>
    string)` sets it on each object group's card.
  - Events from Alle posteringer: `set-object-group` (detail `string | null`), fired by the "+ Filter" option and by
    the chip's ✕ (null).

## Review focus

1. **A search, a shop and a chosen unit before the link:** after the click the summary count equals the link's count.
   Test in Task 2.
2. **A unit chosen with Forskel open:** the link's hash has no `card=difference`. Test in Task 2.
3. **An unknown `og=`:** `da.noMatch` and the chip; "+ Filter" shows the group with that one option. Test in Task 1.
4. **A period change on Alle posteringer:** `og` stays. Test in Task 1.
5. **The toggle's accessible name** is unchanged, and the link is not inside the button. Test in Task 2.

---

## Task 1: The object group as a filter of Alle posteringer

Model: opus · Review: yes

**Files:** `addon/web/src/state/view.ts`, `state/actions.ts`, `model/filter.ts`, `screens/all-postings.ts`, `app.ts`
(no new `da` text: `da.subscriptions`, `da.remove` and `da.noMatch` exist); tests `addon/web/test/view.test.ts`,
`actions.test.ts`, `all-postings.test.ts`.

**Produces:** `objectGroup`, `og`, `setObjectGroup` and `set-object-group` from the names above; spec §2 and §3.
`openObjectGroupPostings` belongs to Task 2.
- `parseHash` reads `og` only on Alle posteringer; an empty value is null. `toHash` writes it after `max` on Alle
  posteringer when not null.
- `openAllPostings` and `trailLevel` set `objectGroup: null`, as they reset the amount.
- `searchBase(ctx)` also keeps only postings whose `subscription?.objectGroup` is `ctx.state.objectGroup` when that is
  not null. `normalise` leaves `objectGroup` alone.
- The chip (`da.remove(title)` for its ✕, as the other chips) after the amount chip, firing `set-object-group` with
  null.
- "+ Filter": a group headed `da.subscriptions` ("Faste udgifter") with one option per object group on `searchBase`
  computed without the object group, ordered by `localeCompare(…, "da")`, the chosen one pressed and listed even when
  absent; left out when the list is empty and none is chosen.
- `app.ts` handles `set-object-group` with `setObjectGroup` and a push.
- The doc comments that list the events of `FilterPicker` and `AllPostings` (`screens/all-postings.ts`) name
  `set-object-group`.

- [ ] **Step 1: Write the failing tests:** `view.test.ts`: `"round-trips og on Alle posteringer"`, `"an empty og is
  none"`, `"og is dropped on the overview"`. `actions.test.ts`: `"opening Alle posteringer and the trail clear the
  object group"`. `all-postings.test.ts`, each with its own start hash (the default fixture links Pizzeria Roma of
  2026-09-20 to "Abonnementer"; nothing in 2025 is linked):
  - `view=all-postings&og=Abonnementer`: `"the object group filters the list, the count and the sum"`; `"its chip's ✕
    shows all postings"`; `"a period change keeps og"`; `"a level change keeps og"` (choose a main group in "+ Filter",
    then remove its chip; `og` and its chip stay); `"the shop suggestions follow the object group"`.
  - `view=all-postings` with a custom `answer` (the `linking` pattern in `key-numbers.test.ts`) that links one posting
    to "Åbne aftaler" and one to "Abonnementer": `"+ Filter lists the object groups by name and a choice filters"`
    (order Abonnementer, Åbne aftaler; pressed by `aria-pressed`; choosing the pressed one again leaves the hash as it
    is).
  - `view=all-postings&period=lastYear&og=Ukendt`: `"an unknown og gives da.noMatch with the chip and its one
    option"`.
- [ ] **Step 2: Run** `npm test --prefix addon`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: filter Alle posteringer by an object group`).

## Task 2: The link on each object group's key number

Model: opus · Review: yes

**Files:** `addon/web/src/model/key-numbers.ts`, `components/key-numbers.ts`, `state/actions.ts`, `app.ts`; tests
`addon/web/test/key-numbers.test.ts` and the tests that find the object-group cards by button name.

**Consumes:** Task 1's `objectGroup`, `setObjectGroup` and the filter.

**Produces:** spec §1, and `openObjectGroupPostings` from the names above.
- `objectGroupCards(ctx, hrefOf)` sets `postings: { count, href: hrefOf(title) }`, where `count` is the postings the
  value sums. The app passes `(t) => `#${toHash(openObjectGroupPostings(this.state, t))}``.
- `hs-key-numbers`: each object group's card is one `div role="group"` named by its label, with or without a toggle.
  With a toggle it holds today's `<button>` (label, amount, sub-line; name and `aria-pressed` as today); without, the
  label, amount and sub-line as plain text. After them comes the link line, rendered as the first card's
  (`da.postingsLink(count(n))`, or `count(0)` with no link), so the link sits under the sub-line. The first card's
  `plainCard` layout stays as it is. The card reads as one card.

- [ ] **Step 1: Write the failing tests** in `actions.test.ts`: `"openObjectGroupPostings sets og and clears the
  search, the shop, the unit and the amount, with the default sort and card=difference back to bars"`. In
  `key-numbers.test.ts`: `"each object group's key number links to its
  postings with its count"`; `"the count follows the period, the level, a category and one account, not the chosen
  unit"`; `"no posting, no link"`; `"the toggle keeps its name and aria-pressed, the link is outside the button, and a
  click still switches the right card"`; `"a plain card has the link too, in exactly one group with its name"`;
  `"following the link shows the chip and a
  summary count equal to the link's, after a search, a shop and a unit"` (Review focus 1); `"the link's hash has og and
  no q, shop, unit or card=difference"` (Review focus 2). Update the helpers that count or find object-group cards by
  button name, and name them in the report.
- [ ] **Step 2: Run** `npm test --prefix addon`. Expected: FAIL.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: a link from each object group's key number to its postings`).

## Task 3: The docs

Model: sonnet · Review: no

**Files:** `docs/decisions.md`, `docs/domain-language.md`, `addon/DOCS.md`, `docs/testing.md`, `docs/README.md`.

- [ ] **Step 1: Write** what spec §5 lists: D42 in the decision log's format, and D20's status set to `active; key list
  superseded by D35 and D42`; the Object group row; the DOCS.md lines; the Chrome-check screens; this spec and plan in
  `docs/README.md`.
- [ ] **Step 2: Run** `node scripts/check-links.mjs` and the gates. They pass.
- [ ] **Step 3: Commit** (`docs: the object group filter and its link`).
