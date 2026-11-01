# Subscriptions on the overview – design

**Real Home Assistant:** no change there from this work beyond installing the release, through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option. The card shows only once the household has
subscriptions in Firefly III.

**Issue:** #46, variant A reached the second way (A2): a fourth key number and a fourth choice on the right card.
The mockups are [`docs/mockups/v3/`](../../mockups/README.md#subscriptions).

Firefly III keeps subscriptions (its API still calls them bills). Each has an amount range, a repeat, a start date,
and the postings linked to it. The page shows none of that today. This spec adds them to the overview. It changes the
[UI and UX spec](2026-10-30-ui-ux-design.md) where it says so; everything else there holds.

**Claude's calls, for Thomas to see before approving** (each differs from the mockup or the issue, or settles an open
point):

- A row opens the subscription in Firefly III, not its postings on this page (§1.2). Filtering the postings by
  subscription becomes a new issue.
- "Steget" compares the last payment with the top of the amount range set in Firefly III, not with the payment before
  it (§2.3). Raising the range in Firefly III clears it.
- A subscription is shown with the category, main group and account of its last payment (§1.3).
- A subscription whose last payment is not a withdrawal from an asset account is left out, as such a posting is not
  spending on this page (§3).
- If Firefly III fails to answer the subscriptions, the whole answer fails, as for any other read (§3, D33).

## 1. What the page shows

### 1.1 The key number "Abonnementer pr. måned"

**Changes the UI spec** §3.1 ("the three key numbers"): with subscriptions there are four.

- A fourth key number after the three of today, on the overview (screens 1 and 2), not on Alle posteringer.
- **Its value** is the sum of the shown subscriptions' amount per month (§2.1), in whole kroner as the other key
  numbers. **Its sub-line** is "{n} abonnementer · {the value × 12} om året", with "1 abonnement" for one.
- **What it follows:** the level and the accounts (§1.3). It does not follow the period, the chosen unit or the
  search: it says what the subscriptions cost now.
- **It is a toggle button.** A click switches the right card to Abonnementer; a click while the card shows
  Abonnementer switches it to Søjler. It has `aria-pressed`, true while the card shows Abonnementer. Its accessible
  name is its text: the label, the value and the sub-line.
- **The layout:** four columns from 1024 px of frame width, two from 600 px, one below 600 px. The halves stack below
  1024 px ([D24](../../decisions.md)).
- **While loading,** the placeholder keeps its three bones. The fourth number appears with the answer.

### 1.2 The Abonnementer card

**Changes the UI spec** §4.2 and §4.4: the right card's switch gains a last choice: Søjler / Posteringer / Forskel /
Abonnementer (Forskel only while a unit is chosen, as today).

- **The title** is "Abonnementer" on Alt forbrug and "Abonnementer i {level}" on a main group or a category. "{the key
  number's value} pr. måned" is on the right.
- **The head wraps:** when the title, the chips and the four buttons do not fit on one line (a half at 1024 px, the
  stacked card at 420 px), the switch goes on its own line under the title.
- **The chips:** the category chip shows, as the card follows the category. The chosen unit's chip does not show, as
  the card does not follow the unit. The unit stays chosen: Søjler, Posteringer and Forskel still use it.
- **A row per subscription:**
  - its name, and under it the repeat (§2.4) and "næste {date}" when there is a next date;
  - its amount per month in whole kroner, right-aligned;
  - its status (§2.3) as a coloured label with text, so the colour is never the only sign.
- **The order:** Ikke set, then Steget, then Forventes, then Betalt; within each, by the next date (none last), then by
  name (`localeCompare(…, "da")`).
- **A click on a row** opens the subscription in Firefly III at `{fireflyLinkUrl}/bills/show/{id}`, as a posting's
  link opens its posting. Without `fireflyLinkUrl` the rows are not links.
- **Nothing to show** on a level with no subscription: "Ingen abonnementer i {level}".
- **The foot:** "Fra Firefly III. Pr. måned er gennemsnittet af beløbet, regnet om til en måned."
- **Dates** are written as "1. nov", with the year when it is not today's year ("1. jan 2027").
- The period, the chosen unit and the search do not change the card, as for the key number.

### 1.3 Which subscriptions are shown

The server sends only the subscriptions §3 keeps. Of those, the page shows:

- **A subscription's category, main group and account are its last payment's:** the category and the source account of
  the latest posting linked to it (§3). Firefly III gives a subscription no category of its own. The main group comes
  from the category through the answer's `categories`, as for postings.
- **The level:** on Alt forbrug every subscription; on a main group those of that main group; on a category those of
  that category. One with no payment has no category and no account: it is in Uden kategori in Uden hovedgruppe
  ([D15](../../decisions.md)).
