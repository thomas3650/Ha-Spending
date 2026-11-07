# HA Spending

The HA Spending app shows a household's spending from Firefly III on a page in Home Assistant. The page shows the
spending of a period as main groups, then categories, then postings. The page writes nothing to Firefly III. An optional
endpoint lets an AI sorter in another app set the category, and the shop, of new postings, and a household's chat
assistant read postings and spending and move a posting to another category, within fixed limits (see *The sorter's
endpoint* below).

## Installation

1. In Home Assistant go to *Settings → Apps → Install app → ⋮ → Repositories* and add
   `https://github.com/thomas3650/Ha-Spending`.
2. Install the *HA Spending* app and start it.
3. On the app's page turn on *Show in sidebar*. The page is then *Forbrug* in the sidebar. You can also open it with
   *Open web UI*.

## Configuration

| Option | What it is |
| --- | --- |
| `firefly_url` | Firefly III's address as the app reaches it. Required. |
| `firefly_token` | A Personal Access Token from Firefly III (*Options → Profile → OAuth*). The page reads with it; only the sorter's endpoint writes with it. Required. |
| `firefly_link_url` | Firefly III's address as your browser reaches it. When set, the detail of a posting or a fixed expense links there. Optional. |
| `main_group_rule_group` | The Firefly III rule group whose rules put categories into main groups. Default `Hovedgrupper`. |
| `excluded_main_groups` | Main groups that are not spending, such as money moved in and out. Default `Penge ind og ud`. |
| `members` | The household's members, by name, for the *Til overs* view. Each name is a revenue account in Firefly III for the money paid in, and an expense account of the same name for the money paid back. Example: `Anna`, `Bo`. Default none, which leaves the view out. |
| `savings_categories` | The categories of money moved to or from savings. Example: `Opsparing`. Default none. |
| `credit_accounts` | The asset accounts that are credit lines. Example: `Kassekredit`. Default none. |
| `sorter_key` | The key of the sorter's endpoint (see *The sorter's endpoint* below), at least 32 characters, for example from `openssl rand -hex 32`. When empty, the endpoint is off. Optional. |
| `sorter_inbox_category` | The Firefly III category of postings still to be sorted. Default `Til sortering`. |
| `moved_tag` | The tag `move_posting` (see *The chat's tools* below) adds to every posting it moves. Default `moved-by-assistant`. |

The categories of the members' deposits, of the money paid back to them and of savings belong in an excluded main
group (`excluded_main_groups`), so that they are not counted as spending.

Without `firefly_url` and `firefly_token` the app stops and says so in its log, and so it does with a `sorter_key`
shorter than 32 characters.

## Network

The page is reached through Home Assistant only (Ingress), on port 8099, which refuses every request that does not
come through Home Assistant. The app reaches Firefly III at `firefly_url`, so that address must work from inside
Home Assistant.

When `sorter_key` is set, the app also listens on port 8100 for the sorter's endpoint. The app publishes no
port, so only other apps reach it, by the app's hostname on Home Assistant's internal network, and only with the
key.

## The page

The page is in Danish and has a light theme. It is made for a computer's screen; on a phone it opens, but it has no
layout of its own there, and a table can scroll sideways. Click a bar to choose a unit, a main group to see its
categories and a category to see its postings. The trail at the top of the page is the filter for the whole overview.
It names what is chosen, in the order period, unit, main group, category. The period is always there: press it to
change it. Right after it comes the unit step: a dashed "Måned" (or "År") button, or the chosen month with a cross.
Both open a list of the bars' months, or years, with their sums, so you can choose a month from the top as well as from a bar. A
unit, a main group and a category each have a cross that removes it; the cross on a main group removes its
category too. A main group or a category is also a button: press it to switch to another one at the same level. The
dashed button at the end of the trail offers the next level, so it is the way to choose a main group in full screen,
where there is no circle. "Alt forbrug" in the trail clears the unit, the main group and the category and keeps the
period, the accounts and the quick filter (see below). While the page loads, the trail leaves out the unit. If the rule group in `main_group_rule_group` does not exist, the page says so.

A click on a fixed expense or on a posting shows its detail: the sums, the bars and the postings. When
`firefly_link_url` is set, the detail has the link "Åbn i Firefly III", each posting's date links to it in Firefly III,
and a click on a posting's row opens it; without it the detail has no link.

The page also shows your Firefly III subscriptions, which it calls "Faste udgifter": a key number on the overview for
each object group with its payments in the period, and, in the fixed-expenses view, the tab "Alle faste udgifter" with
each subscription's amount, its cost per year and a status, grouped by main group with its category. The tab needs
subscriptions in Firefly III with their postings linked to them, for example by Firefly III's rules.

The tab lists the subscriptions that ran in the chosen time, so a past month shows what ran then. A subscription paid in
the time shows there too, even before its start date in Firefly III, as when it was made after its first payments. The
status is the one the subscription had then: "Betalt" with the date, "Ikke set" when a due date passed with no payment,
or "Næste" with the next date when neither a due date nor a payment fell in the time. Today's time reads "Forfalden" for
a few days after a due date and "Ikke set" after that, and "Forventes" while its start is in the future. A subscription
that has an end date in Firefly III reads "Sluttet" with that date, and shows only in the times up to its end: set an
end date in Firefly III to stop one. Its cost per year is greyed, with a tooltip, once it no longer counts in the sums.
An inactive subscription without an end date is left out. One with an end date shows up to its end, as an ended one.
Subscriptions last paid from a liability or into a main group in `excluded_main_groups` are left out too.

The tab shows only the subscriptions that are in an object group in Firefly III; one with no object group is left out.
Each row carries its object group's title, and the tab shows the cost per year of each object group. A posting that is
linked to a subscription carries the same mark, with the subscription's name as its tooltip, in the postings card.

The period step in the trail opens a menu with the presets, among them "Alt" from your earliest posting to today, and a
calendar. Click a start day and an end day, or type them in Fra and Til as `3.1.2024`, and press Vis. The page picks the
grouping from the period: a period of up to 24 months shows a bar for each month, and a longer one a bar for each year.

Click a column header to sort a table by it; click it again to reverse it. Sorted by date, the postings keep their
groups; sorted by another column they are one list. The first key number shows how many postings it covers, and
a click on that count opens the Posteringer card in full screen, with no quick filter.

The key number for an object group shows the payments of that group in the period, with the sum per month and the
number of subscriptions ("X stk."), which is the number of rows of the "Alle faste udgifter" tab for that group. With a
unit chosen it shows the payments in that unit, as "<group> i <unit>", with that number and no sum per month. The key
numbers are not buttons. Under each one, the link "Vis faste udgifter →" opens the fixed-expenses view.

Every page has the same bar over the cards. "Alt forbrug" in it is a link back to the overview on every other page. On
the *Til overs* page the accounts, the unit and the main group are greyed, since it covers all accounts and the whole
period, and a tooltip says so.

The fixed-expenses view shows what the fixed expenses cost per month, with that object group chosen in the first step
of the trail ("Alle faste udgifter" for all of them). The bars on the left are the months of the period, stacked by
main group, category or fixed expense, with the payments on the right. A payment already made is solid. A payment
still to come is a hatched estimate in the same colour, marked "ca.", and is the fixed expense's amount: the middle of
its amount range, or its latest payment when that has risen. "I år", "Denne måned" and "Alt" run on past today to the
end of the year, month or running unit, so they show the estimates; other periods show only what was paid. A fixed
expense that was not seen on its date is listed with no amount and is left out of every sum. Press a bar to see only
that month's payments. The right card has two tabs: "Poster i perioden", the payments, and "Alle faste udgifter". The overview's right card has the tabs Søjler, Posteringer and Butikker.

In the payments list a status is one word in the normal card: Betalt, Forventes, Forfalden or Ikke set, and the Dato
column holds the date. In full screen the status names its date, for example "Forventes 2. dec". Forfalden is red here and in the "Alle faste udgifter" tab. With one object group chosen the rows have no object-group
badge. With "Alle" the group is in the tooltip of a fixed expense's name and at the start of a year row's line. In the
bars a due estimate is its own hatched segment with a red outline, and the legend says "Skraveret: estimat" and "Rød
kant: forfalden".

Hover a bar to see each part's paid and estimated sums, and "I alt" with the two kept apart. A bar with more than ten
parts lists the nine biggest and folds the rest into "n andre".

Each of the two cards has the button "Fuld skærm: <card title>". It gives that card the page's whole width (the bars
also its height), and hides the other card and the key numbers. In the list's full screen the rows show the object-group
badge again. In full screen, Escape and the browser's Back button close full screen first and stay in the view; then
they leave the view, as does "Alt forbrug" in the trail (in one press). A very narrow window may scroll the list
sideways in full screen.

