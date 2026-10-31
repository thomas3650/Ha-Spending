# The sorter sets a posting's shop – design

**Real Home Assistant:** no change there from this work beyond installing the release, through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option.

**Issue:** #43. Store suggestions in the search are #40, which reads what this writes.

**Status:** approved by Thomas on 2026-10-31, as part of the house's design of the shop on every posting, which this
endpoint change serves.

Firefly III keeps a withdrawal's shop as its destination, an expense account, and reports by it. Postings imported
from a bank file all land on one expense account, `(no name)`: the shop is only in the bank text, spelled many ways.
The AI sorter already reads each posting and works out the shop to choose the category. With this change it writes
the shop too, through the same endpoint and within limits in this add-on's code. The contract is in
[`addon/DOCS.md`](../../../addon/DOCS.md#the-sorters-endpoint); this spec says what changes in it.

## 1. `start` gives the shops

The ok answer gains `shops`: the names of every expense account in Firefly III, except `(no name)`, sorted and each
once:

`{"ok": true, "postings": [...], "more": false, "shops": ["Butik A", "Kiosk"]}`

- Every page of the accounts is read.
- The agent reuses one of these names for a shop it meets again, instead of spelling it a new way.
- An answer with `ok: false` has no `shops`, as it has no postings.

## 2. `set_category` writes the shop

An assignment may carry `shop`, a name:
`{"posting_id": 345, "category_id": 12, "amount": "412.50", "shop": "Butik A"}`. Without `shop` nothing changes from
today.

The category is checked and written as today. The shop is written in the same PUT, as the split's
`destination_name`, when all of these hold:

- the posting is a withdrawal;
- its destination is `(no name)`, so a shop set by hand is never overwritten;
- the name, trimmed, is not empty, has no control character, and has at most 60 code points.

Firefly III reuses the expense account of that name, or makes one ("For everything except transfers, the account will
be auto-generated if unknown"). When an expense account exists whose name differs only in case, its own name is
written instead, so one shop does not become two accounts.

When the shop does not pass, the category is still written and the result says why, beside `ok`:

`{"posting_id": 346, "ok": true, "shop": "has-shop"}`

| `shop` | When |
|---|---|
| `not-withdrawal` | The posting is a deposit. |
| `has-shop` | The destination is not `(no name)`. |
| `bad-shop-name` | Empty after trimming, a control character, or over 60 code points. |

A refused assignment (`ok: false`) writes nothing, the shop included, as today.

What is written, in full: the category, the tags as today, and the destination's name when the shop passes. The
amount, the date, the source account, the description, the notes and every other split stay as they are. Firefly
III's rules do not run on the write.

## 3. Tests

- The fake Firefly III in `addon/dev` accepts `destination_name` on a PUT and finds or makes the expense account, as
  Firefly III does, and lists accounts by type.
- Unit tests through the MCP endpoint, as the sorter's tests are today: each row of the table above; a shop written on
  a withdrawal on `(no name)`; the case match; a split group where only the assigned split's destination changes; 60
  code points with an emoji written and 61 refused; `start`'s `shops` over several pages, without `(no name)`.
- An integration test on the real Firefly III in Docker: a shop makes its expense account, a second posting with the
  same shop reuses it, and the amount, date, notes and the other split stay.

## 4. Decision

D32 records the shop write: withdrawals only, `(no name)` only, the name check, the case match. D30's list of what is
written is then active with that part superseded by D32.
