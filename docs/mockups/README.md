# Mockups

Sketches of the page, made before the design. All numbers and names are made up. The source is
[`mockup.html`](mockup.html); open it with `?s=1` to `?s=10`. The PNGs are screenshots of it at 1440×960.

| Screen | Shows |
| --- | --- |
| [1](1-hovedgrupper.png) | All spending: the main groups and spending per month |
| [2](2-mad-kategorier.png) | A main group (Mad): its categories and spending per week |
| [3](3-dagligvarer-posteringer.png) | A category (Dagligvarer): its postings and spending per day |
| [4](4-bil-kategorier-stablet.png) | A main group (Bil) with stacked bars, one colour per category |
| [5](5-opladning-hjemme-posteringer.png) | Postings with sort and search, the newest 12 and "Vis alle" |
| [6](6-sommerhus-kategorier-og-posteringer.png) | Categories and the chosen category's postings on one page |
| [7](7-sport-posteringer-pr-modtager.png) | Postings grouped by receiver, with subtotals |
| [8](8-cirkel-hovedgrupper.png) | The main groups as a circle: at most six pieces, the rest in "Øvrige" |
| [9](9-cirkel-bil.png) | A main group as a circle, with the hover box |
| [10](10-cirkel-to-ringe.png) | Two rings: main groups inside, their categories outside |

The accounts chip ("Alle konti (2) ▾") stands for a dropdown with several choices; the mockups do not draw it open.

## Refined, in light mode

One screen at a time, three variants each, one chosen. Under [`v2/`](v2/).

| Screen | Chosen | Shows |
| --- | --- | --- |
| [1](v2/1-alt-forbrug.png) | H | All spending: key numbers, every main group in the circle with its name, amount and share beside it; the eight largest in colours, the rest in greys (no more than eight colours can be told apart); the ring turned so the small pieces sit where their names have room; a name is a button like its piece. The months with the average. Period, grouping and accounts are dropdowns: [period](v2/1-alt-forbrug-period.png) with "Vælg periode …", [grouping](v2/1-alt-forbrug-grain.png), [accounts](v2/1-alt-forbrug-konti.png). Tried: [A, a list](v2/1-alt-forbrug-liste.png), [D, a circle with a list](v2/1-alt-forbrug-cirkel-liste.png), [E, five and Øvrige](v2/1-alt-forbrug-e.png), [F, every group, small](v2/1-alt-forbrug-f.png), [G, seven and Mindre grupper](v2/1-alt-forbrug-g.png) |
| [2](v2/2-hovedgruppe.png) | C, refined | A main group (Mad) after a click on its piece: its key numbers, its categories as a circle, and a card that toggles between bars and postings. A click on a category filters the page: [bars](v2/2-hovedgruppe-filter-bars.png), [postings grouped by the chosen grouping](v2/2-hovedgruppe-filter-posts.png); ✕ or a second click shows the whole group again. Tried: [A](v2/2-hovedgruppe-a.png), [B, stacked bars](v2/2-hovedgruppe-b.png), [C, postings below](v2/2-hovedgruppe-c.png) |
| [3](v2/3-posteringer.png) | A | All postings ("Vis alle"): a search in the text, sort, the filters from the page before as chips with ✕ and "+ Filter", the count and sum, the postings grouped by the chosen grouping. Tried: [B, filters in a column](v2/3-posteringer-b.png), [C, grouped by receiver](v2/3-posteringer-c.png) |
| [4](v2/4-soejle.png) | C | A click on a bar (July): the page filters to that month ("Juli 2026 ✕"), the circle and key numbers show July, and the right card toggles to the difference from an average month per main group (orange more, blue less). Tried: [A, filter only](v2/4-soejle-a.png), [B, the period moves to July by day](v2/4-soejle-b.png) |
| [5](v2/5-oevrige-a.png) | dropped | A click on Øvrige. Dropped once screen 1 showed every main group: there is no Øvrige. Tried: [A](v2/5-oevrige-a.png), [B](v2/5-oevrige-b.png), [C](v2/5-oevrige-c.png) |

Every circle follows screen 1: a piece for every group, eight colours then greys, the names clickable. Screens 2 and 4 were drawn before that rule and still show five pieces and Øvrige.

## Subscriptions

Three ideas for showing Firefly III's subscriptions; A reached as A2 is chosen. Under
[`v3/`](v3/abonnementer.html); open it with `?v=a`, `b` or `c`. A's list is reached in one of two ways, `?v=a2` or
`a3`; `?v=a2-bolig` shows the first in a main group.

| Variant | Shows |
| --- | --- |
| [A](v3/abonnementer-a-liste.png) | The overview as today, with a key number for the subscriptions per month and a card listing them: repeat, amount, per month, next date and a status (paid, expected, not seen, gone up) |
| [B](v3/abonnementer-b-fast-variabel.png) | Every amount split in fixed (paid through a subscription) and variable: key numbers, the main groups as split bars, the months stacked, and Alt / Faste / Variable at the top |
| [C](v3/abonnementer-c-kalender.png) | Subscriptions as their own screen beside Forbrug: the coming month as a calendar, what to look at (a price that went up, a payment not seen) and every subscription per month |
| [A2](v3/abonnementer-a2-kort.png) | A's list as a fourth choice on the right card, Søjler / Posteringer / Forskel / Abonnementer; the key number opens it too. [In Bolig](v3/abonnementer-a2-kort-bolig.png) it shows only Bolig's subscriptions |
| [A3](v3/abonnementer-a3-niveau.png) | A's list as a level of its own, "Alt forbrug › Abonnementer", reached by a click on the key number: the whole table, with what was paid in the period |

## Budget

Four ideas for a page of its own with Firefly III's budgets, none chosen yet. Under [`v4/`](v4/budget.html); open it
with `?v=a`, `b`, `c` or `d`. "Today" in them is 20 October 2026.

| Variant | Shows |
| --- | --- |
| [A](v4/budget-a-maaned.png) | This month: a bar per budget against its amount, a line for how far the month has come, what is left, and what may be spent per day |
| [B](v4/budget-b-aar.png) | The year: a cell per budget per month, coloured by how much of the budget was used |
| [C](v4/budget-c-prognose.png) | Will the month hold: spending day by day against the budget, run on to the month's end, and a small chart per budget |
| [D](v4/budget-d-firefly.png) | After Firefly III's own budget page: the month's available amount split in spent, left and not assigned; a row per budget with its amount, carry-over and auto-budget, a bar, spent and left per day; Uden budget beside it |
