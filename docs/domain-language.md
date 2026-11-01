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
| Refund | — | `refund` (`Posting.kind`) |
| Uden hovedgruppe | Uden hovedgruppe | `mainGroup: null` on a category ([D15](decisions.md)) |
| Uden kategori | Uden kategori | `category: null` on a posting ([D15](decisions.md)) |
| Period | periode | `period` (type `Period`) |
| Grouping | gruppering ("Gruppér pr.") | `grouping` (type `Grouping`) |
| Unit | enhed | `unit` (type `Unit`): one day, week, month, quarter or year of a period |
| Timeline | — | `timeline` (type `Timeline`): a period, a grouping, today and the earliest posting |
| Whole unit | hel enhed | `isWhole`; the rule is in [D16](decisions.md) |
| Today | i dag | `today`: the day the data was read |
| View state | — | `ViewState`: everything the page shows, kept in the URL hash ([D20](decisions.md)) |
| Level | niveau | `level`: the screen's depth, from all spending to a main group to a category |
| Chosen unit | valgt enhed | `unit` in the view state: the bar the user clicked |
| Subscription | fast udgift | `subscription` (type `Subscription`); Firefly III's API calls it a bill |
| Due date | forfaldsdato | a date a subscription is expected to be paid: the start date, then every `skip + 1` periods |
| Next date | næste dato | the due date the last payment does not cover, or none past the end date; the rules are in [the spec](superpowers/specs/2026-11-01-subscriptions.md#22-the-due-dates-and-the-next-date) |
| Last payment | seneste betaling | `lastPayment`: the latest posting linked to a subscription on or before today |
| Amount per payment | beløb | the middle of the subscription's amount range |
| Amount per year | om året | the cost of a subscription over a year; the rule is in [the spec](superpowers/specs/2026-11-01-subscriptions.md#21-amount-per-payment-and-per-year) |
| Subscription status | status | Ikke set, Steget, Forventes or Betalt; the rules are in [the spec](superpowers/specs/2026-11-01-subscriptions.md#23-the-status) |
| Card | kort | `card` in the view state: which card the second half shows, Søjler, Posteringer, Forskel or Faste udgifter (`"bars"` \| `"postings"` \| `"difference"` \| `"subscriptions"`) |
| Shop | butik | `shop` (`Posting.shop`): the name of the shop a posting was made at, null when it has none |

The hash keys are listed in [D20](decisions.md) and [D35](decisions.md). `Posting`, `kind` and the `null` category are fixed by technical spec §3.2
([technical spec](superpowers/specs/2026-10-30-technical-design.md)). The other names are chosen here; they are in
`addon/shared/src/`. Their texts, such as Uden kategori, belong to the page.
