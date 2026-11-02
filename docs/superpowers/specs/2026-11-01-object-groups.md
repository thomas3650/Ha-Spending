# Faste udgifter by Firefly III's object groups, and the mark on postings – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option. The household's Firefly III must put its bills
in object groups, which the house has decided to do (see below); a bill with no object group drops out of the card.

**Issues:** #54, and the house's note on #59.

The house decided with Thomas on 2026-11-01 to put every Firefly III bill in one of two object groups: "Faste
udgifter" (what the household cannot stop: housing fee, electricity, loans, insurance …) and "Abonnementer" (what it
can cancel: streaming, apps, memberships …). Thomas wants the page to use that split. He also wants a posting that
pays a bill to say so (#54). He wants Firefly III to do most of the work: the page shows what Firefly III says and
does not keep its own rules about which bill is which.

This spec changes the [subscriptions spec](2026-11-01-subscriptions.md) and the
[card full-screen spec](2026-11-01-card-full-screen.md) where it says so. Everything else there holds.

**Thomas's rulings, 2026-11-01:**

- The Faste udgifter card keeps one list, grouped by main group as today. Each row carries a mark with its bill's
  object group, and the card shows a sum for each object group (draft B of three, §1).
- The amounts stay per payment as in Firefly III, with the cost per year beside them, as today; nothing goes per
  month (§1.1). This differs from the house's note on #59, which asked for sums per month.
- A posting linked to a bill carries the same kind of mark, with the bill's name in its tooltip (draft A of three,
  §2).
- Firefly III decides. A bill with no object group is not shown in the card, and its postings get no mark. Thomas
  accepts that such a bill drops out without a message: the house has an agent that checks the postings each month
  and catches it.
- The object groups' names are Firefly III's, not the page's. A third object group in Firefly III shows up with its
  own mark and sum with no change to the page.

**Claude's calls, for Thomas to see before approving:**

- Every row in the card carries its object group's mark, also the "Faste udgifter" ones (§1.2). In draft B only the
  abonnementer had one. The page has no built-in "default" group that could go unmarked.
- All marks look the same: one neutral style, no colour per object group (§1.2). The names are data, so the page has
  no colours for them.