On the Posteringer card the quick filter sits over the list: a search field and the Beløb pill. The search matches the
text or a shop; the suggestions show each shop's count and sum. The Beløb pill offers four kinds: Omkring (the amount
plus or minus 20 %), Under, Over and Mellem (two amounts). Under and Over leave out the amount itself. The pill takes
Danish numbers such as `1000`, `1.000`, `1000,50`, `1.000,50` and `0,5`, and applies them on Enter or when you leave
it. The quick filter narrows the list only; the key numbers, the circle and the bars do not change. When it is set, the
line over the list says what it filters, and "Ryd" clears it.

The right card's choice "Butikker" lists the shops with the most spending, for what is chosen on the left: all
spending, a main group or a category. It shows the ten biggest, with "Vis alle" for the rest; a click on a shop's name
opens its postings. "Skjul" hides a shop, for example the rent, from this list on every level; "Vis skjulte" shows
the hidden shops again. Hiding changes nothing else on the page, and nothing in Firefly III. The app keeps the
hidden shops in a file in its `/data`, so they are the same on every device and are in Home Assistant's backups.

The button "Fuld skærm" in the right card's title gives that card the page's whole width; the same button or Escape
brings the circle and the key numbers back. The fixed-expenses view has its own full screen, per card, described
above. Full screen is a step in the browser's history, so Back leaves it. With a
posting open in full screen the list hides its Konto column, since the detail shows the account.

