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

`Posting`, `kind` and the `null` category are fixed by technical spec §3.2
([technical spec](superpowers/specs/2026-10-30-technical-design.md)). The other names are chosen here; they are in
`addon/shared/src/`. Their texts, such as Uden kategori, belong to the page.
