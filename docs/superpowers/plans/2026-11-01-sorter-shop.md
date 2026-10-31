# The sorter sets a posting's shop – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [sorter's shop spec](../specs/2026-11-01-sorter-shop.md), in one PR that closes #43.

**Architecture:** the server's sorter only. The name rules in a new `addon/server/src/sorter/shop.ts`; the account
reads and the two tools' changes in `addon/server/src/sorter/tools.ts`. The fake Firefly III in `addon/dev` learns
accounts of every type and a destination on a PUT. Nothing on the page or in shared.

**Tech stack:** TypeScript, Hono, Vitest; the fake Firefly III (`@ha-spending/dev`); a real Firefly III 6.7.9 in Docker
through `scripts/integration`.

## Global constraints

- `CLAUDE.md` hard rules 2, 5 to 7: made-up data; tests through the MCP endpoint's answers and the fake's state; English
  code; comments only for why.
- No shop name in a log line, a `ToolFailure` detail or `summary()`; shop outcomes are counted by code.
- Sorting by code point: compare with a function over `Array.from(name)` and `codePointAt`, never the default
  `sort()`.
- The gates in `CLAUDE.md` pass before every commit.

## Review focus

1. **A liability's name as a shop** is `name-taken` and writes nothing to the destination. Test in Task 3.
2. **"Café" in NFC and NFD** in two assignments of one call give one account. Test in Task 3.
3. **A name of 60 code points with an emoji** passes; 61 is refused; a lone surrogate is refused. Test in Task 2.
4. **`shops` at its cap**: names past 12,000 code points are left out and `shops_more` is `true`. Test in Task 3.
5. **A split group**: only the assigned split's destination changes. Test in Task 3.

---

## Task 1: the fake Firefly III keeps every account and writes a destination

Model: sonnet · Review: yes

**Files:** `addon/dev/src/fake.ts`, `addon/dev/src/seed-types.ts`, `addon/dev/test/fake.test.ts`.

**Produces:**
- `SeedData.otherAccounts?: { name: string; type: "expense" | "revenue" | "liabilities"; active: boolean }[]`, accounts
  no transaction names (a liability, an inactive expense account).
- `GET /api/v1/accounts?type=all|asset|expense|revenue|liabilities` lists accounts of that type (no `type`: asset, as
  today), paged, each `{id, attributes: {name, type, active, currency_code}}`, `type` in Firefly III's short form
  (`asset`, `expense`, `revenue`, `liabilities`); a split's expense and revenue accounts are listed too.
- A PUT split entry may carry `destination_id` (an existing expense account's id, else 422) or `destination_name` (finds
  the expense account of exactly that name, or makes one); it sets the split's `destination_id` and `destination_name`.

- [ ] Tests first, run to fail: `lists expense accounts, also those only a split names`; `lists every type with
  type=all`; `a PUT with destination_name makes an expense account, and a second reuses it`; `a PUT with destination_id
  moves the split`; `a PUT with an unknown destination_id is 422`.
- [ ] Implement; run; pass; gates; commit `test: the fake Firefly III keeps every account and writes a destination`.

## Task 2: the shop's name

Model: sonnet · Review: yes

**Files:** create `addon/server/src/sorter/shop.ts`, `addon/server/test/shop.test.ts`.

**Produces:**
- `NO_SHOP = "(no name)"`, `SHOP_LIMIT = 60`.
- `cleanShop(raw: string): string | null`: NFC, trimmed; `null` when empty, over 60 code points, holding a character
  of `\p{Cc}`, `\p{Cf}`, `\p{Zl}`, `\p{Zp}` or `\p{Cs}`, or equal to `(no name)` ignoring case.
- `sameShop(a: string): string`: the key for "the same name", `a.toLocaleLowerCase("und")` of a cleaned name.
- `byCodePoint(a: string, b: string): number`.

- [ ] Tests first, run to fail: trimmed and NFC (`"Café "` gives `"Café"`); refused: `""`, `"   "`,
  `"a\nb"`, `"a‮b"`, `"a​b"`, `"a b"`, a lone `"\uD800"`, 61 code points, `"(NO NAME)"`; 60 code points
  ending in an emoji pass; `byCodePoint` puts `"\u{1F600}"` after `"�"`.
- [ ] Implement; run; pass; gates; commit `feat: the rules for a shop's name`.

## Task 3: `start` gives the shops, `set_category` writes the shop

Model: opus · Review: yes

**Files:** `addon/server/src/sorter/tools.ts`, `addon/server/test/sorter-tools.test.ts`.

**Consumes:** Task 1's fake; Task 2's `cleanShop`, `sameShop`, `byCodePoint`, `NO_SHOP`.

**Produces:**
- `readAccounts(client, settings, signal): Promise<AccountInfo[]>`, `AccountInfo = {id: string, name: string, type:
  string, active: boolean}`, every page of `accounts?type=all`.
- `SHOPS_LIMIT = 12000` (code points). `start`'s ok answer `{ok, postings, more, shops, shops_more}` as spec §2.
- Assignment `shop?: string` in the schema; a non-string is `bad-arguments`.
- `AssignmentResult` written: `{posting_id, ok: true, shop?: string, shop_refused?: ShopRefusal}`,
  `ShopRefusal = "not-withdrawal" | "has-shop" | "bad-shop-name" | "name-taken"`, checked in that order (spec §3).
- In `assign`, the PUT's split entry adds `destination_id` (an existing account, exact match first, then the first
  same-name in code-point order) or `destination_name` (a new one, then added to the call's list).
- Both tools' descriptions as spec §5; the comment on `apply_rules` names the destination too.

- [ ] Tests first, run to fail, each reading Firefly III back through the fake as the file does today:
  - `start` answers the active expense names, cleaned, sorted by code point, without `(no name)` or a refused name,
    over several pages; cut at 12,000 code points with `shops_more: true`; `shops_more: false` when all fit; no `shops`
    with `ok: false`.
  - one test per row of spec §3's table, a liability's name and an inactive expense account's name among
    `name-taken`; the category is written in each.
  - a withdrawal on `(no name)` gets the shop, and the result echoes it; an exact match and a case match write the
    existing account's id and echo its spelling; two existing accounts differing in case: the exact one, else the first
    by code point.
  - two assignments in one call with `"Ny butik"` and `"NY BUTIK"`: one new account; `"Café"` in NFC and NFD: one.
  - a `shop` of `null` or `5`: `bad-arguments`, nothing written; a `shop` of `"(no name)"`: `bad-shop-name`.
  - a split group: only the assigned split's destination changes.
  - an assignment without `shop` writes as before, with no `shop` or `shop_refused` in its result.
  - no log line holds a shop name.
- [ ] Implement; run; pass; gates; commit `feat: the sorter sets a posting's shop`.

## Task 4: the real Firefly III, the docs and D32

Model: sonnet · Review: yes

**Files:** `addon/server/test-integration/firefly.test.ts`, `addon/DOCS.md`, `.claude/agents/reviewer.md`,
`docs/decisions.md`.

- [ ] Integration test: `set_category with a shop makes the expense account, a second posting with the same shop
  reuses it, and the amount, date, source account, type, category, tags, notes and the other split stay`. Run
  `scripts/integration`; pass. If Firefly III differs from the fake, change the fake and the code to match it, and say
  so in the report.
- [ ] DOCS.md and `reviewer.md` as spec §5; D32 in the log's format, and D30's status `active; what is written
  superseded by D32`.
- [ ] Gates and the link check; commit `docs: the sorter's shop in DOCS.md and D32`.
