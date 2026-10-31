# A bar opens Posteringer, and Posteringer has a search – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [postings search spec](../specs/2026-10-31-postings-search.md), in one PR that closes #39.

**Architecture:** the page only (`addon/web`). The state's rules in `src/state/actions.ts` and `src/state/view.ts`;
the list's fresh start in `src/components/postings.ts`; the card's search row in `src/screens/overview.ts`, wired in
`src/app.ts`. Nothing on the server or in shared.

**Tech stack:** TypeScript, Lit, Vitest with happy-dom and Testing Library (`addon/web/test/`, `mount` and `settle`
from `test/mount.ts`).

## Global constraints

- `CLAUDE.md` hard rules 5 to 7: tests by role, accessible name and text; made-up data; English code; comments only
  for why.
- Danish texts only in `src/i18n/da.ts`. Reuse `da.search`, `da.searchLabel`, `da.showAll`, `da.summary`,
  `da.noMatch` and `da.noSpending`; no new text is needed.
- The gates in `CLAUDE.md` pass before every commit.

## Review focus

1. **Danish letters:** "øl" finds "ØL OG VAND" on the overview, as `matchesSearch` does with `toLocaleLowerCase("da")`.
   Test in Task 3.
2. **A search of spaces** matches everything; the count and the sum are the unsearched ones. Test in Task 3.
3. **Search, chosen unit and category together:** the list holds only the category's matching postings in the unit.
   Test in Task 3.
4. **Back after typing** on the overview goes to the state before the first key, not one key back (typing replaces
   the entry). Test in Task 3.
5. **A trail link from Alle posteringer** keeps the search and drops sort and amount. Test in Task 1.

---

## Task 1: the search is a shared choice

Model: sonnet · Review: yes

**Files:** `src/state/actions.ts`, `src/state/view.ts`, `test/actions.test.ts`, `test/view.test.ts`,
`docs/decisions.md`.

**Produces:** `chooseUnit(s, fullStart)` returns `card: "postings"` when it chooses; `openAllPostings` and `trailLevel`
keep `search`; `parseHash` and `toHash` handle `q` on every screen.

- [ ] Change the tests first, and run them to see them fail:
  - `actions.test.ts` "chooses a unit and toggles it off": choosing gives `card: "postings"`; choosing another unit
    while one is chosen gives `card: "postings"`; the toggle off from `card: "bars"` keeps `"bars"`.
  - "opens Alle posteringer with no search, newest first and no amount" becomes "opens Alle posteringer keeping the
    search": `openAllPostings({ ...DEFAULT_STATE, search: "rema", sort: "largest", amount: { min: 1, max: null } })`
    gives `search: "rema"`, `sort: "newest"`, `amount: null`.
  - "leaves Alle posteringer through the trail": `search` is kept; `sort` and `amount` are reset.
  - New: `openPart`, `setCard`, `setPeriod`, `setGrouping`, `removeUnit` and `normalise` keep `search: "rema"`.
  - `view.test.ts` "reads the search, sort and amount only on Alle posteringer" becomes two cases: `parseHash("q=rema")`
    gives `search: "rema"` on the overview, and `toHash` of that state is `"q=rema"`; `parseHash("q=rema&sort=largest&min=5&card=postings")`
    gives `sort: "newest"` and `amount: null`.
- [ ] Implement: `chooseUnit` sets `card: "postings"` when it chooses; `openAllPostings` and `trailLevel` stop setting
  `search`; `parseHash` reads `q` and `toHash` writes it outside the `allPostings` branch, keeping D20's key order.
  The comment on `ViewState.search` says the search is shared and sort and amount belong to Alle posteringer.
- [ ] `docs/decisions.md` gets D31 in the log's format: the search is one of the shared choices, `q` is in the hash on
  every screen, and typing replaces the entry wherever it is typed. Why: Thomas looks for a store's cost on the
  overview and expects the search to stay when he switches cards. Source: Thomas, 2026-10-31, this spec.
- [ ] The tests pass; commit `feat: the search is one of the shared choices`.

## Task 2: a new search starts the list afresh

Model: sonnet · Review: yes

**Files:** `src/components/postings.ts`, `test/postings.test.ts`.

**Produces:** `hs-postings` takes a `query: string` property (default `""`); a change of it resets the folding and the
paging as a new first group does.