## The sorter's endpoint

For an AI agent that sorts new postings into a fixed set of categories, and for a household's chat assistant. The
sorter's tools are `start` and `set_category`; the chat's tools (see *The chat's tools* below) are `find_postings`,
`get_posting`, `spending` and `move_posting`. All six are on the same endpoint behind the same key, and the calling
app decides which agent may call which: the endpoint does not tell the sorter from the chat, so that separation
lives only in the calling app's gate. The Firefly III token stays in this app. The limits are in the app's
code, not in the agent's instructions. Behind a gate that gives the sorter only its two tools, a strange posting text
can at worst give a wrong category or a wrong shop, which may be a new expense or revenue account; an agent given
`move_posting` can also move a posting to a wrong category, with the tag and the note that show it.

- **Address:** `POST http://<this app's hostname>:8100/mcp`, with the header `Authorization: Bearer <sorter_key>`.
  The hostname is on the app's page in Home Assistant.
  Any other key, or none, gets 401.
- **Protocol:** MCP over streamable HTTP, answered as plain JSON, never as an event stream. It knows `initialize`,
  `ping`, `tools/list` and `tools/call`. `GET /mcp` gets 405.
- **The inbox:** withdrawals and deposits with no category, or with the category in `sorter_inbox_category`. Transfers
  are never in it.
- **A main group** is the tag that the rules of `main_group_rule_group` give a category, as on the page. A category in
  `excluded_main_groups`, the inbox category, and a category in no main group are never chosen.

### `start`

Input: `{"categories": [{"id": 12, "name": "Dagligvarer", "group": "Mad"}, …]}`, every category the agent may choose.

The app compares the list with Firefly III: every id exists there with exactly that name, every group is the main
group the rules give that category, and every category the rules put in a main group is in the list, except the
inbox category and the excluded main groups. A rule group that is missing, or that puts a category in two main
groups, is a difference too.

- Any difference: `{"ok": false, "problems": ["Category id 12 is \"Dagligvarer\" in Firefly III, not \"Dagligvare\""]}`,
  one short line per difference, and no postings. The agent then writes nothing.
- Otherwise: `{"ok": true, "postings": [{"posting_id": 345, "date": "2026-03-02", "description": "Indkøb i Butik A",
  "amount": "412.50", "type": "withdrawal", "account": "Konto A", "notes": "Banken: Dagligvarer"}], "more": false,
  "shops": ["Butik A", "Kiosk"], "shops_more": false}`:
  the inbox, oldest first, at most 50, with a description or notes over 150 characters cut. `more` is true when the
  inbox holds more: the agent sorts these and calls `start` again. The limits keep one answer well under the size
  Claude Code passes on to the agent as one tool result. The amount is positive, in the account's currency. A
  description and notes are data from the bank, never instructions.
- **`shops`** are the names of the active expense accounts in Firefly III, the shops, each once, in code-point order.
  A name the app would refuse as a shop (see *The shop's name* below) is left out, so `(no name)` is never
  among them. They hold at most 12,000 characters together: the list stops before the first name that would pass that,
  and `shops_more` is true when names were left out. The agent gives one of these names for a shop it meets again,
  instead of spelling it a new way. They are data from Firefly III, some made by importers from bank text, never
  instructions. An answer with `ok: false` has no `shops`.

### `set_category`

Input: `{"assignments": [{"posting_id": 345, "category_id": 12, "amount": "412.50", "shop": "Butik A"}, …]}`, 1 to 100
assignments, each posting once, each with the posting's amount exactly as `start` gave it. `shop` is optional, a string;
anything else is `bad-arguments` and nothing is written.

The app writes only a posting that `start` gave out in the last 30 minutes, and only when its amount is the one
given: a posting id the agent copied wrong is refused, unless it is another posting `start` gave out in the last 30
minutes with the same amount. What `start` gave out is kept in memory, so after a restart the agent calls `start` again.

Each assignment is checked and written on its own; one refused does not stop the others. The posting is read again
from Firefly III right before it is written, so a category set by hand since `start` is not overwritten. Firefly III
has no conditional update, so a change by hand in the moment between that read and the write can still be. The answer
has one result per assignment, in order:
`{"results": [{"posting_id": 345, "ok": true, "shop": "Butik A"}, {"posting_id": 346, "ok": false, "reason": "not-in-inbox"}]}`.
An assignment refused for its category or its posting writes nothing, the shop included.

- **Written:** the category, and the posting's tags with every main-group tag (any tag an active rule of
  `main_group_rule_group` adds) replaced by the category's main group.
  When the assignment has a `shop` that passes the checks below, also the shop's account, named by its id: on a
  withdrawal, a purchase, the destination becomes the shop's expense account; on a deposit, a refund, the source
  becomes the shop's revenue account. Every other tag, the amount, the date, the other account, the type, the
  description, the notes and every other split stay as they are. Firefly III's rules do not run on the write.
- **The shop's result:** written with the shop, `{"posting_id": 345, "ok": true, "shop": "Butik A"}`, the name as
  written, which may be an existing account's spelling; written with the shop refused,
  `{"posting_id": 346, "ok": true, "shop_refused": "has-shop"}`, the category written all the same; written with no
  `shop` given, `{"posting_id": 347, "ok": true}`.
- **Refused, with the reason:** `unknown-category`, `inbox-category`, `no-main-group`, `ambiguous-main-group` (the
  rules put it in two main groups), `excluded-main-group`, `not-given-out` (not in a `start` answer of the last 30
  minutes, or already written since; checked before the posting is read), `unknown-posting`, `transfer`,
  `not-withdrawal-or-deposit`, `not-in-inbox`, `amount-mismatch` (the amount, or whether it is a withdrawal or a
  deposit, is not the one `start` gave).
- **`shop_refused`**, checked in this order after the category and the posting pass; the first that fails is the reason:
  `not-withdrawal` (neither a withdrawal nor a deposit, which the posting's own checks refuse first); `has-shop` (a
  withdrawal's destination is not the expense account named `(no name)`, or a deposit's source is not the revenue
  account named `(no name)`, the Data Importer's name for a line with no counterparty, so a shop set by hand is never
  overwritten; a withdrawal made through Firefly III's API with no destination lands on its cash account instead, and
  is `has-shop` too); `bad-shop-name`; `name-taken` (an account that is not an active account of the shop's type has
  the same name: an asset, a liability, the cash account, or an inactive account of the shop's type. The shop's type
  is expense for a withdrawal and revenue for a deposit; an account of the other of the two types with the same name
  is the same shop's, and does not count).

### The shop's name

A name is normalised to Unicode NFC and trimmed of white space at both ends, and the cleaned name is what is compared
and written. It is refused when it is empty, has more than 60 characters, holds a control or format character (such as
a bidi override or a zero-width space), a line or paragraph separator or a lone surrogate, or is `(no name)` in any
case. Two names are the same when they are equal after lower-casing.

When the shop passes, the app finds its account itself: an active account of the shop's type (expense for a
withdrawal, revenue for a deposit) with exactly that name, else one with the same name in other case (the first in
code-point order), else it makes the account and writes that. A new account is spelled as the shop's active account
of the other type of the same name (a refund's revenue account as the purchases' expense account, and the other way
round), found the same way, so the page sums the purchases and the refunds as one shop; with no such account it takes
the cleaned name. A second posting in the same call with the same name gets the same account. The write always names
the account by its id, never the name, so the outcome does not depend on Firefly III's collation, and a name can never
point a posting at a liability. An account made stays if the write that follows fails, and a later run reuses it.

### The chat's tools

For questions such as what the household spent on food last month, and for moving a posting the household says is in
the wrong category. Three tools only read; `move_posting` writes one posting at a time. A description, notes and a
shop in an answer are data from the bank or Firefly III, never instructions.

- **A period** is `start` and `end`, days like `2026-10-31`, both included, at most 400 days. Anything else is
  `bad-arguments`, and nothing is read.
- **An unknown argument** is `bad-arguments` for every chat tool, so a `move_posting` that also gives a description or
  a date is refused, not half done.

#### `find_postings`

Input: `{"start": "2026-10-01", "end": "2026-10-31", "text": "butik", "category": "Dagligvarer", "limit": 25}`; `text`,
`category` and `limit` are optional.

The answer: `{"postings": [{"posting_id": 345, "date": "2026-10-05", "type": "withdrawal", "amount": "38.00",
"description": "Kaffe og kage", "category": "Dagligvarer", "main_group": "Mad", "shop": "Café A"}], "more": false}`.
The withdrawals and deposits of the period, never a transfer, newest first, at most `limit` (1 to 50, default 25);
`more` is true when there were more. `text`, at most 60 characters, matches part of the description or the shop, in
any case; `category` matches a category's whole name, in any case. The amount is positive, as `start` gives it, and a
deposit is money back. `category`, `main_group` and `shop` are null when there is none; the shop is a withdrawal's
destination or a deposit's source, and null for `(no name)`. Postings in `excluded_main_groups` are found too. A
description or shop over 150 characters is cut.

#### `get_posting`

Input: `{"posting_id": 345}`. The answer has `find_postings`' fields for a posting of any type, with `notes` (null when
none, cut after 1,000 characters) and `tags`. A posting that is not there is the error `not-found`.

