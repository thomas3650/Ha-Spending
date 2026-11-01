# Subscriptions on the overview – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [subscriptions spec](../specs/2026-11-01-subscriptions.md), in one PR that closes the first step of #46.

**Architecture:** the rules are pure functions in `addon/shared/src/subscriptions.ts`. The server reads Firefly III's
bills beside today's reads and adds `subscriptions` to `/api/data` (`addon/server/src/firefly/subscriptions.ts`). The
page gets a fourth key number, a fourth card choice and an `hs-subscriptions` table. The fake Firefly III and both seeds
learn subscriptions.

**Tech stack:** TypeScript, Hono, Lit, Vitest with happy-dom and Testing Library; `scripts/integration` for the real
Firefly III 6.7.9.

**Spec:** [`docs/superpowers/specs/2026-11-01-subscriptions.md`](../specs/2026-11-01-subscriptions.md). Read it whole
before your task. Its section numbers (§) are used below.

## Global constraints

- `CLAUDE.md` hard rules 2, 5, 6 and 7: made-up data only; tests by HTTP answer, role, accessible name and text; English
  code; comments only for why.
- Danish texts only in `addon/web/src/i18n/da.ts`, word for word as the spec gives them.
- Amounts are integer øre everywhere until they are formatted. Dates are `YYYY-MM-DD` strings, computed in UTC with
  `addon/shared/src/dates.ts`.
- The gates in `CLAUDE.md` pass before every commit. Commit with `git commit -F <file>` and the co-author trailer the
  dispatch gives.

## Review focus

1. **The 31st:** a monthly subscription that starts on 31 January is due 28 February (29 in a leap year), then 31
   March, not 28 March. Test in Task 1.
2. **A rent drawn early in the month before:** a payment on 31 October for the 1 November due date covers it, and the
   next date is 1 December. Test in Task 1.
3. **A subscription's last payment in a category the answer does not know** (no main group): the page puts it in Uden
   hovedgruppe, and the key number on Alt forbrug still counts it. Test in Task 6.
4. **The card asked for by the hash before the answer has come, or when the household has no subscriptions:** no
   flash of an empty card, and `card=subscriptions` becomes Søjler once the answer says there are none. Test in Task 5.
5. **One bill's posting is deleted in Firefly III after it was linked** (the group read answers 404): the whole answer
   fails with the error code, as §3 says, and no half list is shown. Test in Task 3.

---

## Task 1: the rules

Model: sonnet · Review: yes

**Files:** create `addon/shared/src/subscriptions.ts` and `addon/shared/test/subscriptions.test.ts`; modify
`addon/shared/src/types.ts`, `addon/shared/src/dates.ts`, `addon/shared/src/index.ts`,
`addon/shared/test/dates.test.ts`.

**Produces:**

- In `types.ts`: `export interface Subscription` exactly as spec §3 has it, and
  `export type Repeat = Subscription["repeat"]`.
  `SpendingData` does **not** change in this task (Task 3 adds the field).
- In `dates.ts`: `addMonths(date: string, months: number): string`, on the same day of the month or the month's last
  day when it has fewer days. It is computed from `date` each time, never step by step, so 31 Jan + 2 is 31 Mar.
- In `subscriptions.ts`:
  - `PAYMENTS_PER_YEAR: Record<Repeat, number>` (52, 12, 4, 2, 1);
  - `gapMonths(repeat: Repeat, skip: number): number`: the months between payments (`weekly` counts as 7 days, so
    `(skip + 1) * 7 / 30`; the others 1, 3, 6 or 12 times `skip + 1`). The server keeps one only when it is at most
    `MAX_GAP_MONTHS = 24`;
  - `amountPerPayment(s: Subscription): number` and `amountPerYear(s: Subscription): number`, in øre (§2.1, rounded
    with `Math.round`);
  - `nextDate(s: Subscription, today: string): string | null` (§2.2);
  - `type SubscriptionStatus = { kind: "notSeen"; expected: string } | { kind: "risen"; max: number; paid: number } |
    { kind: "expected"; date: string | null } | { kind: "paid"; date: string }`;
  - `subscriptionStatus(s: Subscription, today: string): SubscriptionStatus` (§2.3), with E, L and the days ahead as
    named constants: E 7 and L 5, ahead 7; for `weekly` 2, 2 and 3.

