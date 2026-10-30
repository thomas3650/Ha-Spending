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
| Uden hovedgruppe | Uden hovedgruppe | `noMainGroup` |
| Uden kategori | Uden kategori | `noCategory` (a posting's `category` is `null`) |
| Period | periode | `period` |
| Grouping | gruppering ("Gruppér pr.") | `grouping` |

`Posting`, `kind` and the `null` category are fixed by technical spec §3.2
([technical spec](superpowers/specs/2026-10-30-technical-design.md)). The other names are chosen here; none is in the
code yet.
