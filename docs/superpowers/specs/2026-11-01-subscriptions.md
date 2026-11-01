# Subscriptions on the overview – design

**Real Home Assistant:** no change there from this work beyond installing the release, through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option. The card shows only once the household has
subscriptions in Firefly III.

**Issue:** #46, variant A reached the second way (A2): a fourth key number and a fourth choice on the right card.
The mockups are [`docs/mockups/v3/`](../../mockups/README.md#subscriptions).

Firefly III keeps subscriptions (its API still calls them bills). Each has an amount range, a repeat, a start date,
and the postings linked to it. The page shows none of that today. This spec adds them to the overview. It changes the
[UI and UX spec](2026-10-30-ui-ux-design.md) where it says so; everything else there holds.

## 1. What the page shows

### 1.1 The key number "Abonnementer pr. måned"

- A fourth key number beside the three of today, on screens 1 and 2 (the overview), not on Alle posteringer.
- **Its value** is the sum of the shown subscriptions' amount per month (§2.1). **Its sub-line** is "{n} abonnementer ·
  {the value × 12} om året".
- **What it follows:** the level and the accounts, as §1.3 says. It does not follow the period, the chosen unit or the
  search: it says what the subscriptions cost now.
- **It is a button.** A click switches the right card to Abonnementer. Its accessible name is its label; it is
  pressed (`aria-pressed`) while the card shows Abonnementer.
- **The layout:** four columns from 1024 px of frame width, two from 600 px, one below, as the halves stack
  ([D24](../../decisions.md)).

### 1.2 The Abonnementer card

**Changes the UI spec** §4.2 and §4.4: the right card's switch gains a choice, after the others: Søjler / Posteringer /
Forskel / Abonnementer (Forskel only while a unit is chosen, as today).

- **The title** is "Abonnementer" on Alt forbrug and "Abonnementer i {level}" on a main group or a category, with "{the
  key number's value} pr. måned" on the right.
- **A row per subscription:**
  - its name, and under it the repeat (§2.3) and "næste {date}" when there is a next date;
  - its amount per month, right-aligned;
  - its status (§2.2) as a coloured label with text, so the colour is never the only sign.
- **The order:** Ikke set, then Steget, then Forventes, then Betalt; within each, by the next date, then by name
  (`localeCompare(…, "da")`). The ones to look at come first.
- **A click on a row** opens the subscription in Firefly III, at `{fireflyLinkUrl}/bills/show/{id}`, as a posting's
  link does. Without `fireflyLinkUrl` the rows are not links. A filter of the postings by subscription is a later
  issue.
- **Nothing to show** on a level with no subscription: "Ingen abonnementer i {level}".
- **The foot:** "Fra Firefly III. Pr. måned er gennemsnittet af beløbet, regnet om til en måned."
- The period, the chosen unit and the search do not change the card, as for the key number.

### 1.3 Which subscriptions are shown

- Only active ones whose end date, if any, is today or later.
- **A subscription's category, main group and account are its last payment's** (§3): the category and the source
  account of the latest posting linked to it in the year before today. Firefly III gives a subscription no category
  of its own.
- **The level:** on Alt forbrug every subscription; on a main group those whose main group it is; on a category those
  whose category it is. One with no payment in that year has no category and no account: it is in Uden kategori in
  Uden hovedgruppe ([D15](../../decisions.md)).
- **The accounts:** a subscription whose last payment's account is not chosen is left out. One with no payment is
  never left out by the accounts.
- **The excluded main groups** (`excluded_main_groups`) leave out a subscription in them, as they leave out postings.

### 1.4 When the household has no subscriptions

When Firefly III has no subscription that §1.3's first bullet keeps, the page is as today: three key numbers, no
Abonnementer choice. A hash with `card=subscriptions` then shows Søjler, as a card the page cannot show does today.

## 2. The rules

Pure functions in `addon/shared/`, beside the money rules, with `today` passed in.

### 2.1 Amount per month

The middle of the amount range, `(min + max) / 2` (Firefly III's `amount_avg`), times the repeat's factor, divided by
`skip + 1`, rounded to whole øre:

| Repeat | Firefly III | Factor |
| --- | --- | --- |
| Ugentlig | `weekly` | 52 / 12 |
| Månedlig | `monthly` | 1 |
| Kvartalsvis | `quarterly` | 1 / 3 |
| Halvårlig | `half-year` | 1 / 6 |
| Årlig | `yearly` | 1 / 12 |

`skip` is how many periods Firefly III leaves out between payments: `monthly` with `skip` 1 is every second month.

### 2.2 The status

From the next date, the last payment and today. The first that holds wins:

| Status | When | Text |
| --- | --- | --- |
| Ikke set | the next date is more than 5 days before today | "Ikke set · ventet {next date}" |
| Steget | the last payment's amount is above the range's max | "{max} → {paid} kr." |
| Betalt | the last payment is at most 7 days before today | "Betalt {date}" |
| Forventes | otherwise | "Forventes {next date}", or "Forventes ikke" with no next date |

- **The next date** is the first date Firefly III expects a payment after the last one (§3). So a payment that is late
  keeps its expected date, and becomes Ikke set after 5 days.
- The 5 and 7 days allow a payment drawn a few days early or late.
- Dates are written as the page writes them today.

### 2.3 The repeat's text

Ugentlig, Månedlig, Kvartalsvis, Halvårlig or Årlig. With `skip` above 0: "Hver {skip + 1}. uge", "Hver {skip + 1}.
måned", "Hver {skip + 1}. kvartal", "Hvert {(skip + 1) × 6}. måned" or "Hvert {skip + 1}. år".

## 3. The server

`/api/data` reads the subscriptions beside what it reads today, in the same `Promise.all`, with the same timeout and
the same stop on a failure.

- **`GET /api/v1/bills`** with `start` 366 days before today and `end` 366 days after it, every page. In that window
  Firefly III answers per subscription `paid_dates` (the linked payments: date, amount, `transaction_group_id`,
  `transaction_journal_id`) and `pay_dates` (the expected dates after the last payment). Firefly III 6.7.9 does this;
  the integration tests check it.
- **The next date** is the first of `pay_dates` (none: `null`). **The last payment** is the latest of `paid_dates`.
- **The last payment's posting:** for each subscription with a last payment, `GET /api/v1/transactions/{group id}`,
  and in it the split with that journal id: its `category_name` and its `source_id`. These calls run in parallel. A
  failed one fails the answer, as any failed read does today ([D18](../../decisions.md)).
- **Amounts** become øre as postings' do. The range's `min` and `max` come from `amount_min` and `amount_max`.
- **The answer** gains `subscriptions`, sorted by name, typed in `addon/shared/`:

  ```ts
  export interface Subscription {
    id: string;
    name: string;
    repeat: "weekly" | "monthly" | "quarterly" | "half-year" | "yearly";
    skip: number;
    /** In øre. */
    amountMin: number;
    amountMax: number;
    /** The first expected date after the last payment; null when Firefly III expects none. */
    next: string | null;
    /** The latest linked payment in the year before today, with its posting's category and account. */
    lastPayment: { date: string; amount: number; category: string | null; account: string } | null;
  }
  ```

  The main group comes from the category through the answer's `categories`, as for postings. A subscription whose
  repeat is none of the five is left out and logged once by its id, never by its name.
- The answer is cached per period as today. The subscriptions in it are those of the day it was read.

## 4. The hash

`card=subscriptions` is a new value of the `card` key ([D20](../../decisions.md)). D20's keys and their order do not
change. This is new decision D33: the subscriptions' card, its rules (§2) and where a subscription's category comes
from (§1.3).

## 5. The fake Firefly III and the example data

- `addon/dev`'s fake answers `GET /api/v1/bills` with `start` and `end`, paged, with `paid_dates` and `pay_dates`
  worked out from its own postings and the repeat, as Firefly III does for the cases the example data holds.
- A posting's split carries `bill_id` and `bill_name`.
- The example data gains made-up subscriptions that show every status: a monthly rent paid this month, monthly ones
  expected in the coming days, a streaming service whose last payment is above its range, a quarterly one not seen,
  a yearly insurance, one inactive and one ended. The generated postings are linked to them.

## 6. Tests

By behaviour through the public interfaces (hard rule 5), with made-up data only.

- **Shared:** the amount per month for each repeat and for `skip` 1; each status and each boundary (5 and 6 days late,
  7 and 8 days since a payment, a payment above the max that is also late, no next date); the repeat texts.
- **Server, against the fake:** the answer's `subscriptions`: inactive and ended ones left out; the next date and the
  last payment; the category and account from the last payment's split in a split group; amounts in øre; a
  subscription with no payment; a failed bills read and a failed group read answer the error code; an unknown repeat
  left out and logged without the name.
- **Page, by role, accessible name and text:**
  - the key number with its value and sub-line; its button opens the card and is pressed;
  - the switch's fourth button and the card's rows, order, status texts and title on each level;
  - a main group, a category and the accounts filter the rows and the key number; the period and a chosen unit do
    not;
  - a row's link to Firefly III, and no link without `fireflyLinkUrl`;
  - "Ingen abonnementer i {level}";
  - no subscriptions: three key numbers, no fourth button, and `#card=subscriptions` shows Søjler;
  - a deep link `#card=subscriptions` shows the card.
- **Integration, on the real Firefly III:** seeded subscriptions with linked postings give the expected next date,
  last payment, category and account; an inactive one is left out.
- **The Chrome check** ([`testing.md`](../../testing.md#chrome-check)): the overview with the card at 1440 and 1728 px
  and at 420 px, on Alt forbrug and on a main group.

## 7. Docs in the same PR

- `docs/decisions.md`: D33.
- `docs/domain-language.md`: Subscription (abonnement, `subscription`), next date, last payment, status.
- `docs/architecture.md`: what `/api/data` reads and answers.
- `addon/DOCS.md`: what the card shows, and that it needs subscriptions in Firefly III with their postings linked
  (Firefly III links them by its own rules).
- `docs/testing.md`: the new screens of the Chrome check.
- `docs/README.md`: this spec and its plan.
