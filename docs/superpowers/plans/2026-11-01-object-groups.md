# Faste udgifter by object group, and the mark on postings – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [object-groups spec](../specs/2026-11-01-object-groups.md), in one PR that closes #54.

**Architecture:** the server reads `object_group_title` on bills and `bill_id` on splits. It drops bills with no
object group before reading their last payment. It sets `Posting.subscription` from the full bill list. The page
renders one pill style for both, in the Faste udgifter card (with a yearly sum box per object group) and in the
posting rows. The fake Firefly III and both seeds gain the new fields, so tests, the fast loop and the integration
run see them.

**Tech stack:** TypeScript; Hono on Node (server); Lit with Vitest, happy-dom and Testing Library (page); the fake
in `addon/dev`.

## Global constraints

- `CLAUDE.md` hard rules 5 to 7: tests by role, accessible name and text; made-up data; English code; comments only
  for why.
- Names, exactly: `Subscription.objectGroup: string`; `Posting.subscription: { name: string; objectGroup: string } |
  null`; `WireBill.attributes.object_group_title: string | null`; `WireSplit.bill_id: string | null`;
  `SeedSubscription.objectGroup?: string`.
- "Has an object group" means `object_group_title` is a string with `trim() !== ""`. The title is kept as Firefly III
  gives it, untrimmed.
- The object groups' titles are data. No Danish object-group name appears in `addon/web/src` or `addon/server/src`.
- Amounts stay per year (`amountPerYear`, `kr`, `da.perYear`). No per-month amount anywhere.
- The gates in `CLAUDE.md` pass before every commit.

## Review focus

1. **A bill with an object group of only spaces:** dropped, as if null. Test in Task 2.
2. **A posting linked to a bill that is dropped from the card** (inactive, or ended before today): it keeps its mark.
   Test in Task 2 against `exampleSeed` (Avis and Gammel forsikring).
3. **A failed read of a dropped bill's last payment cannot happen:** no `transactions/{id}` request is made for it.
   Test in Task 2 by counting the fake's requests, or with a client whose read of that path throws.
4. **The pill does not change a link's accessible name**, in the card and in the posting rows. Tests in Tasks 3 and 4.
5. **The boxes follow the accounts:** choosing one account drops a box whose bills are all on another account. Test
   in Task 3.

---

## Task 1: The fake and the seeds

Model: sonnet · Review: yes

**Files:**
- Source: `addon/dev/src/seed-types.ts`, `addon/dev/src/fake.ts`, `addon/dev/src/example.ts`,
  `addon/dev/src/generate.ts`, `addon/dev/src/seed-firefly.ts`.
- Tests: `addon/dev/test/fake.test.ts`, `addon/dev/test/generate.test.ts`.
- Knock-ons: `addon/server/test/{read,data,subscriptions}.test.ts`, `addon/server/test-integration/firefly.test.ts`.

**Produces:**
- `SeedSubscription.objectGroup?: string`.
- The fake's `/api/v1/bills` answers `object_group_title` on each bill: the seed's `objectGroup`, else `null`.
- The fake's splits carry `bill_id` in `/api/v1/transactions`, `/api/v1/transactions/{id}` and
  `/api/v1/search/transactions`. It is the id of the bill the split's `subscription` names, else `null`.
  - The ids the fake hands out today do not change: assign `bill_id` after the bills are built.
- `seed-firefly.ts` sends `object_group_title` in the bill's POST body when the seed has `objectGroup`.
- `exampleSeed`:
  - Netflix and Fitness get `objectGroup: "Abonnementer"`.
  - Bilka gets no object group. Its linked split "Bilka mad" (Dagligvarer, Konto A, 2026-01-10) is a posting the page
    shows.
  - Every other bill gets `"Faste udgifter"`.
  - Two new linked withdrawals from Konto A, appended at the end of `transactions`, in R1 and in a month no test
    counts on: Avis on 2026-04-15 and Gammel forsikring on 2026-03-02. Choose the amounts. The category must be one
    whose main group is not excluded (not `Opsparing` or `Indskud`), for example `Streaming` and `Husleje`.
- `generateSeed`:
  - Netflix and Spotify get `"Abonnementer"`.
  - Havehjælp gets no object group.
  - Every other bill gets `"Faste udgifter"`.