- **The accounts:** a subscription whose last payment's account is not chosen is left out. One with no payment is
  never left out by the accounts.

### 1.4 When the household has no subscriptions

When the answer's `subscriptions` is empty, the page is as today: three key numbers and no Abonnementer choice. A hash
with `card=subscriptions` then shows Søjler, as `card=difference` without a chosen unit does today.

### 1.5 What keeps the card

The card is in the hash as `card=subscriptions` (§4). Changing the period, the grouping or the accounts, opening a part
of the circle, a trail link, a bar and a chip's ✕ keep it, as they keep Posteringer
(`addon/web/src/state/actions.ts`). A bar click still switches to Posteringer, as the postings search spec says.

## 2. The rules

Pure functions in `addon/shared/`, beside the money rules. `today` is the answer's `today`, the day the subscriptions
were read, so the statuses match the data.

### 2.1 Amount per month

The middle of the amount range, `(min + max) / 2`, times the repeat's factor, divided by `skip + 1`, rounded to whole
øre:

| Repeat | Firefly III | Factor |
| --- | --- | --- |
| Ugentlig | `weekly` | 52 / 12 |
| Månedlig | `monthly` | 1 |
| Kvartalsvis | `quarterly` | 1 / 3 |
| Halvårlig | `half-year` | 1 / 6 |
| Årlig | `yearly` | 1 / 12 |

`skip` is how many periods Firefly III leaves out between payments: `monthly` with `skip` 1 is every second month.

### 2.2 The due dates and the next date

- **The due dates** are the start date, then every `skip + 1` periods after it: 7 days for `weekly`; 1, 3, 6 or 12
  months for the others, on the start date's day of the month, or the month's last day when it has fewer days.
- **Early and late:** a payment may come up to E days before its due date, and is late after L days. E and L are
  7 and 5 days; for `weekly`, 2 and 2.
- **The next date** with a last payment P: the first due date more than E days after P's date. So a payment drawn a few
  days early (rent on 31 October for 1 November) covers its due date, and a late one (4 November) does too.
- **The next date** with no payment: the latest due date on or before today, or the start date when it is after today.
- **The end date:** a next date after the subscription's end date is no next date (`null`).

### 2.3 The status

The first that holds wins:

| Status | When | Text |
| --- | --- | --- |
| Ikke set | the next date is more than L days before today | "Ikke set · ventet {next date}" |
| Steget | P's amount is above the range's max | "Steget · {max} → {paid}" |
| Forventes | there is a next date at most 7 days after today, or there is no P | "Forventes {next date}", or "Forventes ikke" with no next date |
| Betalt | otherwise | "Betalt {P's date}" |

- "Betalt" so means the current period is paid and the next payment is more than a week away. A quarterly one paid on
  1 October reads "Betalt 1. okt" until late December.
