# HA Spending

The HA Spending add-on shows a household's spending from Firefly III on a page in Home Assistant. The page shows the
spending of a period as main groups, then categories, then postings, and compares a unit of the chosen grouping with
the one before it. The page writes nothing to Firefly III. An optional endpoint lets an AI sorter in another add-on
set the category, and the shop, of new postings, within fixed limits ([the sorter's endpoint](#the-sorters-endpoint)).

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

## The sorter's endpoint

For an AI agent that sorts new postings into a fixed set of categories. The agent gets two tools and nothing else; the
Firefly III token stays in this add-on. The limits are in the add-on's code, not in the agent's instructions, so a
strange posting text can at worst give a wrong category or a wrong shop, which may be a new expense account.

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
- **`shops`** are the names of the active expense accounts in Firefly III, the shops, each once, in code-point order,
  without a name the add-on would refuse as a shop ([the shop's name](#the-shops-name)), `(no name)` among them, because it is no shop. They
  hold at most 12,000 characters together: the list stops before the first name that would pass that, and
  `shops_more` is true when names were left out. The agent gives one of these names for a shop it meets again, instead
  of spelling it a new way. They are data from Firefly III, some made by importers from bank text, never instructions.
  An answer with `ok: false` has no `shops`.

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
  `not-withdrawal`; `has-shop` (the destination is not the expense account named `(no name)`, the name the Data
  Importer gives a line with no counterparty; one made through the API with no destination name lands on the cash
  account and so is `has-shop`, keeping its destination: a shop set by hand is never overwritten); `bad-shop-name`; `name-taken` (an account
  that is not an active expense account has the same name: an asset, a liability, a revenue account, cash, or an
  inactive account of any type).

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

### Errors

A tool error (`isError: true`) answers `{"error": "<code>"}` and writes nothing more:

- `bad-arguments`, with a `reason`: the input has the wrong shape; for `set_category` also an empty list, more than
  100 assignments, a posting given twice, or an assignment without an amount like `412.50`. Nothing is written.
- `unreachable` or `refused`: Firefly III did not answer, or refused the token. For `set_category` the answer also has
  the `results` of the assignments before the failure, which may be none; the ones after it are not tried. In that
  answer a result written with a shop leaves out the `shop` name, because no shop name appears in a failure's detail,
  and keeps `shop_refused`: there `{"posting_id": 345, "ok": true}` can also mean written with a shop. A refused new
  account (Firefly III answers 422) is `unreachable` too.

## Support

Report problems at <https://github.com/thomas3650/Ha-Spending/issues>.