**The knock-ons of the two new postings,** updated in this task so the gates and the integration run stay green.
Each one is named in the report. Check every count and sum again; do not trust this list alone.
- `addon/dev/test/fake.test.ts`:
  - the pagination totals (18; `total_pages` 4 and 6);
  - the type counts (13/4/2/19);
  - Avis's `paid_dates` (`toEqual([])`, about line 541), now the new payment when the window holds it.
- `addon/server/test/read.test.ts` and `addon/server/test/data.test.ts`: the posting count (13) and the total
  (1059958).
- `addon/server/test/client.test.ts` (about lines 99-100): the group count over all dates (20, now 22).
- `addon/server/test/subscriptions.test.ts`: the count in "reads one group per last payment". Avis and Gammel
  forsikring are still left out of `subscriptions` (inactive, ended), so the test at about line 108 holds.
- `addon/server/test-integration/firefly.test.ts`:
  - the posting count and the total (about lines 49-50, 125, 155);
  - the withdrawal count (about line 72);
  - the hand sums per main group and per account (about lines 92-113);
  - `pages` (about line 126).
  - It is not in the gates: run `scripts/integration` when Docker runs, else say so in the report.

- [ ] **Step 1: Write the failing tests:**
  - `fake.test.ts`:
    - `"answers a bill's object group, and null when the seed has none"`: Netflix's `object_group_title` is
      `"Abonnementer"`, Bilka's is `null`.
    - `"puts the bill's id on a linked split and null on others"`: the Husleje withdrawal's split has `bill_id` equal
      to the Husleje bill's id. The Kiosk split has `bill_id: null`. The same holds for a split read through
      `/api/v1/transactions/{id}`.
  - `generate.test.ts`: `"puts bills in both object groups and leaves one without"`.
- [ ] **Step 2: Run** `npm test --prefix addon -w dev`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the Produces list, then update the knock-ons.
- [ ] **Step 4: Run** the gates. They pass. Bills with no object group are still kept until Task 2.
- [ ] **Step 5: Commit** (`feat: object groups and bill links in the fake and the seeds`).

## Task 2: The server and the shared types

Model: opus · Review: yes

**Files:**
- Source: `addon/shared/src/types.ts`; `addon/server/src/firefly/{wire,subscriptions,normalise,read}.ts`.
- Tests: `addon/server/test/{subscriptions,data,read}.test.ts`, `addon/server/test-integration/firefly.test.ts`.
- Literals the type change breaks: `addon/shared/test/fixture.ts`, `addon/server/test/{app,sorter-tools}.test.ts`,
  `addon/web/test/fixture.ts`, `addon/web/test/{filter,overview,postings,all-postings,actions}.test.ts`.

**Consumes:** Task 1's fake and seeds.

**Produces:**
- `Subscription.objectGroup: string`.
- `Posting.subscription: { name: string; objectGroup: string } | null`.
- `readSubscriptions(...)` returns `{ kept: RawSubscription[]; bills: WireBill[] }`:
  - `kept` holds only the bills with an object group. No `transactions/{id}` is read for the others.
  - `bills` is every bill read, for the postings.
- `export function subscriptionLinks(bills: WireBill[]): (id: string | null) => Posting["subscription"]` in
  `subscriptions.ts`. It looks a bill up by id and gives `{ name, objectGroup }` when the bill has an object group,
  else `null`. An unknown id gives `null`, and so does a null id.
- `toPostings(groups, mainGroupOf, excluded, linkOf: (id: string | null) => Posting["subscription"])`. `read.ts`
  passes `subscriptionLinks(bills)`.
- In the web fixture, `SUBSCRIPTIONS` gets `objectGroup`:
  - Streaming: `"Abonnementer"`.
  - Husleje, Indboforsikring, Bilforsikring and Avis: `"Faste udgifter"`.
  - Every `Posting` literal gets `subscription: null`.

**The knock-ons in the existing tests,** updated here and named in the report:
- `subscriptions.test.ts`:
  - The `bill()` helper (about line 174) gains `object_group_title`. Default it to a title, so the existing
    `readSubscriptions` test keeps its bill.
  - That test destructures the new `{ kept, bills }` return.
  - The `split()` helper (about line 201) and other `WireSplit` literals gain `bill_id`.
  - "reads one group per last payment" no longer counts Bilka's read.
  - The kept list (about line 63) and Bilka's last payment (about line 90) change: Bilka is no longer kept. Move that
    last-payment check to a kept bill that still shows the same case, or drop it if another test already covers the
    case. Say which in the report.
