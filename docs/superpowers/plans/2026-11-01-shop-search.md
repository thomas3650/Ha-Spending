# Search on the shop, with the shops as suggestions – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [shop search spec](../specs/2026-11-01-shop-search.md), in one PR that closes #53 and #40.

**Architecture:** the server adds `shop` to each `Posting` in `addon/server/src/firefly/normalise.ts`. The page gets
the match and the suggestions in `src/model/filter.ts`, the chosen shop in the view state, the shop in the rows in
`src/components/postings.ts`, and one new search component, `src/components/search.ts`, that both screens use in
place of their own search field.

**Tech stack:** TypeScript, Hono, Lit, Vitest with happy-dom and Testing Library (`addon/web/test/`, `mount` and
`settle` from `test/mount.ts`).

## Global constraints

- `CLAUDE.md` hard rules 5 to 7: tests by role, accessible name and text; made-up data; English code; comments only
  for why.
- Danish texts only in `src/i18n/da.ts`. New and changed texts, exactly:
  - `search: 'Søg i butik og tekst, fx "Netto"'` (was the text placeholder); `searchLabel` stays `"Søg"`;
  - `columns.text: "Butik / tekst"`;
  - `shopChip: (name: string) => \`Butik: ${name}\`` (the chip's text; its name is `da.remove(text)`, as every chip);
  - `shopOption: (name: string, sum: string) => \`${name}, ${sum}\`` (an option's accessible name);
  - `suggestions: "Butikker"` (the listbox's accessible name).
- An option's sum text: `kr(sum)` when `sum > 0`; `postingAmount(sum)` when `sum <= 0`, so a shop whose refunds
  outweigh its spending reads "+200,00" as a refund row does (Claude's call).
- Every component renders into the light DOM (`createRenderRoot() { return this; }`) and its styles join
  `SpendingApp.styles` in `app.ts`, as `postings.ts`, `overview.ts` and `all-postings.ts` do.
- The gates in `CLAUDE.md` pass before every commit.

## Review focus

1. **Danish letters and spaces:** "  føtex " finds the shop "Føtex" in free text and in the suggestions. Test in Task 2.
2. **The same name in two cases:** the shops "netto" and "Netto" are two shops (exact name); each suggestion has its
   own sum. Test in Task 2.
3. **A chosen shop that the period does not hold**, from a deep link: the chip shows, the list shows `da.noMatch`, the
   count is 0, and no suggestion list opens. Test in Task 4.
4. **A tap on an option** chooses it although the field loses focus first. Test in Task 4: `pointerdown` on the
   option, then `focusout` on the field, then `click` on the option: `shop-choose` fires once.
5. **Alle posteringer with an amount range:** a shop whose postings all fall outside the range is not suggested. Test
   in Task 2 (`shopSuggestions` on the filtered base) and Task 4 (on the screen).

---

## Task 1: the server sends the shop

Model: sonnet · Review: yes

**Files:** `addon/shared/src/types.ts`, `addon/server/src/firefly/normalise.ts`, `addon/server/src/firefly/wire.ts`,
`addon/server/src/sorter/shop.ts`, `addon/server/src/sorter/tools.ts`, `addon/server/test/normalise.test.ts`,
`addon/server/test/read.test.ts`, `addon/dev/src/generate.ts`, `addon/server/test-integration/firefly.test.ts`, and
every test that builds a `Posting` by hand: `addon/web/test/fixture.ts`, `addon/shared/test/fixture.ts`,
`addon/server/test/app.test.ts`, `addon/web/test/overview.test.ts`, `addon/web/test/all-postings.test.ts` (search the
tests for `kind: "spending"` and `kind: "refund"` to find any others).

**Produces:** `Posting.shop: string | null`, with the doc comment "The shop's name; null when Firefly III has none.".
`NO_SHOP`, `EXPENSE = "Expense account"` and `REVENUE = "Revenue account"` live in `wire.ts`; `sorter/shop.ts`
re-exports `NO_SHOP` from there and `sorter/tools.ts` imports `EXPENSE`, so `firefly/` imports nothing from `sorter/`.
In every hand-made test `Posting`, `shop` is its text, and `null` for `Husleje` and `Kiosken` in the web fixture; the
texts do not change in this task.

- [ ] Tests first, and run them to see them fail. In `normalise.test.ts`:
  - "gives a withdrawal's expense account as its shop": the existing withdrawal to `"Netto"` gives `shop: "Netto"`.
  - "gives a refund's revenue account as its shop": a deposit from a `"Revenue account"` named `"Café Søde"` gives
    `shop: "Café Søde"`.
  - "gives no shop for (no name), in any case": destination names `"(no name)"` and `"(No Name)"` give `shop: null`.
  - "gives no shop for other account types": a withdrawal to a `"Cash account"` and a deposit from an
    `"Asset account"` give `shop: null`.
  - The existing `toEqual` cases gain the `shop` they now get.
- [ ] Implement in `normalise.ts`: `shopName(name: string, type: string, wanted: string): string | null` is `null`
  unless `type === wanted` and `name.toLocaleLowerCase("und") !== NO_SHOP`; else the name as Firefly III gives it,
  untrimmed. Spending uses the destination with `EXPENSE`, a refund the source with `REVENUE`.
- [ ] The generated data (`generate.ts`, the fast loop's data): `withdrawal(…)` takes an optional `description` that
  defaults to the destination, and an `undefined` destination. The weekly groceries pick a shop into a local and get
  the description `` `Dankort ${shop.toUpperCase()}` `` with the shop as destination. The `"MobilePay"` choice among
  the small card withdrawals keeps the text `"MobilePay"` and gets no destination, so it becomes `(no name)`. In
  `read.test.ts` "drives every screen", add: some postings have a shop, some have `null`, and a refund has a shop.
- [ ] Integration (`firefly.test.ts`), against the example data `scripts/integration` seeds: "Indkøb i Netto" has
  shop `"Netto"`, and the refund "Returvare Netto" has shop `"Netto"` from its revenue account. At the end of the
  describe "the sorter's shop on a real Firefly III", read `/api/data` for December: "Shop gæld" (kept `(no name)`
  after `name-taken`) and "Shop kontant" (a cash account) have `shop: null`. Do not add postings to `exampleSeed`;
  the fake and integration tests count it exactly. It runs only in `scripts/integration` (Docker); if Docker is not
  running, say so in the report.
- [ ] The gates pass; commit `feat: the server sends a posting's shop`.

## Task 2: the match, the suggestions and the chosen shop in the state

Model: sonnet · Review: yes

**Files:** `addon/web/src/model/filter.ts`, `addon/web/src/state/view.ts`, `addon/web/src/state/actions.ts`,
`addon/web/src/screens/overview.ts`, `addon/web/src/screens/all-postings.ts`, `addon/web/test/filter.test.ts` (new),
`addon/web/test/all-postings.test.ts`, `addon/web/test/view.test.ts`, `addon/web/test/actions.test.ts`,
`docs/decisions.md`, `docs/domain-language.md`.

**Consumes:** `Posting.shop` from Task 1.

**Produces:**
- `matches(p: Posting, search: string, shop: string | null): boolean` replaces `matchesSearch`: a non-null `shop`
  needs `p.shop === shop`; the search, trimmed and lower-cased with `"da"`, must be empty or be in the text or the
  shop, lower-cased the same way.
- `interface ShopSuggestion { name: string; sum: number }` and
  `shopSuggestions(base: Posting[], search: string): ShopSuggestion[]`: empty for a blank search; else the shops in
  `base` whose name contains the search (same trimming and casing), each with the net sum in øre of its postings,
  biggest first, ties by `localeCompare(…, "da")`, at most `SUGGESTIONS = 8`.
- `searchBase(ctx: ViewContext): ClassifiedPosting[]`: Alle posteringer's base, the period or the chosen unit and the
  amount range; `filteredPostings(ctx)` becomes `searchBase(ctx).filter((p) => matches(p, search, shop))`.
- `ViewState.shop: string | null` (default `null`); `chooseShop(s, name)` gives `{ ...s, shop: name, search: "" }`;
  `removeShop(s)` gives `{ ...s, shop: null }`.
- `parseHash` reads `shop` on every screen (empty or missing is `null`); `toHash` writes it right after `q`, before
  `sort`.

- [ ] Tests first, and run them to see them fail:
  - `filter.test.ts`: `matches` on text only, shop only, both, a chosen shop that a longer name contains (`"Coop"`
    vs `"Coop 365"`), a chosen shop plus text; the three `matchesSearch` cases from `all-postings.test.ts:226-230`
    move here as `matches` cases (and the import at its line 8 goes); `shopSuggestions` order, ties by name, the cap
    of 8, a net of zero or less last, no posting with a null shop, and Review focus 1, 2 and 5.
  - `view.test.ts`: `parseHash("shop=Netto")` gives `shop: "Netto"` and `toHash` gives `"shop=Netto"`;
    `parseHash("shop=")` gives `null`; a state with `screen: "allPostings"`, `search: "rema"`, `shop: "Netto"` and
    `sort: "largest"` gives `"…view=all-postings&q=rema&shop=Netto&sort=largest"`.
  - `actions.test.ts`: `chooseShop` empties the search; `removeShop`; `openAllPostings`, `trailLevel`, `openPart`,
    `setCard`, `setPeriod`, `setGrouping`, `removeUnit` and `normalise` keep `shop: "Netto"`.
- [ ] Implement as **Produces** says. `overview.ts` and `all-postings.ts` switch to `matches(p, state.search,
  state.shop)` so the page builds; their fields change in Task 4. The comment on `ViewState.search` becomes: the
  search and the chosen shop are shared choices; sort and amount belong to Alle posteringer. The comment on `toHash`
  says the keys go in the order of D20 and D35.
- [ ] Docs: in `decisions.md`, D20's status becomes `active; key list superseded by D35`, and new D35 in the log's
  format: the chosen shop is a shared choice, the hash key `shop` right after `q` on every screen, kept and changed as
  the search is. Why: Thomas wants a shop's postings and cost in the chosen period, and the link keeps what he chose.
  Source: Thomas, 2026-11-01, the shop search spec §4. In `domain-language.md`, a row "Shop | butik | `shop`
  (`Posting.shop`)", and line 34 points at D20 and D35.
- [ ] The gates pass; commit `feat: the chosen shop and the shop match in the page's state`.

## Task 3: the rows show the shop

Model: sonnet · Review: yes

**Files:** `addon/web/src/components/postings.ts`, `addon/web/src/i18n/da.ts`, `addon/web/test/postings.test.ts`,
`addon/web/test/fixture.ts`, and tests that expect the header "Tekst".

**Consumes:** `matches` (Task 2), so a search for "roma" still finds a row whose text no longer says it.

**Produces:** `hs-postings` takes `shop: string | null` (default `null`) beside `query`; `resetKey` uses both, so a
change of the chosen shop starts the list afresh. The web fixture's bank texts: `Netto`'s rows get the text
`"DK NETTO 4521"`, `Pizzeria Roma`'s two rows `"MOBILEPAY 1234"`; their shops stay.

- [ ] Tests first, and run them to see them fail, in `postings.test.ts`:
  - a row with a shop shows the shop as its cell's text, with `title` the bank text, with a link and with no
    `fireflyLinkUrl`;
  - a row with no shop shows its bank text and has no `title`;
  - the column header is `da.columns.text` ("Butik / tekst");
  - "starts over when the shop changes": as "starts over when the search changes", setting `shop` instead of `query`.
- [ ] Implement: the cell's text is `p.shop ?? p.text`; `title=${p.shop === null ? nothing : p.text}` on the `<td>`;
  the new `shop` property; `da.columns.text`. Then change the fixture's texts; the overview and Alle posteringer tests
  that find "Pizzeria Roma" or "Netto" must still pass, through the shop.
- [ ] The gates pass; commit `feat: the postings list shows the shop`.

## Task 4: the search component on both screens

Model: opus · Review: yes

**Files:** `addon/web/src/components/search.ts` (new), `addon/web/src/screens/overview.ts`,
`addon/web/src/screens/all-postings.ts`, `addon/web/src/app.ts`, `addon/web/src/i18n/da.ts`,
`addon/web/test/search.test.ts` (new), `addon/web/test/overview.test.ts`, `addon/web/test/all-postings.test.ts`.

**Consumes:** `matches`, `shopSuggestions`, `searchBase`, `chooseShop`, `removeShop` (Task 2); `hs-postings`'s `shop`
(Task 3).

**Produces:** `<hs-search .search=${string} .shop=${string | null} .suggestions=${ShopSuggestion[]}>`, in the light
DOM. It renders the chip (`chip(da.shopChip(shop), …)` from `chip.ts`) when a shop is chosen, then an
`<input type="search">` with `role="combobox"`, `aria-label=${da.searchLabel}`, `placeholder=${da.search}`,
`aria-expanded`, `aria-controls` and `aria-activedescendant`, then a `role="listbox"` named `da.suggestions` whose
`role="option"` items show the name and the sum text (Global constraints) and are named `da.shopOption(name, text)`.
It fires, bubbling and composed through `fire`: `search-input` (string), `shop-choose` (string) and `shop-remove`
(`"click" | "key"`).

Behaviour inside the component: the list is open while the field has focus, no shop is chosen, it has not been closed
since the last input, and `suggestions` is not empty. ArrowDown and ArrowUp move the highlight; Enter on a highlighted
option fires `shop-choose`, else closes the list; Escape closes it; the next input opens it again. Backspace in an
empty field with a chosen shop fires `shop-remove` with `"key"`; the chip fires `shop-remove` with `"click"`. An
option chooses on `click` only. The listbox calls `preventDefault` on `mousedown`, and a `focusout` while a pointer is
down on the list does not close it (the flag clears on `pointerup` and `pointercancel`), so a click or a tap reaches
the option. After a choice the component focuses the
field again. It reuses the look of `.all-search`; the list
sits under the field, over the content, inside the card at 420 px.

- [ ] Change and add the tests first, and run them to see them fail:
  - Flip on purpose: `overview.test.ts`'s `searchbox()` helper and `all-postings.test.ts`'s search field queries use
    `getByRole(root, "combobox", { name: da.searchLabel })`; `all-postings.test.ts:195` becomes
    `queryByRole(root, "combobox", { name: da.searchLabel })`, since the sort `<select>` is a combobox too.
  - `search.test.ts` on the component alone: the options and their names, including a net of zero or less read as
    `postingAmount`; the keyboard; Escape, and typing opens the list again; Enter with no highlight; Backspace; the
    chip; Review focus 4.
  - `overview.test.ts` on `#card=postings`:
    - typing `"roma"` finds the `MOBILEPAY 1234` rows by their shop;
    - typing `"kiosk"` finds the row with no shop by its text, and no option is offered;
    - typing `"pizz"` offers one option named `da.shopOption("Pizzeria Roma", kr(50000))` (70000 − 20000 øre);
    - choosing it by click and by ArrowDown + Enter: the field is empty, the chip named
      `da.remove(da.shopChip("Pizzeria Roma"))` is there, only its two rows show, the summary is
      `da.summary(count(2), kr(50000))`, `location.hash` gains `shop=Pizzeria+Roma`, and Back returns to `q=pizz`
      with no shop;
    - a chosen shop plus typed text shows only the rows that match both;
    - the chip and Backspace in an empty field unchoose the shop; Backspace replaces the history entry, the chip adds
      one;
    - the key numbers' texts and the circle's total are the same with a shop chosen;
    - Review focus 3: `mount("card=postings&shop=Ukendt")`.
  - `all-postings.test.ts`: a deep link with `shop=Netto` shows the chip and only Netto's rows; Review focus 5 with
    `min`.
- [ ] Implement `search.ts`, then use it in `Overview.postings()` and in `AllPostings` in place of their inputs; both
  pass `shopSuggestions(base, state.search)` with their base (overview: `within(ctx.shown, chosen ?? period)`; Alle
  posteringer: `searchBase(ctx)`) and pass `.shop` to `hs-postings`. The overview's empty text is `da.noSpending` only
  with no search and no shop, else `da.noMatch`. In `app.ts`, on both screens: `search-input` → `setSearch`,
  `"replace"`; `shop-choose` → `chooseShop`, `"push"`; `shop-remove` → `removeShop`, `"push"` for `"click"` and
  `"replace"` for `"key"`.
- [ ] The tests pass, and the gates; commit `feat: suggest shops in the search, and choose one`.

## Task 5: docs, checks and PR

Model: opus · Review: no

- [ ] `docs/testing.md`: new screens `37-butik-forslag` (the suggestions open under the field on the overview) and
  `38-butik-valgt` (a chosen shop's chip, list and summary), as new list items.
- [ ] `docs/README.md` lists this spec and this plan.
- [ ] Both gate lines and `scripts/integration`. The fast loop and the Chrome check: the suggestions and the chip at
  1440, 1728 and 420 px, a click on an option, the field focused after a choice, the tooltip on a row; with touch
  emulation, a scroll that starts on the list chooses no shop. Screenshots in
  `screenshots/2026-11-01-shop-search/`.
- [ ] `reviewer` on the branch until Ready. PR `feat: search on the shop, with the shops as suggestions`, with
  `Closes #53` and `Closes #40`, links to the spec and plan, and the rulings.