- The object groups' sums are ordered biggest first, ties by name (§1.1).
- The mark is on the postings both in the right card and on Alle posteringer, at every grouping (§2).
- A posting keeps its mark when its bill has ended or is no longer active (§2). The mark says the payment is linked
  to the bill, not that the bill still runs (Thomas's comment on #54).
- The card's title stays "Faste udgifter" ([D36](../../decisions.md)), even though one object group has the same
  name.
- The search does not match a bill's name or object group (§2).
- A bill with no object group is dropped before the server reads its last payment, so it can never make the page
  fail (§3).

## 1. The Faste udgifter card

### 1.1 A sum per object group

**Changes the subscriptions spec** §1.2 (the "… om året" sum on the right of the title) and **the card full-screen
spec** §2 ("The card's head sum (per year) and the key number are unchanged"): the head's sum moves into the boxes
below. The key number is unchanged.

The amounts stay as today: the Beløb column as the bill is paid in Firefly III ("900 kr. pr. kvartal"), the Om året
column, the group rows' sums per year and the key number "Faste udgifter om året". There is no per-month amount.

- **The card's head** loses its single sum. Under the head, above the table, there is one small box per object group
  among the shown bills: the object group's title and its sum per year ("163.680 kr. om året"). The boxes follow the
  level and the accounts, as the rows do. They are ordered by the biggest sum first; ties by name with
  `localeCompare(…, "da")`. With one object group among the shown bills there is one box. With no bill shown (the
  "Ingen faste udgifter i …" state) there are no boxes.
- **Rounding:** a box's sum is the sum in øre of its bills' amounts per year, shown in whole kroner as the other sums.
  So the boxes, the group rows and the key number may differ by a few kroner from the sum of what is shown, as the rows
  already may (subscriptions spec §2.1). Tests do not assert that the boxes add up to the key number.

### 1.2 The mark on a row

- After the bill's name, a mark with the bill's object group title, as Firefly III writes it ("Abonnementer", "Faste
  udgifter"). The mark is outside the name's link to Firefly III, so the link's accessible name stays the bill's name.
- One style for every mark: a small neutral pill, as in the mockups. The look is left to the builder.

### 1.3 Which bills are shown

**Changes the subscriptions spec** §1.3 and §3: a bill whose object group title is null, empty or only spaces is not
shown. Nothing else in the rules about which bills are kept changes. When no bill is left, the household has no
subscriptions for the page: three key numbers and no Faste udgifter choice (subscriptions spec §1.4).

The grouping by main group or category, the colours, the group rows' counts and their sums stay as the card
full-screen spec §2 says.

## 2. The mark on a posting

- **Which postings:** a posting whose split Firefly III links to a bill (`bill_id`) that has an object group (§1.3).
  A posting linked to a bill with no object group, or to a bill id the server did not find among the bills, has no
  mark. A refund linked to a bill gets the mark as well.
- **Ended bills:** the bill counts whether it is active, ended or inactive. The server looks the bill up among all the
  household's bills, not only the ones the card keeps.
- **The look:** the same pill as in the card (§1.2), with the object group's title, after the posting's text in the
  Tekst column and outside the text's link to Firefly III. The bill's name is the pill's tooltip (`title`), and a
  screen reader reads it with the pill ("Abonnementer, Fitness"): the bill's name is in the pill's accessible name or
  description, not in a `title` alone. How is left to the builder, within that.
- **Where:** in the Posteringer card and on Alle posteringer, at every grouping, and in a search's matches. The search
  matches on what it matches on today; it does not match a bill's name or object group.

## 3. The server

- **The bill:** `WireBill` gains `object_group_title: string | null`. `Subscription` gains `objectGroup: string`, the
  title as Firefly III gives it.
- **Dropping early:** `readSubscriptions` leaves out a bill with no object group (§1.3) before it reads the posting of
  its last payment, so such a bill makes no read and cannot fail the answer (D18, D33). `keepSubscriptions` never
  sees it.
- **The posting:** `WireSplit` gains `bill_id: string | null`. `Posting` gains `subscription: { name: string;
  objectGroup: string } | null`, named after the code's word for a bill ([D36](../../decisions.md)). It is set from
  the bill with that id among all bills read (active or not, ended or not) when that bill has an object group;
  otherwise null.
- **Reads:** no new call to Firefly III. The bills are already read for the subscriptions; the postings are matched
  against that same list of all bills, before any is dropped. The postings and the bills are read at the same time
  today (`read.ts`), so the matching happens after both are in.
- The `SpendingData` comment in `addon/shared/src/types.ts` and the `/api/data` row in
  [`architecture.md`](../../architecture.md) say what is new.

## 4. The fake Firefly III and the example data

**Changes the subscriptions spec** §5 ("Its transactions answer is unchanged"): the fake's transactions answer gains
`bill_id` on the splits linked to a bill.

- **The fake** serves `object_group_title` on its bills and `bill_id` on linked splits. Both match what the real
  Firefly III returns for the same seed, since the integration test compares the two answers
  (`addon/server/test-integration/firefly.test.ts`).
- **`seed-types.ts`:** `SeedSubscription` gains an optional object group.
- **`exampleSeed`** (`example.ts`, the server and integration tests): the bills get "Faste udgifter" or
  "Abonnementer" (Netflix and Fitness in "Abonnementer"). One bill with linked postings has no object group. The
  inactive bill (Avis) and a bill ended before the tests' today (Gammel forsikring) each gain a linked posting in the
  data's range, so the mark on an ended or inactive bill's posting can be tested; Fitness ends on the tests' today
  and is still kept, so it does not test this. Every linked posting these tests rely on, also the one of the bill
  with no object group, is one the page shows: a withdrawal from an asset account, or a refund. The knock-on: the existing subscriptions tests
  whose expectations depend on those bills having no payment, or on which bills are kept, are updated in the same
  change.
- **`generateSeed`** (`generate.ts`, the fast loop and the Chrome check): the same split, with at least one bill in
  each object group and one bill with linked postings and no object group, so the drop-out and the marks can be seen.
- **The seeding of the real Firefly III** for `scripts/integration` sets the object group on the bills it creates.

## 5. Tests

By role, name and text, made-up data only (hard rule 5):

- **Server:** a bill with no object group, or a title of only spaces, is not in `subscriptions`, and no read is made
  for its last payment; a bill's `objectGroup` is its title; a posting linked to a bill with an object group has
  `subscription` with its name and object group, also when the bill is inactive or ended, and also for a refund; a
  posting linked to a bill with no object group, or to an unknown bill id, has `subscription: null`; a posting with
  no link has `subscription: null`.
- **Card:** each row's text contains its object group; the bill's link keeps the bill's name as its accessible name;
  the boxes show one sum per year per object group among the shown bills, biggest first, and follow the level and
  the accounts; at a main group with only one object group there is one box; with no bill shown there is no box; a
  bill with no object group is in no row, no box and not in the key number.
- **Postings:** a linked posting's row contains the object group's text, in the card and on Alle posteringer; the
  pill's accessible name or description contains the bill's name; the posting's link keeps its accessible name; an
  unlinked posting has no pill.
- **Integration:** the real Firefly III returns the object group title on bills and the bill id on linked splits, as
  the fake does.

The Chrome check ([`testing.md`](../../testing.md)): Faste udgifter at Alt forbrug and at the main group
Abonnementer, with the boxes and marks; Posteringer and Alle posteringer with marked rows. At 1440, 1728 and 420 px.

## 6. Docs in the same PR

- `docs/decisions.md`: D38, Firefly III's object groups decide which bills show and how they are marked. The page
  keeps no names of its own for them.
- `docs/domain-language.md`: "Object group" (Firefly III's grouping of bills, `objectGroup`), and the posting's
  `subscription` (the bill a posting is linked to).
- `addon/DOCS.md`: the Faste udgifter paragraph says the card needs the bills in object groups in Firefly III, that
  it shows a sum per object group, and that a linked posting is marked.
- `docs/testing.md`: the screens of §5's Chrome check.
- `docs/README.md`: this spec and its plan in the lists.

## 7. What is left to the builder

The pill's look, the boxes' layout within §1.1, and how a screen reader gets the bill's name within §2.