- [ ] Test first, "starts over when the search changes": a grouped list by week with 14 groups; unfold the third
  group and press `da.showOlder`; set `query` to `"x"` and a list with the same newest group and 13 groups. The first
  two group lines have `aria-expanded="true"`, the rest `"false"`, and 12 group lines show.
- [ ] Implement: `resetKey` takes the query too, so `willUpdate` also runs on a change of `query`.
- [ ] The tests pass; commit `feat: a new search starts the postings list afresh`.

## Task 3: the search row on the Posteringer card

Model: opus · Review: yes

**Files:** `src/screens/overview.ts`, `src/app.ts`, `test/overview.test.ts`, `test/chosen-unit.test.ts`,
`test/all-postings.test.ts`.

**Consumes:** Task 1's state, Task 2's `query` property, `matchesSearch` from `src/model/filter.ts`.

- [ ] Change and add the tests first, and run them to see them fail:
  - `chosen-unit.test.ts` "chooses July from its bar and shows Forskel" becomes "…and shows its postings": the hash is
    `#unit=2026-07-01&card=postings`, the switch's `da.postings` button is pressed, `da.difference` is there.
    A click on the chosen bar from `card=bars` unchooses it and keeps Søjler.
  - `chosen-unit.test.ts` "drops the unit with its chip or a second click": the bar click expects
    `#unit=2026-07-01&card=postings`, then Søjler is pressed from Posteringer. `CHOSEN` stays `card=difference`; five
    other tests mount it to reach Forskel.
  - `all-postings.test.ts` "leaves the search behind through the trail" becomes "keeps the search through the trail".
  - New in `overview.test.ts`, on `#card=postings`:
    - the searchbox `da.searchLabel` with placeholder `da.search` is there, and the summary text before any key;
      typing filters the rows, the text
      `da.summary(count(n), kr(sum))` follows, and `location.hash` gains `q=` without a new history entry;
    - the key numbers' texts and the circle's total are the same before and after typing;
    - typing, then `da.bars`, then `da.postings`: the field still holds the text;
    - `mount("card=postings&q=…")` shows only the matching rows;
    - typing until nothing matches shows `da.noMatch`, and the searchbox is still `document.activeElement`;
    - a chosen unit after today without a search shows `da.noSpending` with the searchbox above it;
    - a period with no spending at all (`period=custom&from=2020-01-01&to=2020-12-31&card=postings`) shows the
      searchbox and `da.noSpending`;
    - the button `da.showAll` opens Alle posteringer with the text in its searchbox;
    - Review focus 1 to 4.
- [ ] Implement in `Overview`:
  - the Posteringer view renders, under the title row, a row with the searchbox (the same class and look as
    `.all-search`) and a `da.showAll` button that fires `open-all-postings`, then the summary right-aligned, then the
    list or its empty text. `right()` renders this row in the Posteringer view also when the period has no spending.
  - the list is `within(ctx.shown, chosen ?? period)` filtered by `matchesSearch(p.text, state.search)`; the amount
    range is not used. The summary counts and sums that whole list. `hs-postings` gets `.query=${state.search}`.
  - the foot keeps `da.postingsHint` only; `.half-link` goes if nothing else uses it.
  - the searchbox fires `search-input`; `app.ts` handles it from the overview as from Alle posteringer, with
    `"replace"`.
  - at 420 px the field and the button share one line: the field `flex: 1; min-width: 0`, the button `flex: none`.
- [ ] The tests pass, and the gates; commit `feat: a bar opens Posteringer, and Posteringer has a search`.

## Task 4: docs, checks and PR

Model: opus · Review: no

- [ ] `docs/testing.md`: `23-soejle` and `24-soejle-kategori` press Forskel after the bar click; new screens
  `33-posteringer-soeg` (a search on the overview's Posteringer) and `34-posteringer-ingen-match`, as new list items.
- [ ] `docs/README.md` lists this spec and this plan.
- [ ] Both gate lines. The fast loop and the Chrome check: a bar click at 1440, 1728 and 420 px, the search row at
  those widths, Back after typing. Screenshots in `screenshots/2026-10-31-postings-search/`.
- [ ] `reviewer` on the branch until Ready. PR `feat: a bar opens Posteringer, and Posteringer has a search`, with
  `Closes #39`, links to the spec and plan, and the rulings.
