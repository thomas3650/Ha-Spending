# The detail of a fixed expense, a subscription or a shop – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issue:** #76.

Thomas wants to click a fixed expense, a subscription or a posting and see more about it. He first asked for the notes
from Firefly III. The live data showed that nearly every posting's note is the bank's category from the import, and only
a handful are his own; the bills' notes are long bookkeeping texts. He then dropped the notes and asked instead to see
what a fixed expense or a subscription has cost in the chosen period. On 2026-11-02 he chose the layout from mockups
shown in chat; they are in [`docs/mockups/v5/`](../../mockups/v5/detalje.html), made-up data.

This spec adds to the [UI spec](2026-10-30-ui-ux-design.md) §4 and the
[card full-screen spec](2026-11-01-card-full-screen.md) §1. It changes the UI spec's §4.2 and §4.3, where "a click on
a posting opens it in Firefly III" (§1.3 here), and the [object groups spec](2026-11-01-object-groups.md)'s
`Posting.subscription` by one field (§4). Everything else there holds.

**Thomas's rulings, 2026-11-02:**

- A click on a row shows its detail. On the normal page the whole right card switches to the detail. In full screen,
  and on Alle posteringer, the screen splits in two: the list on the left, the detail on the right.
- No notes from Firefly III, on postings or on bills.
- The detail of a fixed expense or a subscription shows what it has cost in the chosen period.
- A subscription's detail looks like a fixed expense's.
- A posting that is not linked to a subscription gets the same layout, for its shop.
- The detail on the normal page looks like the one in full screen, so one component shows it everywhere.
- In the split, the detail has no border of its own: a line divides it from the list.
- Thomas, 2026-11-02: "keep going until there is a release". He agreed to the design in chat and asked for the work to
  run through to a release without stopping for his approval.

**Claude's calls, for Thomas to see in the PR:**

- The detail's span is always the period, also when a bar's unit is chosen: Faste udgifter ignores the chosen unit
  already, and "i perioden" should mean the same everywhere (§3).
- The detail is in the hash (key `detail`), so Back closes it and a shared link opens it. This is D44 (§5).
- The list in the detail shows the newest 10 rows and "Vis alle N" in place; there is no link to Alle posteringer from
  the detail (§2.4).
- The bars follow Gruppér pr., one per unit of the period, as the Søjler card's (§2.3).
- The boxes count "N posteringer" for every kind, since a refund linked to a bill is a row too (§2.2).
- The second grey box of a shop's detail is Kategori, not Mærker: the page does not read tags, and many carry the
  import's tag (§2.2).
- A row's name stops being a link to Firefly III; the link moves into the detail (§1.3).
- A posting carries its bill's id, so the page finds the subscription by id, not by name (§4).
- At 420 px the split does not fit, so the detail replaces the list there (§1.2).

## 1. Where the detail shows

### 1.1 What opens it