- `firefly.test.ts`:
  - `byName` covers `objectGroup`.
  - Bilka leaves the subscriptions there too.

- [ ] **Step 1: Write the failing tests:**
  - `subscriptions.test.ts`:
    - `"leaves out a bill with no object group"`: Bilka is not in `subscriptions`. Bilka is kept today, so this test
      fails first.
    - `"leaves out a bill whose object group is only spaces"`: the `bill()` helper with `object_group_title: "  "`.
    - `"gives a bill its object group"`: Netflix's `objectGroup` is `"Abonnementer"`.
    - `"reads no last payment for a bill with no object group"`: the requests the client makes contain no
      `transactions/{id}` for Bilka's paid group.
    - `subscriptionLinks`:
      - `"links an id to its bill's name and object group"`;
      - `"gives null for a bill with no object group, an unknown id and a null id"`.
  - `data.test.ts`:
    - `"marks a posting linked to a bill with its name and object group"`: Husleje's posting has
      `subscription: { name: "Husleje", objectGroup: "Faste udgifter" }`.
    - `"marks a posting of an inactive bill and of an ended one"`: the new Avis and Gammel forsikring postings.
    - `"does not mark a posting of a bill with no object group"`: the "Bilka mad" posting has `subscription: null`.
    - `"does not mark an unlinked posting"`: Kiosk.
    - `"marks a refund linked to a bill"`: through `readSpendingData` with a fetch wrapper. The wrapper sets one
      refund split's `bill_id` to Husleje's bill id.
  - `firefly.test.ts`: `"gives the same bill links on postings as the fake does, ids apart"`.
    - It compares `postings.map(p => ({ text: p.text, date: p.date, amount: p.amount, subscription:
      p.subscription }))` between the real Firefly III and the fake.
    - Both lists are sorted by date, text and amount before comparing.
- [ ] **Step 2: Run** `npm test --prefix addon -w server`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the Produces list and update the knock-ons.
  - Update the `SpendingData` doc comments in `types.ts`: the subscriptions are only those with an object group, and
    a posting has a `subscription`.
  - Spec §5's Card line "a bill with no object group is in no row, no box and not in the key number" is covered here,
    on the server. The page never receives such a bill.
- [ ] **Step 4: Run** the gates. They pass. Run `scripts/integration` when Docker runs, else say so in the report.
- [ ] **Step 5: Commit** (`feat: object groups on subscriptions and bill links on postings`).

## Task 3: The card's marks and boxes

Model: sonnet · Review: yes

