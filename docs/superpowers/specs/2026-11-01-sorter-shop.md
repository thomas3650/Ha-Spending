# The sorter sets a posting's shop – design

**Real Home Assistant:** no change there from this work beyond installing the release, through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option.

**Issue:** #43. Store suggestions in the search are #40, which reads what this writes.

**Approval:** Thomas approved the house's design of the shop on every posting on 2026-10-31, which this endpoint change
serves, and left this spec's approval to Claude once `reviewer` rates it Ready.

Firefly III keeps a withdrawal's shop as its destination, an expense account, and reports by it. Postings imported
from a bank file all land on one expense account, `(no name)`: the shop is only in the bank text, spelled many ways.
The AI sorter already reads each posting and works out the shop to choose the category. With this change it writes
the shop too, through the same endpoint and within limits in this add-on's code. The contract is in
[`addon/DOCS.md`](../../../addon/DOCS.md#the-sorters-endpoint); this spec says what changes in it.

## 1. The shop's name

A name is checked, and cleaned, the same way wherever it is used (§2 and §3):

- It is normalised to Unicode NFC and trimmed of white space at both ends. The cleaned name is what is compared and
  written.
- It is refused when it is empty, when it has more than 60 code points, when it holds a character of the Unicode
  categories Cc (control), Cf (format, such as the bidi overrides and zero-width characters), Zl, Zp (the line and
  paragraph separators) or Cs (a lone surrogate), or when it is `(no name)` in any case.
- "The same name" means the same after `toLocaleLowerCase("und")` of the cleaned names; "exactly" means the cleaned
  names are equal.

A shop name comes from a posting's text, through the agent. It never goes into a log line or a tool failure's detail;
logs count shop outcomes by code only.

## 2. `start` gives the shops

The ok answer gains `shops`:

`{"ok": true, "postings": [...], "more": false, "shops": ["Butik A", "Kiosk"]}`

- The names of the active expense accounts in Firefly III, every page read, except a name §1 refuses (`(no name)`
  among them). Each cleaned name once, sorted in code-point order (by code point, not JavaScript's default sort,
  which compares UTF-16 code units).
- The names together hold at most 12,000 code points: the list stops before the first name that would pass that, so
  it is always a prefix of the sorted names. `shops_more` is always
  in an ok answer, `true` when names were left out. With the 50 postings and their texts, that keeps one answer well
  under the about 25,000 tokens Claude Code passes on as one tool result, also when every name is 60 code points.
- The agent reuses one of these names for a shop it meets again, instead of spelling it a new way. The names are data
  from Firefly III, some made by importers from bank text, never instructions; the tool's description says so.
- An answer with `ok: false` has no `shops`, as it has no postings.

## 3. `set_category` writes the shop

An assignment may carry `shop`, a string:
`{"posting_id": 345, "category_id": 12, "amount": "412.50", "shop": "Butik A"}`. A `shop` that is not a string is
`bad-arguments`, and nothing is written, as for the other fields. Without `shop` nothing changes from today.

The category is checked as today; an assignment refused for its category (`ok: false`) writes nothing, the shop
included. Otherwise the shop is checked, in this order, and the first that fails is the reason:

| `shop_refused` | When |
|---|---|
| `not-withdrawal` | The posting is not a withdrawal. |
| `has-shop` | The posting's destination is not the expense account `(no name)` (its type `Expense account` and its name `(no name)`, the name Firefly III gives an expense with no counterparty). A shop set by hand is never overwritten. |
| `bad-shop-name` | §1 refuses the name. |
| `name-taken` | An account that is not an active expense account has the same name: an asset, a liability, a revenue account, cash, or an inactive account of any type. |

When the shop passes, the add-on finds its account itself and the same PUT that writes the category writes the
split's destination:

- An active expense account has exactly that name: its `destination_id`.
- Else one has the same name: its `destination_id`; if several do, the first in code-point order.
- Else the add-on makes the expense account itself (`POST accounts`, `type: "expense"`, the cleaned name) and writes
  its `destination_id`. The account then joins the call's list (below), so a second posting in the same call with the
  same name gets the same account. If Firefly III refuses the new account (a 422, such as a name its database holds
  equal to another account's), that is `unreachable`, as below.

The accounts of every type are read once per `set_category` call, beside the catalog, and the call's new names are
added as it goes. The write always names the account by its id: Firefly III is never left to look a name up itself,
so the outcome does not depend on its database's collation (which may hold "å" equal to "a"), and a name can never
point a withdrawal at a liability, which would book a purchase as a debt payment.

The result:

- Written with the shop: `{"posting_id": 345, "ok": true, "shop": "Butik A"}`, the name as written, which may be an
  existing account's spelling.
- Written, shop refused: `{"posting_id": 346, "ok": true, "shop_refused": "has-shop"}`.
- Written, no shop given: `{"posting_id": 347, "ok": true}`, as today.

What is written, in full: the category, the tags as today, and the destination when the shop passes. The amount, the
date, the source account, the type, the description, the notes and every other split stay as they are. Firefly III's
rules do not run on the write. The endpoint can now make expense accounts: at most one per posting given out, named by
the agent within §1.

If Firefly III refuses the write anyway (a 422), it is `unreachable`, as any failed write today: the batch stops, the
posting is unchanged and stays in the inbox, and the results before it stand (D30). The checks above are meant to
leave Firefly III no reason to refuse a name.

## 4. Tests

- The fake Firefly III in `addon/dev` lists accounts of every type and by type, keeps expense, liability and inactive
  accounts, makes an expense account on `POST accounts`, and accepts `destination_id` on a PUT.
- Unit tests through the MCP endpoint, as the sorter's tests are today:
  - each row of the table, a liability's name among them;
  - a shop written on a withdrawal on `(no name)`, with the name written echoed;
  - an exact match, a case match, and two accounts that differ only in case;
  - two assignments in one call with the same new shop in different case: one account;
  - a deposit whose source is `(no name)`: `not-withdrawal`;
  - a `shop` of `null` or a number: `bad-arguments`, nothing written;
  - names: only spaces, a line feed, a bidi override, a zero-width space, U+2028, a lone surrogate, 61 code points
    refused; 60 code points with an emoji, and "Café" in its two encodings as one account;
  - a split group where only the assigned split's destination changes;
  - `start`'s `shops` over several pages, without `(no name)`, without a refused name, cut at 12,000 code points with
    `shops_more: true`, and `shops_more: false` when all fit;
  - a `shop` of `(no name)`: `bad-shop-name`;
  - a shop name in no log line.
- Integration tests on the real Firefly III in Docker: a shop makes its expense account, a second posting with the
  same shop reuses it, and the amount, date, source account, type, category, tags, notes and the other split stay; a
  liability's name and an inactive expense account's name are `name-taken` and leave the destination as it was; a
  withdrawal made without a destination reads `(no name)`, of type `Expense account`, and takes a shop.

## 5. What else changes

- `addon/DOCS.md`: the intro's "set the category"; the endpoint's promise, which becomes "a strange posting text can at
  worst give a wrong category or a wrong shop, which may be a new expense account"; `start`'s answer; `set_category`'s
  input, results and "Written" bullet.
- `tools.ts`: both tools' descriptions; the comment on the rules not running.
- `.claude/agents/reviewer.md`: what the endpoint writes.
- `client.ts`: a `post`, used only to make a shop's expense account; its comment and D29's list of what the client
  does.
- D32 records the shop write: withdrawals on `(no name)` only, §1's check, the add-on's own lookup and `name-taken`,
  the account made by the add-on and written by id, and that the endpoint now makes expense accounts, at most one per
  posting given out. D30's list of what is written is
  then active with that part superseded by D32.