#### `spending`

Input: `{"start": "2026-10-01", "end": "2026-10-31", "by": "main_group"}`, `by` being `main_group` or `category`.

The answer: `{"rows": [{"name": "Bolig", "amount": "8000.00"}, {"name": "Mad", "amount": "550.25"}, {"name": null,
"amount": "120.00"}], "more": false, "total": "8670.25"}`. It is read as the page reads the period: withdrawals less
the deposits with a category, without transfers and without `excluded_main_groups`. The rows are the largest first,
at most 50; `more` is true when there were more, and `total` is always of every row. `name` is null for postings
with no category, or, by main group, a category in no main group. An amount is negative when more came back than was
spent.

#### `move_posting`

Input: `{"posting_id": 345, "amount": "38.00", "category_id": 13, "reason": "Det var en café"}`, the amount exactly as
`find_postings` or `get_posting` gave it, and the reason in the household's words: 1 to 300 characters after trimming,
one line, with no control or format character.

The posting is read again right before it is written. The answer is
`{"ok": true, "from": "Dagligvarer", "to": "Café"}`, the old and the new category's names; the old one is
`(no category)` when it had none.

- **Written,** in one update of the posting with Firefly III's rules off: the category; the tags, with every
  main-group tag replaced by the new category's main group, as `set_category` does, and `moved_tag` added once; and
  the notes with one line added at the end, `2026-11-01: Dagligvarer → Café. Det var en café`, the date being the
  app's today. The amount, the date, the accounts, the type, the description, the shop and every other field stay.