- In "Steget", both amounts are in whole kroner when both are whole, else both with two decimals ("149,50 → 149,75
  kr."), so the two never look equal.

### 2.4 The repeat's text

Ugentlig, Månedlig, Kvartalsvis, Halvårlig or Årlig. With `skip` above 0, n = `skip + 1`: "Hver {n}. uge", "Hver {n}.
måned", "Hvert {n}. kvartal", "Hver {6n}. måned" (half-year) or "Hvert {n}. år".

## 3. The server

`/api/data` reads the subscriptions beside what it reads today, in the same `Promise.all`, with the same timeout and
the same stop on a failure.

- **`GET /api/v1/bills`** with `start` 400 days before today and `end` today, every page. For that window Firefly III
  answers each subscription's `paid_dates`: the linked payments, each with `date`, `amount`,
  `transaction_group_id` and `transaction_journal_id`. Nothing is read from Firefly III's own clock: not `pay_dates`,
  not `next_expected_match`. The window comes from the server's `today`, which the tests inject.
- **The server keeps** a subscription only when:
  - it is `active`;
  - its `end_date`, if any, is today or later;
  - its `repeat_freq` is one of the five in §2.1 (else it is logged by its id, never its name, once per read);
  - its last payment, if any, is a withdrawal from an asset account whose category is not in an excluded main group
    (`excluded_main_groups`), as for postings.
- **The last payment** is the latest `paid_dates` entry dated today or earlier. Its amount is taken as a positive
  number of øre, as postings' amounts are.
- **The last payment's posting:** for each subscription with a last payment, `GET /api/v1/transactions/{group id}`
  (the id passed through `encodeURIComponent`), at most 5 at a time, and in it the split with that journal id: its
  type, its source, its `category_name` and its `source_id`.
- **A failed read** of the subscriptions or of one group fails the answer, as any failed read does today
  ([D18](../../decisions.md)).
- **The answer** gains `subscriptions`, sorted by name, typed in `addon/shared/`:

  ```ts
  export interface Subscription {
    id: string;
    name: string;
    repeat: "weekly" | "monthly" | "quarterly" | "half-year" | "yearly";
    skip: number;
    /** The first due date. */
    start: string;
    /** null: no end date. */
    end: string | null;
    /** In øre. */
    amountMin: number;
    amountMax: number;
    /** The latest linked payment on or before today, with its posting's category and account. */
    lastPayment: { date: string; amount: number; category: string | null; account: string } | null;
  }
  ```

- The answer is cached per period as today. The subscriptions in it are those of the day it was read.

## 4. The hash

`card=subscriptions` is a new value of the `card` key ([D20](../../decisions.md)). D20's keys and their order do not
change. New decision D33 records the subscriptions: the card, the rules in §2, where a subscription's category comes
from, and why a failed subscriptions read fails the whole answer (one answer, one error path: the same Firefly III and
token serve every read, and a page with the subscriptions silently missing would read as "none").

## 5. The fake Firefly III and the example data

- **The seed:** `SeedData` gains `subscriptions` (name, amount range, start date, repeat, skip, active, end date), and a
  `SeedSplit` may name its subscription.
- **The real Firefly III:** `seed-firefly.ts` posts the subscriptions (`POST /api/v1/bills`) before the postings, and
  a posting names its subscription with `bill_name`.
- **The fake:** `addon/dev`'s fake answers `GET /api/v1/bills` with `start` and `end`, paged, with `paid_dates` from
  the linked splits dated in the window, amounts positive. Its transactions answer is unchanged.
- **The example data** gains made-up subscriptions that show every status: a monthly rent paid this month (one month
  drawn the day before its due date), monthly ones due in the coming days, a streaming service whose last payment is
  above its range, a quarterly one not seen, a yearly insurance, a weekly one, one every second month, one inactive,
  one ended and one paid from no asset account. The generated postings are linked to them.

## 6. Tests

By behaviour through the public interfaces (hard rule 5), with made-up data only.

- **Shared:**
  - the amount per month for each repeat and for `skip` 1;
  - the due dates on the 31st of a month (February), and every second month;
  - the next date after an early payment (1 day before), a late one (4 days after), with no payment, a start after
    today, and past the end date; for `weekly`, a payment 2 and 3 days early;
  - each status and its boundaries: next date 5 and 6 days past (2 and 3 for `weekly`); next date 7 and 8 days ahead;
    a payment above the max that is also late; no next date with and without a payment;
  - the repeat texts with and without `skip`; "Steget" with whole and with øre amounts.
- **Server, against the fake:** inactive left out; an end date of today kept and of yesterday left out; an unknown
  repeat left out and logged without its name; a last payment in an excluded main group left out; a last payment from
  a liability left out; a future-dated payment not taken as the last; the category and account from the right split
  in a split group; amounts in øre; a subscription with no payment; a failed bills read and a failed group read answer
  the error code.
- **Page, by role, accessible name and text:**
  - the key number's text; its button opens the card and is pressed; a second click shows Søjler;
  - the switch's fourth button; the card's title, rows, order and status texts on each level;
  - a main group, a category and the accounts filter the rows and the key number; the period and a chosen unit do not;
  - the card is kept across a period change and a level change; the category chip shows and the unit chip does not;
  - a row's link to Firefly III, and no link without `fireflyLinkUrl`;
  - "Ingen abonnementer i {level}";
  - an empty `subscriptions`: three key numbers, no fourth button, and `#card=subscriptions` shows Søjler;
  - a deep link `#card=subscriptions` shows the card.
- **Integration, on the real Firefly III 6.7.9:** the seeded subscriptions give, through `/api/data`, the expected last
  payment with a positive amount, its category and account; `paid_dates` holds only payments in the window; an
  inactive subscription is left out. The test's injected `today` sets the window.
- **The Chrome check** ([`testing.md`](../../testing.md#chrome-check)): the card on Alt forbrug and on a main group at
  1440, 1728, 1024 (four key numbers in a row), 900 (two by two) and 420 px.

## 7. Docs in the same PR

- `docs/decisions.md`: D33.
- `docs/domain-language.md`: Subscription (abonnement, `subscription`), due date, next date, last payment, status; and
  `"subscriptions"` in the Card row.
- `docs/architecture.md`: what `/api/data` reads and answers.
- `addon/DOCS.md`: what the card shows, and that it needs subscriptions in Firefly III with their postings linked.
- `docs/testing.md`: screens `30-1024`, `31-900` and `32-420` now show four key numbers; the new screens of the card.
- `docs/README.md`: this spec and its plan.
