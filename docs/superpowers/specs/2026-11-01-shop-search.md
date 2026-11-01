# Search on the shop, with the shops as suggestions – design

**Real Home Assistant:** no change there from this work. The change reaches the house with the next release, through
the house session ([`releasing.md`](../../releasing.md#after-a-release)).

**Issues:** #53 and #40. A subscription marker on postings is #54, top shops #55; neither is this work.

Thomas wants to find everything from one shop, such as Coop or Bauhaus, and see what each posting cost and what the
shop cost in all, within the chosen period. Today the search matches only the bank's posting text ("VD 1234 NETTO …"),
which rarely equals the shop. Since D32 the sorter writes each withdrawal's shop as its Firefly III expense account,
and most withdrawals have one, but the server does not send it.

This spec changes the [UI and UX spec](2026-10-30-ui-ux-design.md) and the
[postings search spec](2026-10-31-postings-search.md) where it says so. Everything else there holds.

## 1. The server sends the shop

`Posting` gets `shop: string | null`:

- A spending posting's shop is its split's `destination_name` when `destination_type` is an expense account.
- A refund's shop is its split's `source_name` when `source_type` is a revenue account.
- Otherwise, and when the name is Firefly III's `(no name)` in any case, `shop` is null.

Nothing else in `/api/data` changes. The fake Firefly III and the example data give most withdrawals a made-up shop,
some refunds one, and some postings none. `scripts/integration` seeds a real Firefly III with the same example data.

## 2. The rows show the shop

**Changes the UI spec** §4.2: a posting's text cell shows its shop, and the bank text when the shop is null. With a
shop, the bank text is the cell's tooltip (`title`), so a mouse-over shows it; with no shop the cell has no tooltip.
This holds with and without the link to Firefly III, which stays on the cell. The column header "Tekst" becomes
"Butik / tekst". This holds on the Posteringer card and on Alle posteringer.

## 3. The search matches the shop, and suggests shops

The search field on the Posteringer card and on Alle posteringer (one shared search, D31). It keeps the accessible name
"Søg". The placeholder becomes "Søg i butik og tekst, fx "Netto"".

- **Free text** matches a posting when its bank text **or** its shop contains what is typed, ignoring case and the
  spaces around it.
- **The base** is the postings the list would hold without the search and without a chosen shop: the level, the
  accounts, the period or the chosen unit, and on Alle posteringer also the amount range.
- **Suggestions:** while the field holds text and no shop is chosen, a list under the field shows the shops in the
  base whose name contains the text, matched as free text is. Each shop's sum is the net of its postings in the base,
  refunds subtracted. The biggest sum comes first, ties by name (`localeCompare(…, "da")`), at most 8; a shop with a
  sum of zero or less is still listed, last. An option shows the shop's name and its sum, and its accessible name is
  both ("Coop 365, 1.234 kr."). No match, no list. A posting with no shop is never a suggestion, but free text still
  finds it.
- **Choosing a suggestion** (a click or a tap, or the arrow keys and Enter) chooses that shop and empties the field.
  The list then holds only that shop's postings, compared by the exact name, so "Coop" does not match "Coop 365".
- **The chip:** the chosen shop shows as a chip "Butik: Coop 365" with ✕, named "Fjern Butik: Coop 365" like the other
  chips, in front of the field on both screens. On Alle posteringer it does not join the filter chips under the search
  (Claude's call: the shop is part of the search, and the two screens should look the same). The ✕, or Backspace in an
  empty field, unchooses it.
- **A chosen shop and free text together:** a posting must be that shop's and match the text. No suggestions show while
  a shop is chosen.
- Escape closes the suggestions. Enter without a highlighted suggestion keeps the free text and closes them.
- The field is an ARIA combobox with a listbox of options, so a screen reader and the tests reach it by role and name.

**History** (D20: a click adds an entry, typing replaces it): choosing a suggestion, by click or by Enter, adds an
entry, so Back returns to the typed text with no shop. The chip's ✕ adds an entry. Backspace in an empty field
replaces the entry, as typing does.

**The list:** a change of the chosen shop starts the list afresh, as a change of the search does (postings search spec
§2): the two newest groups open, the first page. Under a chosen shop, a group line counts and sums only that shop's
postings. The count and the sum under the search follow the shop and the text, so they answer "what did this shop cost
in the chosen period". The circle, the key numbers and the bars still do not change with the search or the shop.

**Nothing to show:** a chosen shop with no posting in the period shows "Ingen posteringer passer til filtrene", with
the chip still there to be cleared.

## 4. The chosen shop is a shared choice

The chosen shop belongs with the search: one of the shared choices, kept by every action that keeps the search, and
changed only in the search field. It is the new hash key `shop`, written right after `q` and before `sort`, on every
screen, when a shop is chosen. `shop=` with an empty value is no shop chosen. Any other name is accepted from the hash
as it is, also one with no postings; `normalise` leaves it alone. This is new decision D34. D20's key list gains
`shop`, so D20 becomes "active; key list superseded by D34". D31 stays active.

## 5. What is left to the builder

How the suggestions and the chip look, within the page's existing styles; they must work at 420 px and on a touch
screen. How the code is split between `matchesSearch`, the view state and the components.

## 6. Tests and checks

**Tests that flip on purpose:** the field's role changes from `searchbox` to `combobox`, so the `searchbox()` helper
and its uses in `addon/web/test/overview.test.ts` and the searches in `addon/web/test/all-postings.test.ts` change to
the new role. Tests that expect the bank text in a row of a posting that now has a shop, or the header "Tekst", change
with §2.

**New tests:**

- **Server:** the normaliser gives the shop for a withdrawal to an expense account and for a refund from a revenue
  account, null for `(no name)` in any case, and null for other account types.
- **Integration** (`scripts/integration`, against a real Firefly III): `/api/data` carries the seed's shop for a
  withdrawal and a refund, and null for the ones with none.
- **State:** `shop` parses and is written on every screen right after `q`; `shop=` is no shop; the actions that keep
  the search keep the shop.
- **The page, by role, accessible name and text:**
  - a row shows its shop, with the bank text as its tooltip, also with no link; a row with no shop shows its bank text
    and has no tooltip;
  - typing part of a shop's name finds its postings whose bank text does not contain it;
  - free text still finds a posting with no shop by its bank text;
  - the suggestions show matching shops by net sum and then by name, at most 8, and none for a posting with no shop;
  - choosing one by click and by keyboard shows only that shop's postings, and the count and the sum follow, a refund
    with that shop subtracted;
  - a shop whose name contains another's ("Coop" and "Coop 365") is matched exactly once chosen;
  - a chosen shop and free text together show only postings that match both;
  - the chip's ✕ and Backspace in an empty field unchoose the shop; Escape closes the list; Enter with no highlighted
    option keeps the free text;
  - Back after choosing a shop returns to the typed text with no shop;
  - the key numbers and the circle's total stay the same with a shop chosen;
  - a chosen shop with no posting in the period shows the no-match text and the chip;
  - a deep link with `shop=` shows the chip and the filtered list, also on Alle posteringer.

The Chrome check ([`testing.md`](../../testing.md)): the suggestions and the chip at 1440 and 1728 px wide and at
420 px, and the tooltip on a row.

## 7. Docs in the same PR

- `docs/decisions.md`: D34, the chosen shop is a shared choice in the hash; D20's status as §4 says.
- `docs/domain-language.md`: add the shop (*butik*) and its name in code, `Posting.shop`.
- `docs/testing.md`: new screens for the suggestions and the chip.
- `docs/README.md`: this spec and its plan in the lists.
- The comment on `ViewState.search` in `addon/web/src/state/view.ts`, to name the shop too.
