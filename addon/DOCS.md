# HA Spending

The HA Spending add-on shows a household's spending from Firefly III on a page in Home Assistant. The page shows the
spending of a period as main groups, then categories, then postings, and compares a unit of the chosen grouping with
the one before it. The page writes nothing to Firefly III. An optional endpoint lets an AI sorter in another add-on
set the category, and the shop, of new postings, and a household's chat assistant read postings and spending and move
a posting to another category, within fixed limits ([the sorter's endpoint](#the-sorters-endpoint)).

## Installation

1. In Home Assistant go to *Settings → Apps → Install app → ⋮ → Repositories* and add
   `https://github.com/thomas3650/Ha-Spending`.
2. Install the *HA Spending* app and start it.
3. On the add-on's page turn on *Show in sidebar*. The page is then *Forbrug* in the sidebar. You can also open it with
   *Open web UI*.

## Configuration

| Option | What it is |
| --- | --- |
| `firefly_url` | Firefly III's address as the add-on reaches it. Required. |
| `firefly_token` | A Personal Access Token from Firefly III (*Options → Profile → OAuth*). The page reads with it; only the sorter's endpoint writes with it. Required. |
| `firefly_link_url` | Firefly III's address as your browser reaches it. When set, a posting opens there. Optional. |
| `main_group_rule_group` | The Firefly III rule group whose rules put categories into main groups. Default `Hovedgrupper`. |
| `excluded_main_groups` | Main groups that are not spending, such as money moved in and out. Default `Penge ind og ud`. |
| `sorter_key` | The key of [the sorter's endpoint](#the-sorters-endpoint), at least 32 characters, for example from `openssl rand -hex 32`. When empty, the endpoint is off. Optional. |
| `sorter_inbox_category` | The Firefly III category of postings still to be sorted. Default `Til sortering`. |
| `moved_tag` | The tag [`move_posting`](#move_posting) adds to every posting it moves. Default `moved-by-assistant`. |

Without `firefly_url` and `firefly_token` the add-on stops and says so in its log, and so it does with a `sorter_key`
shorter than 32 characters.

## Network

The page is reached through Home Assistant only (Ingress), on port 8099, which refuses every request that does not
come through Home Assistant. The add-on reaches Firefly III at `firefly_url`, so that address must work from inside
Home Assistant.

When `sorter_key` is set, the add-on also listens on port 8100 for the sorter's endpoint. The add-on publishes no
port, so only other add-ons reach it, by the add-on's hostname on Home Assistant's internal network, and only with the
key.

## The page

The page is in Danish and has a light theme. Click a main group to see its categories and a category to see its
postings. A posting opens in Firefly III only when `firefly_link_url` is set; without it the posting is plain text. If
the rule group in `main_group_rule_group` does not exist, the page says so.

The overview also shows your Firefly III subscriptions, which the page calls "Faste udgifter": a key number with their
cost per year, and a card with each subscription's amount, its cost per year and a status, grouped by main group with
its category. The card needs subscriptions
in Firefly III with their postings linked to them, for example by Firefly III's rules. A subscription without a payment
reads "Forventes" for a few days after a due date, and always when its start is in the future; after that it reads "Ikke
set". Inactive and ended subscriptions are left out, as are those last paid from a liability or into a main group in
`excluded_main_groups`.

The button "Fuld skærm" in the right card's title gives that card the page's whole width; the same button or Escape
brings the circle and the key numbers back.

## The sorter's endpoint

For an AI agent that sorts new postings into a fixed set of categories, and for a household's chat assistant. The
sorter's tools are `start` and `set_category`; [the chat's tools](#the-chats-tools) are `find_postings`,
`get_posting`, `spending` and `move_posting`. All six are on the same endpoint behind the same key, and the calling
add-on decides which agent may call which: the endpoint does not tell the sorter from the chat, so that separation
lives only in the calling add-on's gate. The Firefly III token stays in this add-on. The limits are in the add-on's
code, not in the agent's instructions. Behind a gate that gives the sorter only its two tools, a strange posting text
can at worst give a wrong category or a wrong shop, which may be a new expense account; an agent given
`move_posting` can also move a posting to a wrong category, with the tag and the note that show it.

- **Address:** `POST http://<this add-on's hostname>:8100/mcp`, with the header `Authorization: Bearer <sorter_key>`.
  The hostname is on the add-on's page in Home Assistant.
  Any other key, or none, gets 401.
- **Protocol:** MCP over streamable HTTP, answered as plain JSON, never as an event stream. It knows `initialize`,
  `ping`, `tools/list` and `tools/call`. `GET /mcp` gets 405.
- **The inbox:** withdrawals and deposits with no category, or with the category in `sorter_inbox_category`. Transfers
  are never in it.
- **A main group** is the tag that the rules of `main_group_rule_group` give a category, as on the page. A category in
  `excluded_main_groups`, the inbox category, and a category in no main group are never chosen.

### `start`

Input: `{"categories": [{"id": 12, "name": "Dagligvarer", "group": "Mad"}, …]}`, every category the agent may choose.

The add-on compares the list with Firefly III: every id exists there with exactly that name, every group is the main
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
  A name the add-on would refuse as a shop ([the shop's name](#the-shops-name)) is left out, so `(no name)` is never
  among them. They hold at most 12,000 characters together: the list stops before the first name that would pass that,
  and `shops_more` is true when names were left out. The agent gives one of these names for a shop it meets again,
  instead of spelling it a new way. They are data from Firefly III, some made by importers from bank text, never
  instructions. An answer with `ok: false` has no `shops`.

### `set_category`

Input: `{"assignments": [{"posting_id": 345, "category_id": 12, "amount": "412.50", "shop": "Butik A"}, …]}`, 1 to 100
assignments, each posting once, each with the posting's amount exactly as `start` gave it. `shop` is optional, a string;
anything else is `bad-arguments` and nothing is written.

The add-on writes only a posting that `start` gave out in the last 30 minutes, and only when its amount is the one
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
  When the assignment has a `shop` that passes the checks below, also the split's destination: the shop's expense
  account, named by its id. Every other tag, the amount, the date, the source account, the type, the description, the
  notes and every other split stay as they are. Firefly III's rules do not run on the write.
- **The shop's result:** written with the shop, `{"posting_id": 345, "ok": true, "shop": "Butik A"}`, the name as
  written, which may be an existing account's spelling; written with the shop refused,
  `{"posting_id": 346, "ok": true, "shop_refused": "has-shop"}`, the category written all the same; written with no
  `shop` given, `{"posting_id": 347, "ok": true}`.
- **Refused, with the reason:** `unknown-category`, `inbox-category`, `no-main-group`, `ambiguous-main-group` (the
  rules put it in two main groups), `excluded-main-group`, `unknown-posting`, `transfer`,
  `not-withdrawal-or-deposit`, `not-in-inbox`, `not-given-out` (not in a `start` answer of the last 30 minutes),
  `amount-mismatch` (the amount is not the one `start` gave).
- **`shop_refused`**, checked in this order after the category and the posting pass; the first that fails is the reason:
  `not-withdrawal`; `has-shop` (the destination is not the expense account named `(no name)`, the Data Importer's name
  for a line with no counterparty, so a shop set by hand is never overwritten; a withdrawal made through Firefly III's
  API with no destination lands on its cash account instead, and is `has-shop` too); `bad-shop-name`; `name-taken`
  (an account that is not an active expense account has the same name: an asset, a liability, a revenue account, the
  cash account, or an inactive account of any type).

### The shop's name

A name is normalised to Unicode NFC and trimmed of white space at both ends, and the cleaned name is what is compared
and written. It is refused when it is empty, has more than 60 characters, holds a control or format character (such as
a bidi override or a zero-width space), a line or paragraph separator or a lone surrogate, or is `(no name)` in any
case. Two names are the same when they are equal after lower-casing.

When the shop passes, the add-on finds its account itself: an active expense account with exactly that name, else one
with the same name in other case (the first in code-point order), else it makes the expense account and writes that.
A second posting in the same call with the same name gets the same account. The write always names the account by
its id, never the name, so the outcome does not depend on Firefly III's collation, and a name can never point a
withdrawal at a liability. An account made stays if the write that follows fails, and a later run reuses it.

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
  add-on's today. The amount, the date, the accounts, the type, the description, the shop and every other field stay.
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