- **Refused,** as the error with nothing written, checked in this order: `bad-arguments`; `unknown-category`, with a
  `reason` (`unknown-category`, `inbox-category`, `no-main-group` or `ambiguous-main-group`, as for `set_category`);
  `excluded` (the category's main group is in `excluded_main_groups`); `not-found`; `transfer`;
  `not-withdrawal-or-deposit`; `split` (the posting is a part of a group of several, which the household changes in
  Firefly III itself); `excluded` (the main group of the posting's own category is in `excluded_main_groups`);
  `amount-mismatch`; `same-category`.

### Errors

A tool error (`isError: true`) answers `{"error": "<code>"}` and writes nothing more. Besides the chat's refusals
above:

- `bad-arguments`, with a `reason`: the input has the wrong shape; for `set_category` also an empty list, more than
  100 assignments, a posting given twice, or an assignment without an amount like `412.50`; for the chat's tools also
  the cases above. Nothing is written.
- `unreachable` or `refused`: Firefly III did not answer, or refused the token. For `set_category` the answer also has
  the `results` of the assignments before the failure, which may be none; the ones after it are not tried. In that
  answer a result written with a shop leaves out the `shop` name, because no shop name appears in a failure's detail,
  and keeps `shop_refused`: there `{"posting_id": 345, "ok": true}` can also mean written with a shop. A refused new
  account (Firefly III answers 422) is `unreachable` too.

## Support

Report problems at <https://github.com/thomas3650/Ha-Spending/issues>.
