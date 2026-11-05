# The fixed-expenses list as a tab in the view, ended fixed expenses, and one top bar – design

**Real Home Assistant:** no change to the add-on's options or files. After the release, Thomas sets an end date in
Firefly III on each fixed expense that no longer runs (§4.1). The house session's issue for the release names that
step ([`releasing.md`](../../releasing.md#after-a-release)). Until it is done, a fixed expense that stopped without an
end date stays out of the list, as it does today.

**Issue:** closes #179. One branch, one PR. Touches #145 and #143 without closing them.

**Approved:** by Claude, 2026-11-05, under Thomas's brief ("du arbejder alene til release og issue oprettet"), after
`reviewer` rated it Ready.

Thomas and Claude walked through the page together on 2026-11-05, with two mockups in the chat (not kept). What
Thomas said or chose is named as his, and every other detail is marked "Claude's call". Everything else in the
earlier specs holds, the [fixed expenses over time spec](2026-11-04-fixed-expenses-over-time.md), the
[fixed view full screen spec](2026-11-04-fixed-view-full-screen.md) and the [Til overs spec](2026-11-04-left-over.md)
above all. Where they differ, this spec holds. Names and amounts in this spec are made up.

"Today" is the answer's `today`, as in the fixed expenses over time spec.

## 1. Why

On the overview, the Faste udgifter tab holds the list of every fixed expense, with Om året and a status. It is long,
so it leaves an empty area under the circle at full-screen width (#145). Its "om året" sums also sit next to the
key numbers' period sums (#143). Thomas wants the list in the fixed-expenses view: "det skal flyttes til en tab her
… så vi får samlet det". It answers, in his words, "hvilke jeg har og om noget mangler at blive betalt".

- **Goal:** the list is a tab on the right card of the fixed-expenses view, beside "Poster i perioden" (Thomas chose
  mockup A, the tab, over a third card).
- **Goal:** the list follows the chosen time. Thomas: "hvis jeg klikker på januar og en fast udgift er stoppet i maj,
  den vises indtil maj og efter maj ikke vises mere".
- **Goal:** the status shows how things stood in the chosen time. Thomas: "som det så ud i januar".
- **Goal:** one top bar on every page, without the ←. Thomas: "uden pil tilbage, alt forbrug er blå som på forsiden og
  tager en til forsiden".
- **Non-goal:** inactive fixed expenses without an end date. They stay out, as today (§4.1). Thomas stops a fixed
  expense by setting an end date, and will set one on the old ones.
- **Non-goal:** a fixed expense's amount range as it was in the past. The page knows only the bill's current range
  (§3.4).
- **Non-goal:** the rest of #145 (the Søjler and Butikker tabs at full width) and the rest of #143 (the key numbers'
  labels).
- **Anti-goal:** a count, a sum or a status in the tab that disagrees with the key numbers' count of the same fixed
  expenses in the same time.
- **Anti-goal:** an estimate or a "Forventes" for a fixed expense after its end date.

## 2. The overview

- The right card's tabs are Søjler, Posteringer and Butikker. The Faste udgifter tab is gone.
- The key numbers stay as they are, with their "Vis faste udgifter →" links into the view (D62, D66). Each opens the
  view on its own object group, on the "Poster i perioden" tab, as today.
- **An old hash with `card=subscriptions`**, from a bookmark or an old link, opens the fixed-expenses view on the
  "Alle faste udgifter" tab with every object group (`og` empty). A `detail=s:<id>` in it is kept (§3.5). Its
  `group` and `category` are kept, and so are the period and Konti. A `unit` in it is dropped: the overview's unit and
  the view's unit are not the same thing. Claude's call: the link still lands on the list it pointed to.
- Full screen on the overview (D60) is unchanged. A `card=subscriptions` with `view=full` opens the view the same way,
  without full screen.

## 3. The "Alle faste udgifter" tab in the fixed-expenses view

### 3.1 The card

- The right card has two tabs, as a segmented control at its head, the same control as the overview's tabs:
  **Poster i perioden** (the payments list, as today) and **Alle faste udgifter** (the list from the overview's
  Faste udgifter tab).
- The card's heading is the open tab's name. Claude's call, as on the overview.
- The view opens on "Poster i perioden". The chosen tab is in the hash: `tab=all` with `view=fixed`; no `tab` is
  "Poster i perioden". Claude's call: the key is short, like `og` and `full`.
- Full screen (`full=list`, D77) fills the page with the right card. Its tabs stay at its head, and the tab chosen
  stays.
- Changing the tab, the object group, the period, the unit, the level or Konti keeps the tab.
- The list looks and works as the overview's tab does today: the object-group sums at its head ("Faste udgifter …
  om året · Abonnementer … om året"), a group line per main group (or per category in a main group), the columns
  Fast udgift, Kategori, Beløb, Om året and Status, sort by the headers (D40), and Forfalden in red (D77).

### 3.2 Which fixed expenses it shows

- **The object group:** the view's object-group step. "Alle faste udgifter" shows every object group.
- **The level and Konti:** as the overview's tab did. The level goes by the last payment's category. Konti goes by
  the last payment's account (`model/subscriptions.ts`).
- **The time:** the chosen unit, or with none chosen, the view's whole period. That time runs from its first day to its
  last day. With a period that ends in the future ("I år", "Denne måned"), the time ends on the period's last day, as
  the view's bars do.
- A fixed expense shows when it **ran in that time**. Its start (Firefly III's first due date) is on or before the
  time's last day. Its end is empty, or it is on or after the time's first day.
- Example: a monthly fixed expense started on 1 March 2025, with an end date of 31 May 2026. It shows in January to May
  2026, and in "I år". It does not show in June 2026 or later.

### 3.3 Om året and the sums

- **Om året** on a row is the bill's yearly amount, as today (`amountPerYear`). It shows for an ended fixed expense
  too, so the row reads what it cost while it ran.
- **The group sums and the object-group sums** at the list's head add up only the fixed expenses that still run at
  the time's last day, or at today when that is earlier. A fixed expense whose end is before that day shows its row
  with Om året greyed, and leaves the sums out. Claude's call: the sums read what the fixed expenses cost per year at
  that point, and an ended one costs nothing from then on.
- A group line's count ("4 faste udgifter") counts every row in it, ended ones included.

### 3.4 Status

The status depends on where the time stands against today.

**A time that holds today** (for example "I år" or the running month): the status is today's status, as now (D63,
D64, D77). That means Betalt, Forventes, Forfalden, Ikke set, Steget or Forventes ikke, from `subscriptionStatus`.
There is one exception. A fixed expense whose end is before today reads **Sluttet {end}** (grey, no border, for
example "Sluttet 31. maj"). Claude's call: its next date is gone, so it is neither expected nor not seen.

**A time that ended before today** (for example January, chosen as a unit): the status is how it stood at the time's
last day. It comes from the payments the page has, which are the postings linked to the bill by its id
(`posting.subscription.id`), in the time:

| In the time | Status |
| --- | --- |
| One or more linked payments | **Betalt {date}**, the latest payment's date (green) |
| A due date of the bill, before or on its end, and no linked payment | **Ikke set** (red, no border) |
| No due date and no payment (a yearly bill in January) | **Næste {date}**, the bill's first due date after the time (grey), or **Sluttet {end}** when none is left |

- Claude's call: a past time shows no Steget. The page does not have the payment before the time, and it does not
  have the bill's range as it was then (§1 non-goals).
- A refund (a positive linked posting) is not a payment for this table. A time with only a refund reads as if
  there was no payment.
- The due dates come from `dueDatesUntil` and stop at the bill's end, as today.
- Sorting by Status sorts Ikke set, then Betalt, then Næste, then Sluttet, in a past time. A time that holds today
  sorts as today, with Sluttet last. Claude's call.

**A time that starts after today** cannot be chosen in the view. The units after today are estimates, and their
status is today's.

Claude's call: a unit that holds today, such as the running month, is "a time that holds today".

### 3.5 The detail

- A click on a row opens the fixed expense's detail (D44), as on the overview's tab. In the normal card, the detail
  takes the card's place, with ← back to the list. In full screen, it stands beside the list.
- The detail's status follows §3.4 for the same time. The rest of the detail is as today.
- The detail is in the hash as today (`detail=s:<id>`), now also with `view=fixed` and `tab=all`. It closes when the
  tab changes to "Poster i perioden", when the object group changes so that the row is gone, or when the view closes.
- This supersedes the fixed expenses over time spec §6.4 on the detail, for this tab only. The "Poster i perioden" tab
  has no detail, no sort and no quick filter, as before.

## 4. Ended fixed expenses in the data

### 4.1 The server

- Today `keepSubscriptions` leaves out a bill that is inactive, and a bill whose end date is before today.
- Now it keeps a bill whose end date is before today, as long as the end date is on or after the asked range's start.
  A bill that ended before the range is still left out.
- An inactive bill is still left out, with or without an end date. Claude's call: Firefly III gives no date for when a
  bill went inactive, so the page cannot tell in which months it ran.
- `Subscription.end` already carries the end date (`shared/src/types.ts`). No new field.
- Postings stay linked to every bill with an object group, as today.

### 4.2 The page

Everything that reads `data.subscriptions` must allow for an ended bill. Each of these is a test (§7):

- **No estimates after the end.** `nextDate` and `dueDatesUntil` already stop at `end`. "Resterende udgifter",
  "Estimat for hele …", the hatched bars and the "Forventes" rows of "Poster i perioden" get nothing after the end.
- **No "Ikke set" that lasts.** In a time that holds today, an ended bill reads Sluttet, not Ikke set or Forventes
  ikke (§3.4). In "Poster i perioden", a not-seen row for its last due date shows only when that date is in the time,
  as it does today.
- **The key numbers' "X stk."** and the object-group step's count follow §5.
- **An object-group key-number card** for a group whose bills have all ended before the period does not appear: such
  bills are not in the data (§4.1).

## 5. One rule for "X stk."

- Today the object-group key numbers count the distinct bill names among the period's linked payments. The tab
  counted the bills in `data.subscriptions`. A bill that had ended or gone inactive was in the first count and not
  in the second, so the two could differ by one on the same screen.
- Now the key number's "X stk." is the number of rows the "Alle faste udgifter" tab shows for that object group, for
  the same period or unit, level and Konti. The object-group step's count in the view is the same number.
- Claude's call: the tab is where the fixed expenses are listed, so its rows are the count.
- A bill that went inactive without an end date is in neither count (§4.1). Its payments still count in the amounts,
  as today.
- The test `an object group found only on postings opens from its card and reads 0 stk.` holds: a group on postings
  only has no rows.

## 6. One top bar

### 6.1 The bar on every page

Every page has the same bar, with the same parts in the same places:

`Alt forbrug › [the page's step] › [period ▾] [unit] › [main group] › [category] [next level]`, with Konti on the
right.

| Page | The page's step | Period, unit, levels | Konti |
| --- | --- | --- | --- |
| The overview, and its full screen | none | as today | as today |
| The fixed-expenses view | the object-group menu, as today | as today | as today |
| Til overs | "Til overs" as text | the period as today; the dashed unit word and "Hovedgruppe" greyed | greyed |

- **No ←.** The ← button before the trail is gone from the fixed-expenses view and Til overs.
- **"Alt forbrug"** is a blue link on every page but the overview with nothing chosen. On the overview, it is a link
  when a unit or a level is chosen, as today (D55).
- **On the fixed-expenses view and Til overs, "Alt forbrug" leaves the page** for the overview. A click does what ←
  did: it goes back in history when the page was opened from the overview, and replaces the entry otherwise (app.ts's
  `closeFixed` and `closeLeftOver`). Its `href` is the overview with the same period, Konti, level and quick filter,
  with no unit, so a new tab or a copied link lands there too. Claude's call: a link and Back keep working as they do
  now.
- In the fixed-expenses view, the × on a level step and on the unit step still clear that step in the view. "Alt
  forbrug" no longer clears the level in the view (it used to, as a link inside the view). Claude's call: Thomas
  wants it to take him to the overview.
- **Escape and Back** are unchanged: Escape closes the detail, then full screen, then the view. Back walks the history
  as today (D77, D73).
- **Til overs, greyed parts** (Thomas chose mockup A over a working Konti). The dashed unit word (the period's grouping,
  "Måned" for a year) and the dashed "Hovedgruppe" are drawn greyed and cannot be opened. Konti shows "Alle konti
  ({n})", greyed, and cannot be opened. Each greyed part has the tooltip "Til overs regner på alle konti" (Konti) or
  "Til overs viser hele perioden måned for måned" (the unit and Hovedgruppe). Claude's call on the texts. Greyed means
  `disabled` on a button, so it is skipped by Tab and read as unavailable.
- Til overs still covers every account and the whole period (D73). Nothing in its table changes.

### 6.2 What the overview's full screen shows

The postings mockup drew "Alt forbrug › Posteringer". Claude's call: full screen is the overview's right card filling
the page, not a page of its own (D60), so its bar stays as the overview's. The open tab names the card, as today.

## 7. Tests

Through the public interfaces only (CLAUDE.md rule 5), with the fast loop's made-up data. The fake Firefly gets two
bills to cover this: a monthly fixed expense with an end date in an earlier month of the current year, and a yearly
one paid in an earlier month.

- **§2:** the overview has the tabs Søjler, Posteringer and Butikker, and no Faste udgifter. An old hash
  `card=subscriptions` opens the view on the "Alle faste udgifter" tab with every object group, and keeps a
  `detail=s:<id>`, the period, Konti and the level, and drops the unit. The key numbers' links open the view on the
  "Poster i perioden" tab.
- **§3.1:** the two tabs by their accessible names. The tab is in the hash as `tab=all` and back. It stays when the
  object group, the period, the unit or the level changes. Full screen keeps the tab. The heading is the open tab's
  name.
- **§3.2:** the bill that ended in an earlier month shows for that month and for "I år", and not for the month after
  it. A bill that starts after the time does not show. The object-group step, the level and Konti narrow the rows.
- **§3.3:** the ended bill's Om året shows, and the object-group sum and the group sum leave it out in "I år". In its
  last month, it counts in them.
- **§3.4:** model unit tests:
  - a past month with a payment reads "Betalt {date}" with the latest payment's date;
  - a past month with a due date and no payment reads "Ikke set";
  - a yearly bill in a past month without a due date reads "Næste {date}";
  - a refund only reads as no payment;
  - an ended bill in "I år" reads "Sluttet {end}";
  - a past time has no Steget;
  - the Status sort order in a past time and in a time that holds today.
- **§3.5:** a row click opens the detail; ← in the detail goes back to the list; the hash has `detail=s:<id>` with
  `view=fixed` and `tab=all`; changing the tab closes it; Escape closes the detail, then full screen, then the view.
- **§4.1:** server: `keepSubscriptions` keeps a bill whose end date is before today and on or after the range's
  start; it leaves out a bill that ended before the range's start, and an inactive bill with or without an end date.
- **§4.2:** an ended bill adds nothing to "Resterende udgifter", "Estimat for hele …", the bars' estimates or the
  "Forventes" rows. A not-seen last due date before the end shows in "Poster i perioden" only in the time that holds
  it.
- **§5:** the key number's "X stk." equals the tab's rows for the same object group, with a bill that ended in the
  period and one that has no payment in the period. The object-group step reads the same count.
- **§6:** in the fixed-expenses view and in Til overs, there is no button "Tilbage til overblikket". There is a link
  "Alt forbrug". Its click leaves the page: it goes back in history when the page was opened from the overview, and
  replaces the entry otherwise. Its `href` is the overview's hash with the period, Konti and level kept. In Til
  overs, the Konti button and the dashed unit and Hovedgruppe are disabled and have their tooltips. On the overview,
  "Alt forbrug" is text with nothing chosen and a link with a level chosen. The tests that used the back button
  (`fixed-view.test.ts`, `left-over-view.test.ts`) use the link.
- **The Chrome check** ([`testing.md`](../../testing.md#chrome-check)) in the fast loop at 1200, 1440 and 1728 px:
  - the overview without the tab, and no empty area left by it;
  - the view's two tabs, a month clicked in the bars with the ended bill there and gone after its end, a past month's
    statuses, a row's detail, and full screen with the tab;
  - the same bar on the overview, the view and Til overs; "Alt forbrug" leaving the view and Til overs; the greyed
    parts on Til overs.

## 8. Docs

Changed in the same PR:

- `addon/DOCS.md`: the overview's tabs; the view's two tabs; the list following the time and its statuses; ended
  fixed expenses and setting an end date in Firefly III to stop one; the top bar with "Alt forbrug" in place of the ←;
  the greyed parts on Til overs.
- `docs/domain-language.md`: the tab, the `tab=all` key, the Sluttet and Næste statuses, and "ran in the time".
- `docs/architecture.md`: if it names the ← or the overview's Faste udgifter tab.
- `docs/testing.md`: the Chrome check gets §7's steps.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D78 below, and the statuses it changes.

## 9. Decisions

### D78: The fixed-expenses list is a tab of the view, follows the time, keeps ended bills, and one top bar

- **Date:** 2026-11-05 · **Status:** active
- **Decision:**
  - The list of every fixed expense leaves the overview. It is the "Alle faste udgifter" tab of the fixed-expenses
    view's right card (`tab=all`). It shows the bills that ran in the chosen time, with the status as it stood then.
  - The server keeps a bill whose end date has passed, if the end date is in the asked range. It still leaves out an
    inactive bill.
  - The object-group key numbers count the tab's rows.
  - Every page has the same top bar. There is no ←. "Alt forbrug" is a link to the overview, and on Til overs the
    parts that do not apply are greyed.
- **Why:** in a walkthrough, Thomas wanted the fixed expenses in one place, and wanted to see which fixed expenses
  he has and whether something is unpaid, month by month, with a stopped one gone after it stopped. He also wanted
  one top bar.
- **Source:** Thomas, 2026-11-05, [fixed list tab spec](2026-11-05-fixed-list-tab.md) (in `decisions.md` the link is
  `superpowers/specs/…`). The past status rules, the sums leaving out ended bills, the `tab` key, the old-hash
  landing and the greyed texts are Claude's call.

| Decision | Status after this change |
| --- | --- |
| D20 | active; key list superseded by D35, D42, D44, D60, D61, D66, D73, D77 and D78 |
| D33 | active; the key number superseded by D41; the tab's place superseded by D78 |
| D44 | active; "on Alle posteringer" superseded by D60; the fixed-expenses view's tab has the detail too (D78) |
| D62 | active; "opens the Faste udgifter tab in the normal card" superseded by D66; the tab superseded by D78 |
| D73 | active; the ← superseded by D78 |