The due dates: due date k is `addDays(start, 7 * k * (skip + 1))` for `weekly`, else `addMonths(start, k * months *
(skip + 1))`. The next date with a last payment P is the first due date `d` with `d > addDays(P.date, E)`. Without P it
is the latest due date on or before today, or `start` when `start` is after today. A next date after `end` is `null`.

- [ ] Write the failing tests in `dates.test.ts` (`addMonths("2026-01-31", 1)` is `"2026-02-28"`, `2` is
  `"2026-03-31"`, `("2028-01-31", 1)` is `"2028-02-29"`, `("2026-11-15", 3)` is `"2027-02-15"`) and in
  `subscriptions.test.ts`, one `describe` per function, each case from spec §6 "Shared":
  - per payment: range 99,00–129,00 kr. gives 11400 øre; 99,00–100,01 gives 9951 (rounded);
  - per year: 11400 øre monthly is 136800; quarterly 90000 is 360000; half-year 2; yearly 1; weekly 52; monthly with
    `skip` 1 is 6 payments;
  - next date: monthly from 2026-01-31, P on 2026-01-31 gives 2026-02-28; every second month from 2026-01-15, P on
    2026-01-15 gives 2026-03-15; P on 2026-10-31 for a monthly from 2025-01-01 gives 2026-12-01 (1 day early);
    P on 2026-11-04 gives 2026-12-01 (4 days late); no P, start 2025-01-01, today 2026-10-30 gives 2026-10-01; no P,
    start 2026-11-20 gives 2026-11-20; a next date after `end` gives `null`; weekly from 2026-10-05 with P on
    2026-10-10 (2 days early for 10-12) gives 2026-10-19 and P on 2026-10-09 (3 days early) gives 2026-10-12;
  - status, today 2026-10-30: next 2026-10-25 (5 days past) is not `notSeen`, 2026-10-24 (6) is; weekly 2 and 3 days;
    next 2026-11-06 (7 ahead) is `expected`, 2026-11-07 (8) is `paid`; weekly 3 and 4; P above max and late gives
    `notSeen` (it wins); P above max and not late gives `{ kind: "risen", max, paid }`; no P and no next date gives
    `{ kind: "expected", date: null }`; P and no next date gives `paid`;
  - `gapMonths("yearly", 1)` is 24 and `("yearly", 2)` is 36.
- [ ] Run `npm test --prefix addon -w shared`; the new tests fail.
- [ ] Implement; export the new module from `index.ts`.
- [ ] The gates pass; commit `feat: the subscription rules`.

## Task 2: subscriptions in the seeds and the fake Firefly III

Model: sonnet · Review: yes

**Files:** `addon/dev/src/seed-types.ts`, `addon/dev/src/fake.ts`, `addon/dev/src/seed-firefly.ts`,
`addon/dev/src/example.ts`, `addon/dev/test/fake.test.ts`, `addon/server/test/client.test.ts`.

**Produces:**