**Files:** `addon/web/src/model/subscriptions.ts`, `addon/web/src/components/subscriptions.ts`,
`addon/web/src/screens/overview.ts`, `addon/web/src/theme.ts` (the pill's style),
`addon/web/test/subscriptions.test.ts`.

**Consumes:** `Subscription.objectGroup`, and the web fixture from Task 2.

**Produces:**
- `SubscriptionRow.objectGroup: string`.
- `SubscriptionTable.objectGroups: { name: string; perYear: string }[]`:
  - One entry per object group among the shown bills.
  - `perYear` is `da.perYear(kr(sum))`, where the sum is the øre sum of the bills' `amountPerYear`.
  - Ordered by the biggest sum first, ties by `localeCompare(…, "da")`.
  - Empty when no bill is shown.
- The pill: a shared CSS class `object-group-mark` in `theme.ts`, used by Task 4 as well.
- In the card, the pill sits in the name cell, after the name's link and outside it.
- The card's head no longer renders `half-sum` for Faste udgifter. `subscriptionsYear` stays (the key number uses it).

**The knock-ons in `subscriptions.test.ts`,** named in the report:
- The head-sum check (`getByText(region, "106.968 kr. om året")`, about line 94) goes. The new test below replaces it.
- `fixedCostName`, `cells` and `rowNames` read the first cell, which now holds the pill as well. Change them to read
  the name from the cell's link, or from the cell's text with the row's object group cut off, so they still check
  the name.
  - The expected first cells (for example `"Husleje næste 1. nov"`) gain the object group, or are read without it.
    Choose one way and use it in all of them.

- [ ] **Step 1: Write the failing tests** in `subscriptions.test.ts`:
  - `"marks each fixed cost with its object group"`: Streaming's row text contains "Abonnementer", Husleje's
    contains "Faste udgifter".
  - `"keeps the fixed cost's name as its link's name"`: `getByRole(region, "link", { name: "Husleje" })`.
  - `"shows a yearly sum per object group, biggest first"`: at Alt forbrug, the boxes' list items read, in order,
    "Faste udgifter 105.600 kr. om året" and "Abonnementer 1.368 kr. om året" (together the old 106.968).
  - `"has no single sum in the card's head"`: "106.968 kr. om året" is not in the region at Alt forbrug.
  - `"shows one box at a main group with one object group"`: at the main group of Husleje, only the Faste udgifter
    sum shows.
  - `"shows no box when no fixed cost is shown"`: the "Ingen faste udgifter i …" state has no "om året" text.
  - `"drops a box when its bills are on another account"`: with `accounts=1` (Husleje, Indboforsikring, Avis), only
    the Faste udgifter sum shows. With `accounts=2`, both show.
- [ ] **Step 2: Run** `npm test --prefix addon -w web`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the Produces list and update the knock-ons.
  - The boxes sit in `hs-subscriptions`, above the table.
  - They are a list (`role="list"`) with one list item per object group, holding its title and its sum. The list's
    accessible name is the card's title. The look is the builder's choice.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: object group marks and sums in Faste udgifter`).

## Task 4: The mark on posting rows

Model: sonnet · Review: yes

**Files:** `addon/web/src/components/postings.ts`, `addon/web/test/postings.test.ts`,
`addon/web/test/all-postings.test.ts`, `addon/web/test/fixture.ts`.

**Consumes:** `Posting.subscription`, and the `object-group-mark` class from Task 3.

**Produces:**
- In `row()`, the pill when `p.subscription !== null`, after the Tekst cell's link or text and outside it.
  - Its visible text is `objectGroup`, and its `title` is `name`.
  - The bill's name is also in the pill as visually hidden text (`.visually-hidden`, `theme.ts`), so a screen reader
    reads "Abonnementer, {name}".
- In the web fixture, one posting gets a link: Pizzeria Roma on 2026-09-20 (the spending one, not the refund), with
  `subscription: { name: "Pizzaabonnement", objectGroup: "Abonnementer" }`.
  - The bill's name differs from the shop's name, so a test can tell them apart.
  - The existing Café Søde cell tests (`postings.test.ts` about lines 154 and 161) are untouched.

- [ ] **Step 1: Write the failing tests:**
  - `postings.test.ts`:
    - `"marks a posting linked to a bill"`: the Pizzeria Roma row's text contains "Abonnementer" and
      "Pizzaabonnement".
    - `"keeps the posting's link name"`: `getByRole(row, "link", { name: "Pizzeria Roma" })`.
    - `"does not mark an unlinked posting"`: the refund row of Pizzeria Roma has no "Abonnementer".
    - `"marks it at another grouping"`: the hash key `by=week`.
    - `"marks it in a search's matches"`: `q=pizzeria`.
  - `all-postings.test.ts`:
    - `"marks a linked posting on Alle posteringer"`.
    - `"marks it in the flat list by size"`: `sort=largest`, which only Alle posteringer has.
- [ ] **Step 2: Run** `npm test --prefix addon -w web`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the Produces list. Fix any existing test the new link breaks, and name it in the report.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: mark postings linked to a bill`).

## Task 5: Docs

Model: sonnet · Review: no

**Files:** `docs/decisions.md`, `docs/domain-language.md`, `addon/DOCS.md`, `docs/testing.md`,
`docs/architecture.md`, `docs/README.md`.

- [ ] **Step 1:** Make the doc changes in spec §6, plus the `/api/data` row in `architecture.md` (§3).
  - D38 follows the format in `docs/way-of-working.md` §5, and its source is the spec's link.
  - In `testing.md`, add the screens after 26:
    - `41-objektgrupper`: Faste udgifter at Alt forbrug and at the main group Abonnementer.
    - `42-posteringer-maerke`: Posteringer and Alle posteringer with marked rows.
    - Check both at 1440, 1728 and 420 px.
  - In `README.md`, add this spec and this plan to the lists.
- [ ] **Step 2: Run** `node scripts/check-links.mjs` and the gates. They pass.
- [ ] **Step 3: Commit** (`docs: object groups and the posting mark`).
