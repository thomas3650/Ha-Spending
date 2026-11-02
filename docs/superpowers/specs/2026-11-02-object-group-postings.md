# A link from each object group's key number to its postings – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option.

**Issue:** #71.

Thomas wants to see the postings of Faste udgifter and Abonnementer on Alle posteringer. On 2026-11-02 he chose the
fourth of four mockups shown in chat (described in §1 and §2): a link under each object group's key number, as
"Forbrug i perioden" has ([lists, period and postings spec](2026-11-02-lists-period-postings.md) §3), that opens Alle
posteringer filtered to that object group. This spec adds to that spec's §3 and §4 and to the
[UI spec](2026-10-30-ui-ux-design.md) §4.3. Everything else there holds.

**Thomas's rulings, 2026-11-02:**

- Each object group's key number gets a link "58 posteringer →" under its amount.
- The link opens Alle posteringer filtered to the object group, with a chip "Abonnementer ✕". ✕ shows all postings
  again.
- "+ Filter" can also choose an object group.
- The rest of the key number still switches the right card to Faste udgifter, as today.

**Claude's calls, for Thomas to see before approving:**

- The link sits under the sub-line rather than under the amount, which departs from the ruling above: a link cannot
  sit inside the toggle button that holds the amount and the sub-line (§1).
- The link's count is the same postings as the key number's value: the level, the accounts and the period, not the
  chosen unit. So the link also clears a chosen unit, as well as the search and the shop (§1).
- The object group is a filter of Alle posteringer only, like the amount range: in the hash as `og` on Alle
  posteringer, and reset when Alle posteringer is opened another way or left (§3).
- An object group that none of the postings carries still filters, as an unknown shop does (§2).
- In "+ Filter" the object groups come under the heading "Faste udgifter", the page's word for bills
  ([D36](../../decisions.md)) (§2).

## 1. The link on the key number

- **Where:** in each object group's key number (lists spec §4), on every level.
- **Markup and look:** a link cannot sit inside a button. So each object group's key number becomes a card: a group
  whose accessible name is its label ("Abonnementer i perioden"). It holds the toggle button of today (label, amount
  and sub-line, `aria-pressed` as today, its accessible name unchanged) and, after the button, the link. It reads as
  one card: the link is a line in the card's colours under the sub-line, styled as the first key number's link. When
  the household has no kept bills the card is plain, as today, with the same link.
- **The text:** "58 posteringer →" (one: "1 postering →"), as the first key number's link (`da.postingsLink`).
- **The count:** the shown postings at the level and the accounts, within the period (not the chosen unit), whose
  `subscription.objectGroup` is the group. These are the postings the key number's value sums.
- **With no posting:** the line reads "0 posteringer" and is not a link.
- **The click** opens Alle posteringer with the level, the accounts and the period as they are, the object group
  chosen, the search and the shop cleared, the chosen unit cleared the way its chip's ✕ clears it (`withoutUnit`, so a
  `card=difference` goes back to Søjler), and the amount range cleared. The sort is the default. Clearing the search
  and the shop is the exception to [D31](../../decisions.md) and [D35](../../decisions.md) that D41 records for the
  first link; clearing the unit is an exception to the UI spec §5 ("one set of choices"). D42 records both.

## 2. Alle posteringer with an object group

- **The filter:** only postings whose `subscription.objectGroup` is the chosen group. It is part of the postings
  before the search (`searchBase`), as the amount range is, so the shop suggestions, the count and the sum above the
  table all follow it.
- **It stays** when the period, the grouping, the accounts or the level change on Alle posteringer. An object group
  that none of the shown postings carries, from the hash or after such a change, still filters: the list is empty with
  `da.noMatch`, and the chip shows so ✕ can remove it. Dropping it silently would change the list without a word, so
  it is kept, as the page already keeps an unknown shop (`parseHash` and `normalise` never check it). This is an
  exception to D20's fallback, recorded in D42.
- **The chip:** the object group's title as Firefly III writes it, with ✕, after the amount chip. Its accessible name
  is `da.remove(title)` ("Fjern Abonnementer"), as the other chips'.
- **"+ Filter":** a group headed "Faste udgifter" lists the object groups on the postings Alle posteringer would show
  with no object group chosen (`searchBase` without the object group: the level, the accounts, the period or chosen
  unit, the amount range), ordered by name with `localeCompare(…, "da")`. The chosen one is pressed and is listed even
  when no posting carries it. A choice sets the filter and keeps the other filters; choosing the pressed one again
  changes nothing, as the other options do. With no object group on those postings and none chosen, the group is left
  out; with an unknown group chosen it shows with that one option.

## 3. The hash

- `og=<title>` on Alle posteringer only, URL-encoded as the other names, written after `max`, the last key today. An
  empty `og=` means none, as an empty `shop=` does. `ViewState` gains `objectGroup: string | null`, default null. It is
  read only on Alle posteringer and dropped on the overview, as `sort`, `min` and `max` are.
- Opening Alle posteringer by the first key number's link or by "Vis alle", and leaving it by the trail, set it to
  null, as they reset the sort and the amount.
- D42 adds `og` to the key list; D20's status becomes `active; key list superseded by D35 and D42`.

## 4. Tests

By role, name and text, made-up data only (hard rule 5):

- **The link:** each object group's key number has a link with its count; the count follows the period, and at a main
  group and at a category it is that level's, and with one account chosen that account's; a chosen unit does not
  change it; with no posting there is no link; the toggle button keeps its accessible name and `aria-pressed`, and its
  click still switches the right card; the link is not inside the button; a plain card (no kept bills, an ended
  bill's group on the postings) also has the link. The existing key-number tests that find the cards by button name
  are updated for the card group.
- **Following the link:** Alle posteringer shows the chip, only that group's postings, and a summary count equal to
  the link's count, also after a search, a chosen shop and a chosen unit before the click; the hash has `og=` and no
  `q`, `shop`, `unit` or `card=difference`.
- **The chip and the filter:** ✕ removes the filter and shows all postings; "+ Filter" lists the object groups by
  name with the chosen one pressed, and a choice filters; an unknown `og=` gives `da.noMatch` with the chip; a change
  of the period or the level on Alle posteringer keeps `og`; the shop suggestions follow the filter.
- **The hash:** `og` round-trips on Alle posteringer, an empty `og=` is none, `og` is dropped on the overview, and "Vis
  alle" and the trail clear it.

The Chrome check ([`testing.md`](../../testing.md)): the two key numbers' links at Alt forbrug and at a main group, the
two filtered pages, the chip's ✕ and "+ Filter"'s group. At 1440 and 420 px.

## 5. Docs in the same PR

- `docs/decisions.md`: D42, the object group is a filter of Alle posteringer in the hash as `og`, reached from its key
  number's link; an unknown group still filters; the link clears the search, the shop (as D41) and the chosen unit.
  D20's status as in §3.
- `docs/domain-language.md`: the Object group row says it is also a filter on Alle posteringer.
- `addon/DOCS.md`: the link and the filter, where it describes the key numbers and Alle posteringer.
- `docs/testing.md`: the screens of §4's Chrome check.
- `docs/README.md`: this spec and its plan in the lists.

## 6. What is left to the builder

The card's exact look with a button and a link within §1.
