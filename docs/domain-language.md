# Domain language

The words used in specs, code and UI. Their meanings are in UI spec §2
([UI spec](superpowers/specs/2026-10-30-ui-ux-design.md)); period and grouping in its §3.1. This doc gives each word
its name in code, so the same thing has one name everywhere. The Danish word is what the page shows.

| Word | Danish | In code |
| --- | --- | --- |
| Main group | hovedgruppe | `mainGroup` |
| Category | kategori | `category` |
| Posting | postering | `posting` (type `Posting`) |
| Spending | forbrug | `spending` (`Posting.kind`) |
| Refund | retur (in a bar's name below zero) | `refund` (`Posting.kind`) |
| Uden hovedgruppe | Uden hovedgruppe | `mainGroup: null` on a category ([D15](decisions.md)) |
| Uden kategori | Uden kategori | `category: null` on a posting ([D15](decisions.md)) |
| Period | periode | `period` (type `Period`) |
| Grouping | gruppering | `grouping` (type `Grouping`): follows the period, Måned up to 24 months and År beyond ([D59](decisions.md)) |
| Unit | enhed | `unit` (type `Unit`): one day, month or year of a period |
| Timeline | — | `timeline` (type `Timeline`): a period, a grouping, today and the earliest posting |
| Whole unit | hel enhed | `isWhole`; the rule is in [D16](decisions.md) |
| Today | i dag | `today`: the day the data was read |
| View state | — | `ViewState`: everything the page shows, kept in the URL hash ([D20](decisions.md)) |
| Level | niveau | `level`: the screen's depth, from all spending to a main group to a category |
| Chosen unit | valgt enhed | `unit` in the view state: the bar or the trail's unit list the user chose it from ([D70](decisions.md)) |
| Subscription | fast udgift | `subscription` (type `Subscription`); Firefly III's API calls it a bill |
| Due date | forfaldsdato | a date a subscription is expected to be paid: the start date, then every `skip + 1` periods |
| Next date | næste dato | the due date the last payment does not cover, or none past the end date; the rules are in [the spec](superpowers/specs/2026-11-01-subscriptions.md#22-the-due-dates-and-the-next-date) |
| Last payment | seneste betaling | `lastPayment`: the latest posting linked to a subscription on or before today |
| Amount per payment | beløb | the middle of the subscription's amount range, or the latest payment when it has risen ([D63](decisions.md)) |
| Amount per year | om året | the cost of a subscription over a year; the rule is in [the spec](superpowers/specs/2026-11-01-subscriptions.md#21-amount-per-payment-and-per-year) |
| Subscription status | status | Ikke set, Steget, Forventes or Betalt, and a Forventes past its date reads Forfalden ([D64](decisions.md)); the rules are in [the spec](superpowers/specs/2026-11-01-subscriptions.md#23-the-status) |
| Object group | objektgruppe | `objectGroup`: the title of the group Firefly III puts a bill in; the page shows it as the pill on a row, as a sum per group and as a key number for the period, whose link opens the fixed-expenses view ([D38](decisions.md), [D41](decisions.md), [D66](decisions.md)) |
| Posting's subscription | — | `Posting.subscription`: the bill a posting is linked to, with its id, name and object group, or `null` |
| Detail | detalje | `detail` in the view state (`DetailKey`): the open detail of a fixed expense (`s:<id>`) or a posting (`p:<id>`), kept in the hash ([D44](decisions.md)) |
| Card | kort | `card` in the view state: which card the second half shows, Søjler, Posteringer, Faste udgifter or Butikker (`"bars"` \| `"postings"` \| `"subscriptions"` \| `"shops"`) |
| Sort | sortér | a table sorted by a column header: a click sorts by the column, a second click reverses it; `aria-sort` marks the column ([D40](decisions.md)) |
| Top filter | øverste filter | the trail and Konti: period, chosen unit, main group, category and accounts; it decides which data the page uses ([D59](decisions.md)) |
| Quick filter | hurtigfilter | the search (text or shop) and the Beløb pill on the Posteringer tab; it narrows that list only ([D61](decisions.md)) |
| Beløb kind | beløbstype | Omkring (±20 %), Under, Over or Mellem; the hash writes them as `about`, `under`, `over`, or `min` and `max` ([D61](decisions.md)) |
| Fixed-expenses view | faste udgifter over tid | `view=fixed` in the hash: the fixed expenses as bars per unit, paid and expected, with the payments beside them ([D66](decisions.md)) |
| Estimate | estimat | `estimate`: a payment still to come, drawn hatched and written "ca."; its amount is `amountPerPayment` ([D66](decisions.md)) |
| Drawn span | — | the dates the fixed-expenses view draws: the period's first day to its own last day, or for "I år", "Denne måned" and "Alt" on to the end of the year, month or running unit ([D66](decisions.md)) |
| Full screen | fuld skærm | `view=full` in the hash: the right card alone, the page's whole width, for every tab ([D60](decisions.md)) |
| Shop | butik | `shop` (`Posting.shop`): the name of the shop a posting was made at, null when it has none |
| Hidden shop | skjult butik | `hiddenShops` (type `HiddenShops`): a shop the user has hidden from the Butikker card ([D43](decisions.md)) |
| Member | medlem | a name in the `members` option: a revenue account for the money a person puts in, and the expense account of the same name for the money back |
| Credit line | kredit | an asset account named in `credit_accounts` ([D75](decisions.md)) |
| Daily account | daglig konto | an asset account that is not a credit line; savings accounts count as daily ([D75](decisions.md)) |
| Bucket | — | the one place a withdrawal or deposit on a household account goes: Forbrug, Ind, Tilbage, Opsparing or Øvrigt ([D74](decisions.md)) |
| Ind | Ind | `paidIn`: the members' deposits into the household's accounts |
| Tilbage | Tilbage | `back`: money moved back to the members' private accounts |
| Forbrug | Forbrug | `spending`: the overview's spending, in the Til overs view |
| Til overs | Til overs | `leftOver`: Ind minus Tilbage minus Forbrug; computed by the page from rounded parts ([D74](decisions.md)) |
| Kreditten | Kreditten | `credit`: the change in the credit lines' balance; "betalt af" when paid down, "lånt" when drawn on |
| Opsparing | Opsparing | `savings`: money to savings, from the categories in `savings_categories` |
| Øvrigt | Øvrigt | `other`: everything else on the household's accounts, such as interest |
| Ændring på konti | Ændring på konti | `change`: the change in the daily accounts' balance |
| Til overs view | Til overs | `leftOver` in `ViewState`, `view=leftover` in the hash: a table of months, opened from the Til overs card ([D72](decisions.md), [D73](decisions.md)) |

The hash keys are listed in [D20](decisions.md), [D35](decisions.md), [D44](decisions.md), [D60](decisions.md), [D61](decisions.md), [D66](decisions.md) and [D73](decisions.md). `Posting`, `kind` and the `null` category are fixed by technical spec §3.2
([technical spec](superpowers/specs/2026-10-30-technical-design.md)). The other names are chosen here; they are in
`addon/shared/src/`. Their texts, such as Uden kategori, belong to the page.