- `SeedSubscription { name: string; amountMin: string; amountMax: string; start: string; repeat: Repeat; skip?: number;
  active?: boolean; end?: string }`; `SeedData.subscriptions?: SeedSubscription[]`; `SeedSplit.subscription?: string`
  (the subscription's name).
- A withdrawal's `source` may name a liability in `otherAccounts`. Its source type is then `Loan` in the fake.
- The fake answers `GET /api/v1/bills` with `start` and `end`, paged as the other lists. Each item is
  `{ id, attributes: { name, amount_min, amount_max, date, end_date, repeat_freq, skip, active, paid_dates } }`, with
  dates as the fake's other dates (`fireflyDate`), amounts as `fireflyAmount`, `end_date` `null` when there is none, and
  `paid_dates` the linked splits dated from `start` to `end`: `{ transaction_group_id, transaction_journal_id, date,
  amount }`, amount positive. The transactions answer is unchanged. A seed split that names an unknown subscription
  throws, as an unknown category does.
- `seedFirefly` posts each subscription to `bills` (`name`, `amount_min`, `amount_max`, `date`, `repeat_freq`, `skip`,
  `active`, `end_date` when set, `currency_code: "DKK"`) after the categories and before the transactions. A split
  that names one sends `bill_name`. A withdrawal from a liability sends `source_name` as today.
- `exampleSeed.subscriptions`, with the cases from spec §5, tests' today 2026-10-30. `skip` 0 and active unless said:

  | Name | Repeat, start | Range | End | Linked to |
  | --- | --- | --- | --- | --- |
  | Husleje | monthly, 2025-01-31 | 8000.00–8000.00 | | "Husleje januar" (2025-12-30, the day before the 31st) |
  | Netflix | monthly, 2025-01-02 | 99.00–129.00 | | "Netflix" (2026-01-02) |
  | Bilka | monthly, 2025-01-10 | 150.00–250.00 | | the split "Bilka mad" of the group "Indkøb" |
  | Opsparingsaftale | monthly, 2025-01-07 | 1000.00–1000.00 | | "Til opsparing" (Opsparing, an excluded main group) |
  | Avis | monthly, 2025-01-15 | 199.00–199.00, inactive | | nothing |
  | Fitness | monthly, 2025-02-01 | 299.00–299.00 | 2026-10-30 | nothing |
  | Gammel forsikring | yearly, 2025-03-01 | 1200.00–1200.00 | 2026-10-29 | nothing |
  | Tandforsikring | yearly, 2026-12-01 | 600.00–600.00 | | nothing |
  | Hver tredje år | yearly, `skip` 2, 2025-05-01 | 3000.00–3000.00 | | nothing |
  | Billån | monthly, 2026-08-01 | 2500.00–2500.00 | | a new withdrawal 2026-08-01, 2500.00, from a new liability "Billån" to "Bilforhandler", category Brændstof |
  | Indboforsikring | quarterly, 2026-09-15 | 900.00–900.00 | | a new withdrawal 2026-09-15, 900.00, Konto A to "Forsikringsselskabet", category Husleje; and one 2027-03-15, the same |

- **The new postings:** append them at the end of `exampleSeed.transactions` (`fake.test.ts` refers to transactions by
  index). Each has a category, so the sorter's inbox does not change. They stay out of R1 (2025-12-01..2026-07-31)
  and do not move `earliestPostingDate` (2025-12-03). These expectations change, and the commit message says so:
  `addon/dev/test/fake.test.ts` (the total of 16 and its first date, the withdrawal count 11 and the "all" count 17;
  the page counts stay) and `addon/server/test/client.test.ts` (17 groups). Task 4 updates the integration test's withdrawal
  count. Change no other expectation; if another one breaks, the seed is wrong.
- [ ] Write the failing tests in `fake.test.ts`: the bills list pages with `limit`; `paid_dates` holds only the linked
  splits from `start` to `end` (Indboforsikring's 2027 payment is not in a window ending 2026-10-30), with positive
  amounts and the split's own journal id in a split group; an inactive and an ended bill are listed with
  `active: false` and their `end_date`; a withdrawal from a liability has source type `Loan`; a split naming an unknown
  subscription throws.
- [ ] Implement. Run `npm test --prefix addon`: every other test still passes.
- [ ] The gates pass; commit `feat: subscriptions in the seeds and the fake Firefly III`.

## Task 3: the server reads the subscriptions

Model: opus · Review: yes

**Files:** create `addon/server/src/firefly/subscriptions.ts` and `addon/server/test/subscriptions.test.ts`; modify
`addon/server/src/firefly/wire.ts`, `addon/server/src/firefly/read.ts`, `addon/shared/src/types.ts`,
`addon/server/test/read.test.ts`, `addon/web/test/fixture.ts`, and any test that builds a `SpendingData` by hand.

**Consumes:** `Subscription`, `Repeat`, `gapMonths`, `MAX_GAP_MONTHS` from Task 1; the fake's bills from Task 2.

**Produces:**

- `SpendingData.subscriptions: Subscription[]`, "Kept as §3 of the subscriptions spec says, by name." The web fixture's
  `answerFor` gives `subscriptions: []`.
- `WireBill` and `WirePaidDate` in `wire.ts`, with the fields in Task 2.
- `interface RawSubscription { bill: WireBill; lastPaid: WirePaidDate | null; split: WireSplit | null }`: `lastPaid`
  is the latest `paid_dates` entry dated today or earlier (`null` when none); `split` is that payment's split, read
  from its group (`null` when there is no `lastPaid`).
- `readSubscriptions(client, settings, today, signal): Promise<RawSubscription[]>`: every page of `bills` with `start`
  `addDays(today, -760)` and `end` `today`; for each bill with a last payment (§3), the group, at most 5 group reads at
  a time, by `transactions/${encodeURIComponent(id)}`, and in it the split with that journal id.
- `keepSubscriptions(raw, mainGroupOf, excluded, today, warn): Subscription[]`, pure: the filter in §3, the fields, by
  name with `compareKeys`. One `warn` per left-out unknown repeat or long gap, with the bill's id and never its name.
  A bill whose split is missing in its group fails as `unreachable`. The `paid_dates` choice of `lastPaid` happens in
  `readSubscriptions`, but `keepSubscriptions` also ignores a `lastPaid` after `today`, so a hand-made raw bill can test
  it.
- `readSpendingData` runs `readSubscriptions` in its `Promise.all` with `stopOnFailure`, then `keepSubscriptions` with
  the same `mainGroupOf` and `excluded` the postings use.
- [ ] Write the failing tests over the fake with `exampleSeed`, today 2026-10-30, as `data.test.ts` builds its client:
  - the kept names, by name: Bilka, Fitness, Husleje, Indboforsikring, Netflix, Tandforsikring;
  - Husleje's `lastPayment` is `{ date: "2025-12-30", amount: 800000, category: "Husleje", account: <Konto A's id> }`,
    `amountMin` and `amountMax` 800000, `start` "2025-01-31", `end` null, `repeat` "monthly", `skip` 0;
  - Bilka's last payment has the category and amount of the split "Bilka mad", not of "Bilka gave";
  - Indboforsikring's last payment is 2026-09-15; Tandforsikring has `lastPayment: null`; Fitness, ending today, is
    kept;
  - a hand-made raw bill whose `paid_dates` has an entry after today and one before: the one before is the last
    payment;
  - "Hver tredje år" is left out and a warning names its id and not "Hver tredje år"; a `keepSubscriptions` case with a
    hand-made bill of `repeat_freq: "daily"` does the same;
  - "Opsparingsaftale", "Billån", "Avis" and "Gammel forsikring" are left out;
  - the `bills` request asks `start=2024-09-30&end=2026-10-30`;
  - a fetch wrapper around `fake.fetch` that fails only `GET /api/v1/bills` (500): `/api/data` answers the error code,
    as `data.test.ts` checks a failed read today; one that answers 404 only for Husleje's `transactions/{id}`: the same;
  - the six bills with a last payment in the window (Husleje, Netflix, Bilka, Opsparingsaftale, Billån,
    Indboforsikring) give six group reads, and at most 5 are in flight at once (a wrapper that holds each group read
    open until it counts them);
  - `readSpendingData` now warns once more over `exampleSeed`, for "Hver tredje år": in `read.test.ts`, the
    `toHaveBeenCalledTimes(1)` becomes 2, and "puts everything in Uden hovedgruppe without the rule group", which
    expects no warning, now expects one, with the bill's id. Say so in the commit. Task 4 does the same in the integration test.
- [ ] Implement. Run the server tests; then the gates.
- [ ] Commit `feat: the server reads the subscriptions`.

## Task 4: the integration test on a real Firefly III

Model: sonnet · Review: yes

**Files:** `addon/server/test-integration/firefly.test.ts`.

- [ ] Add to the first `describe`: through `/api/data` (today injected as the file does), the seeded subscriptions give
  the same `subscriptions` as the fake does for the same seed, compared field by field except ids. Husleje's last
  payment amount is positive and in øre, with its category and account. An inactive one is left out. `paid_dates`
  holds only payments in the window (read `bills` directly with a narrow `start` and `end`).
- [ ] Update what Task 2's seed and Task 3's warning change: the withdrawal count (line 71 today) and the warning count
  (`toHaveBeenCalledTimes(1)`, line 63 today). Say so in the commit.
- [ ] Run `scripts/integration` (Docker must run). If Firefly III 6.7.9 answers a field differently from the fake,
  change the fake and Task 2's test to match Firefly III, not the reverse, and say so in the commit.
- [ ] Commit `test: subscriptions on a real Firefly III`.

## Task 5: the card's place in the state

Model: sonnet · Review: yes

**Files:** `addon/web/src/state/view.ts`, `addon/web/src/state/actions.ts`, `addon/web/test/view.test.ts`,
`addon/web/test/actions.test.ts`.

**Produces:** `Card` gains `"subscriptions"` (and `CARDS`); `toggleSubscriptions(s: ViewState): ViewState` gives
`card: "subscriptions"`, or `"bars"` when it already is; `normalise` turns `"subscriptions"` into `"bars"` when
`data.subscriptions` is empty.

- [ ] Write the failing tests. The `normalise` cases build their answer inline, `{ ...answerFor(range), subscriptions:
  [one] }`, with one made-up `Subscription`; `withSubscriptions` comes only in Task 6. `parseHash("card=subscriptions")`
  and `toHash` round-trip it; `toggleSubscriptions` both
  ways; `setPeriod`, `setGrouping`, `setAccounts`, `openPart`, `trailLevel`, `removeCategory`, `removeUnit` and
  `chooseUnit` toggling a unit off keep `card: "subscriptions"`; `chooseUnit` choosing a unit gives `"postings"` as
  today; `normalise` with no subscriptions gives `"bars"` and with one keeps it.
- [ ] Implement. The gates pass; commit `feat: the subscriptions card in the view state`.

## Task 6: the key number and the card

Model: opus · Review: yes

**Files:** create `addon/web/src/model/subscriptions.ts`, `addon/web/src/components/subscriptions.ts`,
`addon/web/test/subscriptions.test.ts`; modify `addon/web/src/components/key-numbers.ts`,
`addon/web/src/model/key-numbers.ts`, `addon/web/src/screens/overview.ts`, `addon/web/src/app.ts`,
`addon/web/src/format.ts`, `addon/web/src/i18n/da.ts`, `addon/web/test/fixture.ts`, `addon/web/test/format.test.ts`,
`addon/web/test/da.test.ts` if it lists the texts.

**Consumes:** Task 1's rules, Task 3's `SpendingData.subscriptions`, Task 5's state.

**Produces:**

- `model/subscriptions.ts`: `shownSubscriptions(ctx: ViewContext): Subscription[]` (§1.3: the level through
  `data.categories`, a category the answer does not know is in Uden hovedgruppe; the accounts; one with no payment is in
  Uden kategori and never left out by the accounts), in §1.2's order; `subscriptionRows(ctx): SubscriptionRow[]` with
  `{ id, name, next: string | null, amount: string, perYear: string, status: { kind, text }, href: string | null }`;
  `subscriptionsYear(ctx): number` in øre. **Today is `ctx.data.today`** (spec §2: the day the subscriptions were
  read) for `nextDate`, `subscriptionStatus` and `shortDate`'s year, not `ctx.today`.
- `format.ts`: `shortDate(date: string, today: string): string` ("1. nov", with the year when it is not today's year,
  "1. jan 2027") and `stepAmounts(max: number, paid: number): [string, string]` (§2.3, whole kroner when both are whole,
  else both with two decimals).
- `da.ts`: every text in §1.1, §1.2, §2.3 and §2.4, word for word: "Abonnementer om året", "{n} abonnementer" /
  "1 abonnement", "Abonnementer", "Abonnementer i {level}", "{value} om året", the column heads "Abonnement", "Beløb",
  "Om året", "Status", "næste {date}", "Ingen abonnementer i {level}", the foot, the four statuses and the repeat texts.
- `hs-key-numbers` takes `subscriptions: { card: KeyCard; pressed: boolean } | null`; the fourth number is a
  `<button aria-pressed>` whose accessible name is its label, value and sub-line, and fires `subscriptions-toggle`. Four
  columns from 1024 px, two from 600 px, one below, **only while the fourth number shows**; with three numbers the grid
  is as today (three from 600 px). The placeholder keeps three bones.
- `hs-subscriptions` takes `rows: SubscriptionRow[]`: a `<table>` like `hs-postings`, `<th scope="col">` heads, the
  name an `<a target="_blank" rel="noopener noreferrer">` when `href` is set, the status a label with its text.
- The overview: the fourth switch button only when `data.subscriptions` is not empty. In `right()` the subscriptions
  branch comes before the `inPeriod.length === 0` check, and `cardTitle` handles it before the bars' title, as the card
  does not follow the period. The title and "{value} om året" on the right; the category chip shows and the unit chip
  does not while the card shows; the head wraps (§1.2).
- The fixture: `SUBSCRIPTIONS: Subscription[]` and `withSubscriptions(answer)`; `answerFor` still gives `[]`. Today
  2026-10-30:

  | Name | Repeat | Range, kr. | Last payment | Category · account | Status text |
  | --- | --- | --- | --- | --- | --- |
  | Husleje | monthly from 2025-01-01 | 8000–8000 | 2026-10-01, 8000 | Husleje · 1 | Forventes 1. nov |
  | Streaming | monthly from 2025-01-15 | 99–129 | 2026-10-15, 149 | Café · 2 | Steget · 129 → 149 kr. |
  | Indboforsikring | quarterly from 2025-01-05 | 900–900 | 2026-04-05, 900 | Husleje · 1 | Ikke set · ventet 5. jul |
  | Bilforsikring | yearly from 2025-03-01 | 4800–4800 | 2026-03-01, 4800 | Brændstof · 2 | Betalt 1. mar (next 1. mar 2027) |
  | Avis | monthly, `skip` 1, from 2026-11-20 | 200–200 | none | none | Forventes 20. nov |

- [ ] Write the failing page tests in `subscriptions.test.ts`, mounting with `withSubscriptions`:
  - Alt forbrug: the key number reads "Abonnementer om året", "106.968 kr.", "5 abonnementer"; a button with
    `aria-pressed="false"`; a click shows the card titled "Abonnementer" with "106.968 kr. om året", presses it and sets
    `#card=subscriptions`; a second click shows Søjler;
  - the switch has a fourth button "Abonnementer";
  - the `columnheader`s are Abonnement, Beløb, Om året, Status; the rows in order Indboforsikring, Streaming, Husleje,
    Avis, Bilforsikring; Husleje's cells "8.000 kr. pr. måned" and "96.000 kr."; Indboforsikring "900 kr. pr. kvartal"
    and "3.600 kr."; Bilforsikring "4.800 kr. om året"; Avis "200 kr. hver 2. måned" and "1.200 kr."; the status texts
    in the table above; "næste 1. nov" under Husleje;
  - `#group=Bolig&card=subscriptions`: title "Abonnementer i Bolig", rows Indboforsikring and Husleje, key number
    "99.600 kr." and "2 abonnementer";
  - `#group=&card=subscriptions` (Uden hovedgruppe) shows Avis; a subscription whose category the answer does not know
    shows there too and counts on Alt forbrug;
  - `#accounts=1&card=subscriptions`: Indboforsikring, Husleje and Avis;
  - a category: `#group=Mad&category=Café&card=subscriptions` shows Streaming and the category chip;
  - a chosen unit: the unit chip does not show, the rows are as without it, and the key number still reads
    "106.968 kr."; a period change keeps the card and the key number; a period with no postings
    (`#period=custom&from=2025-01-01&to=2025-01-31&card=subscriptions`) still shows the card's rows, not "no spending";
  - "næste 1. mar 2027" under Bilforsikring;
  - the answer's today wins: `subscriptionRows(viewContext(withSubscriptions(answer), state, "2026-11-07"))`, with the
    answer's `today` 2026-10-30, gives Husleje "Forventes 1. nov" (with the app's today it would read "Ikke set · ventet
    1. nov"). This is a model test, as the app itself takes the answer's today once it arrives;
  - Husleje's name links to `http://firefly.test/bills/show/<id>`; with `fireflyLinkUrl: null` no row has a link;
  - "Ingen abonnementer i Bil" when Bilforsikring is left out by the accounts in Bil;
  - `subscriptions: []` (the plain fixture): three key numbers, no fourth button, and `#card=subscriptions` shows Søjler
    with `location.hash` rewritten;
  - while loading, three bones and no fourth number.
- [ ] Write the failing format tests in `format.test.ts`: `shortDate("2026-11-01", "2026-10-30")` is "1. nov",
  `("2027-01-01", "2026-10-30")` is "1. jan 2027"; `stepAmounts(14900, 16900)` is `["149", "169"]` and
  `(14950, 14975)` is `["149,50", "149,75"]`. And the repeat texts through the model or `da`: "pr. uge", "pr. halvår",
  "hver 3. uge", "hvert 2. kvartal", "hver 12. måned" (half-year, `skip` 1), "hvert 2. år", and the status
  "Steget · 149,50 → 149,75 kr.".
- [ ] Run them; they fail. Implement. Run `npm test --prefix addon`; every test passes.
- [ ] The gates pass; commit `feat: the subscriptions key number and card`.

## Task 7: the generated household's subscriptions

Model: sonnet · Review: no

**Files:** `addon/dev/src/generate.ts`, `addon/dev/test/generate.test.ts`, `addon/server/test/read.test.ts`.

- [ ] Test first: in `generate.test.ts`, the subscriptions include a quarterly, a yearly, a weekly and an
  every-second-month one, and every linked split names a subscription that exists. In `read.test.ts`, "drives every
  screen with the generated data" also checks, through `readSpendingData` over `generateSeed` and Task 1's
  `subscriptionStatus` with the answer's today, that every status shows at least once. (`addon/dev` cannot import the
  server, so this check lives in the server's tests.)
- [ ] Implement as spec §5 lists: Husleje monthly (the existing rent, linked), monthly ones due in the coming days, a
  streaming one with its last payment above its range, a quarterly one not seen, a yearly insurance, a weekly one and
  one every second month. Link the generated postings; add the few new ones the list needs, each with a category. They
  must not move the earliest date: `generate.test.ts` needs it in 2025-08-01..2025-08-14 and `read.test.ts` in
  2025-08-01..2025-08-15.
- [ ] The gates pass; commit `feat: the generated household has subscriptions`.

## Task 8: the docs

Model: sonnet · Review: no

**Files:** `docs/decisions.md`, `docs/domain-language.md`, `docs/architecture.md`, `addon/DOCS.md`, `docs/testing.md`,
`docs/README.md`.

- [ ] `decisions.md`: D33 in the log's format, as spec §4 says, with Thomas's rulings of 2026-11-01 (the year, the
  amount as paid, the "Om året" column). Source: the spec.
- [ ] The rest as spec §7 lists, one fact in one place, linked; `docs/README.md` lists this spec and this plan.
- [ ] `node scripts/check-links.mjs` and the gates pass; commit `docs: subscriptions`.

## After the tasks (the controller)

- The branch review with `reviewer`, the fast loop, and the Chrome check from spec §6 at 1440, 1728, 1024, 900 and
  420 px, light and dark.
- The PR: title `feat: subscriptions on the overview`, `Refs #46` (the issue stays open for the postings step), links
  to the spec and this plan, Thomas's rulings and Claude's calls.