- **A row of Faste udgifter** (the right card's subscriptions table, normal and full screen) opens that subscription's
  detail.
- **A row of Posteringer** (the right card, normal and full screen) and **a row of Alle posteringer** open:
  - the subscription's detail, when the posting's `subscription` is one of `data.subscriptions` (by id);
  - otherwise the shop's detail (§2). A posting with no shop opens the detail of its text, as if the text were the shop.
- The row's name is a button with the name as its accessible name, and a click anywhere on the row does the same, so
  both the mouse and the keyboard reach it. A click on a group row (a unit, an object group) still folds the group.
- The Butikker card, the bars, the circle and the key numbers do not open a detail.

### 1.2 The layouts

- **The normal page:** the right card shows the detail in place of everything under its head row (Posteringer's
  search row, summary, table and "Vis alle"; Faste udgifter's sums and table). In the head row:
  - just before the `h2`, a button "←" (accessible name "Tilbage til <title>") closes the detail; the `h2` keeps the
    card's title as its only text, so the region keeps its name, and both read as one "← <title>" in the accent
    colour, as in [mockup 1](../../mockups/v5/detalje-1-normal.png);
  - the chips beside the title (a level's, a chosen unit's) are not shown while the detail is open;
  - the view switch and the full-screen button stay.
  The left card and the key numbers stay.
- **Full screen** ([D37](../../decisions.md)) **and Alle posteringer:** the rows above the list (Posteringer's search
  and summary; Alle posteringer's search, chips, "+ Filter" and count; Faste udgifter's sums) keep the whole width. Under
  them the card holds two columns, the list on the left and the detail on the right, divided by one vertical line, as in
  [mockups 2–4](../../mockups/v5/detalje-2-fuld-skaerm.png). The list keeps its headers, groups and sort. The chosen
  row is marked: `aria-current="true"`, the soft accent background and an accent bar at its left edge. A ✕ at the
  detail's top right, named "Luk", closes it; the list then takes the whole width again. A click on another row changes
  the detail.
- **Narrow, at 420 px** (where the halves stack): the split does not fit. The detail takes the list's place, under the
  same rows above it, with "Luk" at its top.
- **Turning full screen on or off** keeps an open detail; it only changes the layout.

### 1.3 Focus, closing and keyboard

- **On open** the focus goes to the detail's heading (`h3`, `tabindex="-1"`). A click on another row in the split
  moves it there too.
- **Closing:** "Luk", "← <title>", Escape and Back (§5). Escape on the overview closes an open detail before it leaves
  full screen; the next Escape leaves full screen. An Escape that a dropdown or the search's suggestion list uses first
  does neither, as the card full-screen spec §1 has it. On Alle posteringer Escape closes the detail.
- **After closing** the focus goes to the button of the row that opened the detail, or of the marked row, when it is
  shown; otherwise to the card's `h2` (overview) or the page's heading (Alle posteringer).
- The row's name is no longer a link to Firefly III; the detail has "Åbn i Firefly III ↗" instead (§2.5).

## 2. The detail

One component shows all three kinds, as in the mockups. From top to bottom:

### 2.1 The head

- A grey context line, the name as a heading (`h3`), and the big amount with what stands beside it:

  | Kind | Context line | Big amount | Beside it |
  | --- | --- | --- | --- |
  | Fixed expense or subscription | the main group of the last payment's category (`da.noMainGroup` for a category with none), " · ", the object group; only the object group when there is no last payment | the amount per payment with its repeat, as the Faste udgifter table's Beløb ("400 kr. pr. måned") | the status, as the table's Status |
  | Shop | "Butik" | the clicked posting's amount (§2.6) | the clicked posting's date and, when it has a shop, its text (the bank's text) |

### 2.2 The boxes

Three boxes in a row, the first in the accent's soft colour:

| Kind | First box | Second | Third |
| --- | --- | --- | --- |
| Fixed expense or subscription | "I perioden · <the period's dates>", the net sum of its rows (§3) and "N posteringer" | "Om året", the amount per year | "Konto", the last payment's account, or "–" with none |
| Shop | "I perioden · <the period's dates>", the net sum of its rows and "N posteringer" | "Konto", the clicked posting's account | "Kategori", the clicked posting's category, or `da.noCategory` with none |

The period's dates are written as the period field writes them.

### 2.3 The bars

- "Pr. <unit> i perioden" ("Pr. måned i perioden"), then one bar per unit of the period (`ctx.units`). A unit whose net
  sum is zero or less has no bar but keeps its place and label.
- The bars are drawn as the page draws its other bars; their heights are scaled to the biggest unit in the detail. Each
  bar has a text alternative with the unit and its net sum, as the Søjler card's bars do.

### 2.4 The list

- The rows of §3, newest first: the date, the account and the amount (§2.6).
- The clicked posting's row is marked as in §1.2. A detail opened from a Faste udgifter row marks none.
- At most 10 rows; with more, "Vis alle N" under the list shows the rest in place, and "Vis færre" goes back. It is not
  in the hash.
- With no rows in the period (a subscription not paid in it): "Ingen posteringer i perioden"; the first box shows
  0 kr. and the bars none.

### 2.5 The link

- "Åbn i Firefly III ↗" under the list, when `fireflyLinkUrl` is set: the bill for a subscription, the clicked posting
  for a shop. It opens in a new tab, as the links do now. Without `fireflyLinkUrl` there is no link.

### 2.6 One sign for the whole detail

Every amount in the detail, in the head, the boxes, the bars' text alternatives and the rows, is written as the boxes
and the key numbers write money: spending positive ("2.480,00 kr."), a refund with a minus. The head and the marked
row show the same text for the same posting.

## 3. What the numbers count

- **The span** is the period, also when a unit is chosen. The ticked accounts apply. The level, the search, the chosen
  shop, the sort, the amount filter and the object-group filter do not: the detail is about the whole fixed expense or
  shop.
- **A subscription's rows:** the postings in the span, on a ticked account, whose `subscription.id` is the
  subscription's id.
- **A shop's rows:** the postings in the span, on a ticked account, with the same `shop`; for a posting with no shop,
  those with no shop and the same `text`.
- **The sums** are net (refunds subtracted), as the Butikker card counts a shop. "N posteringer" counts the rows.
- The data is what `/api/data` already answered; the page fetches nothing new.

## 4. The data

- `Posting.subscription` gains `id`, the bill's id as Firefly III gives it: `{ id, name, objectGroup }`. The server
  sets it where it sets the name today. Nothing else in `/api/data` changes.

## 5. The hash

- **New key `detail`:** `s:<subscription id>` or `p:<posting id>`. Absent is no detail. `toHash` writes it last.
- **Where it resolves** (anything else is left out in `normalise`, as an unknown value is,
  [D20](../../decisions.md)):
  - `s:<id>` on the overview with `card=subscriptions`, when the id is one of `data.subscriptions`; the accounts do not
    matter;
  - `p:<id>` on the overview with `card=postings`, and on Alle posteringer, when the posting is in the answer, within
    the period and on a ticked account; with `card=subscriptions` only when, besides, the posting's subscription is one
    of `data.subscriptions`.
- **History:**
  - opening a detail when none is open adds a history entry, as choosing a card does;
  - a click on another row while one is open replaces the entry;
  - the entry an open pushes, or a row click replaces, is marked in `history.state`; closing goes back one entry when the
    current entry still carries that mark, so Back after closing does not reopen the detail. Otherwise (a later choice
    pushed or replaced the entry, or the detail came from a link or a reload) closing replaces the current entry with
    the same state without `detail`.
- **Other choices:** the period, the grouping, the accounts and the level keep the detail while it resolves, and
  leave it out when it no longer does. The chosen unit, the search, the chosen shop, the sort, `min`/`max` and `og`
  keep it: the detail ignores them (§3), even when the marked row is no longer in the list. Changing the card or the
  screen closes it.

## 6. Tests

By role, accessible name and text, made-up data only (hard rule 5).

- **Server:** a posting linked to a bill with an object group carries the bill's id, name and object group; one with
  none carries `null`.
- **Integration** (`addon/server/test-integration/firefly.test.ts`): the bill links on postings are compared with the
  fake's by name and object group, ids apart, as the test's bill comparison already is; and each `subscription.id` is
  the id of the bill with that name in `d.subscriptions`, which only the real Firefly III proves.
- **The model:** a subscription's rows, net sum and count in the period and the ticked accounts, not narrowed by the
  level, a chosen unit, the search, the shop or the filters; a shop's rows by shop, and by text when there is no shop;
  a refund lowers the sum and counts as a row; one bar per unit, none for a unit at zero or below; the context line
  with a main group, with Uden hovedgruppe and with no last payment; a posting whose bill is not in `subscriptions`
  opens the shop.
- **The hash:** `detail` round-trips and is written last; it is left out with an unknown id, on a card or screen that
  cannot show it, for a posting outside the period or on an unticked account; the default is absent.
- **The page:**
  - a Faste udgifter row's button opens the detail on the normal page and the focus is on its heading; "Tilbage til
    Faste udgifter" closes it and the focus is back on the row's button;
  - in full screen both the list and the detail are shown, the row is `aria-current`, another row changes the detail,
    and "Luk" closes it; turning full screen off and on keeps the detail;
  - Alle posteringer splits the same way;
  - a posting linked to a subscription opens the subscription; another opens its shop, with the clicked row marked; a
    posting with no shop opens the detail of its text;
  - the head and the marked row show the same amount text for one posting, a refund with a minus;
  - the head, the boxes' texts, the bars' text alternatives and the rows for each kind; "–" for no last payment; "Vis
    alle N" and "Vis færre"; "Ingen posteringer i perioden";
  - "Åbn i Firefly III" with and without `fireflyLinkUrl`;
  - Escape closes the detail and not full screen, and does nothing to it while a dropdown is open;
  - two row clicks then Back shows the list; ✕ then Back does not reopen the detail; a reload with `detail` opens it;
    open, change the level, then close: the level stays and the detail is closed; changing the card closes it; unticking
    the posting's account closes a shop's detail;
  - the period and the accounts change the sums; the search does not.

The Chrome check ([`testing.md`](../../testing.md)): the detail of a fixed expense, a subscription and a shop on the
normal page, in full screen and on Alle posteringer, at 1440, 1728 and 420 px.

## 7. Docs in the same PR

- `docs/decisions.md`: D44, the open detail is in the hash under `detail`, written last, on the overview's Posteringer
  and Faste udgifter cards and on Alle posteringer (§5); D20's status becomes "active; key list superseded by D35, D42
  and D44".
- `docs/domain-language.md`: a row for the detail (*detalje*), `Posting.subscription` with its id, and D44 beside D20,
  D35 and D42 in the line about the hash keys.
- `docs/architecture.md`: "What exists now" gains the detail.
- `addon/DOCS.md`: a click on a fixed expense or a posting shows its detail, under The page; the lines on
  `firefly_link_url` say the detail's link opens the posting or the fixed expense in Firefly III, and that without it
  the detail has no link.
- `addon/translations/en.yaml` and `da.yaml`: the `firefly_link_url` description says the same.
- `docs/mockups/README.md`: a section for `v5/`, the detail.
- `docs/testing.md`: the screens of §6's Chrome check.
- `docs/README.md`: this spec and its plan in the lists.

## 8. What is left to the builder

The detail's exact look within the page's styles and [the mockups](../../mockups/v5/detalje.html) (the context line,
the heading, the big amount, three boxes, the bars, the rows, the link). Where a mockup and this spec differ (mockup
3's "Mærker" box, its context line and its minus on the head's amount, the boxes' "betalinger"), the spec holds. How
the code is split between a model function, the detail component and the layouts. How the two columns share the
width (the mockups give the list about 60 %).
