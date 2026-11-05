# The fixed-expenses list as a tab in the view, ended fixed expenses, and one top bar – design

**Real Home Assistant:** no change to the add-on's options or files. After the release, Thomas sets an end date in
Firefly III on each fixed expense that no longer runs (§4.1). The house session's issue for the release names that
step ([`releasing.md`](../../releasing.md#after-a-release)). Until it is done, an inactive fixed expense stays out of
the list, and an active one that stopped without an end date reads Ikke set, as today.

**Issue:** closes #179. One branch, one PR. Touches #145 and #143 without closing them.

**Approved:** by Claude, 2026-11-05, under Thomas's brief ("du arbejder alene til release og issue oprettet"), once
`reviewer` rates it Ready. way-of-working §2.4 has Thomas approve a spec; his brief hands that to Claude, and the PR
says so.

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
- **Non-goal:** inactive fixed expenses. They stay out, as today (§4.1). Thomas stops a fixed expense by setting an
  end date, and will set one on the old ones.
- **Non-goal:** a fixed expense's amount range as it was in the past. The page knows only the bill's current range,
  so a past time has no Steget (§3.4).
- **Non-goal:** the rest of #145 (the Søjler and Butikker tabs at full width) and the rest of #143 (the key numbers'
  labels).
- **Anti-goal:** a count in the tab that disagrees with the key numbers' count of the same fixed expenses in the same
  time.
- **Anti-goal:** an estimate or a "Forventes" for a fixed expense after its end date.
- **Anti-goal:** an ended fixed expense that reads one status in the tab and another in "Poster i perioden".

## 2. The overview

- The right card's tabs are Søjler, Posteringer and Butikker. The Faste udgifter tab is gone.
- The key numbers keep their "Vis faste udgifter →" links into the view (D62, D66). Each opens the view on its own
  object group, on the "Poster i perioden" tab, as today. What their "X stk." counts changes (§5).
- Full screen on the overview (D60) is unchanged.

### 2.1 An old hash with `card=subscriptions`

`card=subscriptions` is no longer a card. `parseHash` reads it as follows. Claude's call: an old link still lands on
the list it pointed to, and no state keeps a card that is gone.

| The hash has | It opens |
| --- | --- |
| `card=subscriptions`, no `view` or `view=full` | the fixed-expenses view on the "Alle faste udgifter" tab, every object group (`og` empty), no full screen |
| `card=subscriptions` with `view=fixed` | the view as the hash says (its `og`, `full` and `tab`) |
| `card=subscriptions` with `view=leftover` | Til overs, as the hash says |

- In every case the state's `card` is `bars`, so leaving the view or Til overs lands on Søjler.
- In the first row, the period, Konti, the level and the quick filter are kept, and a `unit` is dropped: the
  overview's unit and the view's unit are not the same thing. A `detail=s:<id>` is kept and resolves by §3.5. A
  `detail=p:<id>` is dropped.
- In the other rows, a `detail` follows §3.5.

## 3. The "Alle faste udgifter" tab in the fixed-expenses view

### 3.1 The card and the hash

- The right card has two tabs, as a segmented control at its head, the same control as the overview's tabs:
  **Poster i perioden** (the payments list, as today) and **Alle faste udgifter** (the list from the overview's
  Faste udgifter tab).
- The card's heading is the open tab's name. Claude's call, as on the overview.
- The chosen tab is in the hash as `tab=all`. No `tab` is "Poster i perioden". Claude's call: the key is short, like
  `og` and `full`.
  - `tab` is read only with `view=fixed`, as `og` and `full` are. Any other value reads as no `tab`.
  - `toHash` writes it right after `og`, so equal states give equal hashes (D20).
  - Opening the view (`openFixed`) sets "Poster i perioden". Leaving it drops `tab`.
  - A tab change replaces the history entry and keeps the view's marks, so "Alt forbrug", Escape and Back still leave
    the view in one step (§6). Claude's call: the overview's card change pushes, but in the view a push would break
    the way out of D77.
- After a tab change the focus stays on the tab's button.
- Full screen (`full=list`, D77) fills the page with the right card. Its tabs stay at its head, and the tab chosen
  stays.
- Changing the object group, the period, the unit, the level or Konti keeps the tab.
- The list looks and works as the overview's tab does today: the object-group sums at its head ("Faste udgifter …
  om året · Abonnementer … om året"), a group line per main group (or per category in a main group), the columns
  Fast udgift, Kategori, Beløb, Om året and Status, sort by the headers (D40), and Forfalden in red (D77).

### 3.2 Which fixed expenses it shows

- **The object group:** the view's object-group step. "Alle faste udgifter" shows every object group.
- **The level and Konti:** as the overview's tab did. The level goes by the last payment's category. Konti goes by
  the last payment's account (`shown` in `model/subscriptions.ts`).
- **The time:** the chosen unit, or with none chosen, the view's period. With a period that ends in the future ("I
  år", "Denne måned"), the time ends on the period's last day, as the view's span does (`spanEnd` in
  `model/fixed.ts`). This is "the tab's time". The same time decides §5's count on the overview, where the period
  itself ends today.
- A fixed expense shows when it **ran in the tab's time**. Its start (Firefly III's first due date) is on or before the
  time's last day. Its end is empty, or it is on or after the time's first day.
- Example: a monthly fixed expense started on 1 March 2025, with an end date of 31 May 2026. It shows in January to May
  2026, and in "I år". It does not show in June 2026 or later. A fixed expense that starts on 1 December 2026 shows in
  "I år" seen on 5 November, and in December, and not in November.
- A unit after today can be chosen, as today (its bars are estimates). Its rows follow this section, its sums §3.3, and
  its statuses are today's (§3.4).

### 3.3 Om året and the sums

- **Om året** on a row is the bill's yearly amount, as today (`amountPerYear`). It shows for an ended fixed expense
  too, so the row reads what it cost while it ran.
- **The group sums and the object-group sums** at the list's head add up only the fixed expenses that still run on the
  tab's time's last day, or on today when that is earlier. Claude's call: the sums read what the fixed expenses cost
  per year at that point, and an ended one costs nothing from then on.
- A row left out of the sums shows its Om året greyed, with the tooltip "Ikke med i summen: sluttet {end}". Claude's
  call on the text.
- A group line's count ("4 faste udgifter") counts every row in it, ended ones included.

### 3.4 Status

**The due dates.** A new shared function, `dueDatesBetween(s, from, to)`, lists a bill's due dates from `from` to `to`.
It counts from the bill's start (`dueDate(s, k)` from k = 0), as the fixed expenses over time spec §5.3 does, and
stops at the bill's end. `dueDatesUntil` is not used for this: it starts after the last payment.

**The payments.** A bill's payments are the postings linked to it by id (`posting.subscription.id`), from the
postings of the chosen accounts (`ctx.postings`), whatever the level. Claude's call: the level places a row by its
last payment's category, and a payment booked in another category is still the bill's payment. A refund (a positive
amount) is not a payment here.

**Matching.** A due date is **met** when a payment lies from `due − early` to `due + late` (the windows `nextDate`
uses: 7 and 5 days, 2 and 2 for weekly). The payment may lie outside the tab's time. A due date is **open** when
`due + late` is today or later, and it is not met. A due date is **missed** when it is neither met nor open.

**The status of a row**, in the tab's time, for a bill that has not ended before today and a time that ended before
today (for example January, seen in November):

| In the time | Status |
| --- | --- |
| A missed due date | **Ikke set** (red, no border) |
| No missed due date, an open one | today's status for the bill: Forventes or Forfalden (D64, D77) |
| Due dates, all met | **Betalt {date}**, the latest met payment's date (green) |
| No due date | **Næste {date}**, the first due date after the time, by `dueDatesBetween` (grey) |

- A weekly bill with four due dates in a month and three payments reads Ikke set: one due date is missed.
- A past time has no Steget (§1).

**A time that holds today**, or starts after today: the status is today's status, as now (D63, D64, D77), from
`subscriptionStatus`. Claude's call: a unit that holds today, such as the running month, is such a time.

**A bill that ended before today**, in any time: its rows follow the past-time table over its due dates in the time,
up to its end. Where that table would read Betalt or Næste, it reads **Sluttet {end}** (grey, no border, for example
"Sluttet 31. maj"). So a missed last due date reads Ikke set, in the tab and in "Poster i perioden" alike, and an open
one reads Forventes or Forfalden in both.

**The Status sort** sorts Ikke set, Forfalden, Steget, Forventes, Betalt, Næste, Sluttet. Steget and Forventes keep
today's order between them (`STATUS_ORDER`). Claude's call.

### 3.5 The detail

- A click on a row opens the fixed expense's detail (D44), as on the overview's tab. In the normal card, the detail
  takes the card's place, with ← back to the list. In full screen, it stands beside the list.
- **It resolves** only with `view=fixed` and `tab=all`, and only while the bill is a row of the tab (§3.2). It closes,
  through `normalise`, whenever that stops being true: when the tab changes, or when the object group, the period,
  the unit, the level or Konti takes the row away. Example: the detail of a bill that ended in May, then June chosen.
- The detail's status follows §3.4 for the tab's time. The rest of the detail follows the period, as today.
- The detail is in the hash as today (`detail=s:<id>`), with `view=fixed` and `tab=all`. Opening it pushes an entry, as
  on the overview. Escape closes the detail, then full screen, then the view. Focus after the detail's ← goes back to
  the row, as today.
- This supersedes the fixed expenses over time spec §6.4 on the detail, for this tab only. The "Poster i perioden" tab
  has no detail, no sort and no quick filter, as before.

## 4. Ended fixed expenses in the data

### 4.1 The server

- Today `keepSubscriptions` leaves out a bill that is inactive, and a bill whose end date is before today.
- Now it keeps a bill whose end date is before today, as long as the end date is on or after the asked range's start.
  A bill that ended before the range's start is still left out. `keepSubscriptions` takes the range's start for this
  (`read.ts` passes only `today` now).
- An inactive bill is still left out, with or without an end date. Claude's call: Firefly III gives no date for when a
  bill went inactive, so the page cannot tell in which months it ran.
- `Subscription.end` already carries the end date (`shared/src/types.ts`). No new field.
- Postings stay linked to every bill with an object group, as today.
- A bill that ended more than 760 days before today has no `lastPayment` (bills are read for 760 days). It is kept
  only for a range that starts before its end, such as Alt. With no last payment it matches every Konti choice and only
  "Uden hovedgruppe" at a level, as a bill without payments does today.

### 4.2 The page

Everything that reads `data.subscriptions` must allow for an ended bill. Each of these is a test (§7):

- **No estimates after the end.** `nextDate` and `dueDatesUntil` already stop at `end`. "Resterende udgifter",
  "Estimat for hele …", the hatched bars and the "Forventes" rows of "Poster i perioden" get nothing after the end.
- **One status in both lists.** The tab reads Ikke set, Forventes or Forfalden for a bill's last due date exactly when
  "Poster i perioden" shows that due date as not seen or as an estimate (§3.4).
- **The key numbers' object-group cards.** `objectGroupNames` takes the groups of the bills that ran in the tab's time
  (§3.2), and the groups on the period's linked postings, as today. A kept bill that ended before the period (the
  web widens a one-unit period by 12 units, so this happens) adds no card. The view's object-group step takes its
  rows the same way.
- **The counts** follow §5.

## 5. One rule for "X stk."

- Today the object-group key numbers count the distinct bill names among the period's linked payments (D41, D56). The
  tab counted the bills in `data.subscriptions`. A bill that had ended or gone inactive was in the first count and
  not in the second, so the two could differ by one on the same screen.
- Now "X stk." is the number of rows the "Alle faste udgifter" tab shows for that object group, in the tab's time for
  the same period or unit, level and Konti (§3.2). Claude's call: the tab is where the fixed expenses are listed, so
  its rows are the count. On the overview the card is an object-group card of the overview's period; the count uses
  the tab's time for that period, which for "I år" runs to 31 December.
- The object-group step's count in the view is the same number, for the chosen unit, or the period without one.
- The card's line:

  | Payments in the period or unit | Rows | The line |
  | --- | --- | --- |
  | some | some | as today, "… pr. måned · {n} stk." or "{n} stk." in a unit |
  | none | some | "ingen betalinger · {n} stk." |
  | some | none (an inactive bill's payments) | "… pr. måned" or nothing in a unit, without "stk." |
  | none | none | "ingen betalinger", as today |

- An inactive bill is in no count (§4.1). Its payments still count in the amounts, as today.
- The test `an object group found only on postings opens from its card and reads 0 stk.` changes: such a card reads
  no "stk." (the third row).

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
- **On the fixed-expenses view and Til overs, "Alt forbrug" leaves the page** for the overview.
  - A click does what ← did (`closeFixed`, `closeLeftOver` in `app.ts`). It goes back in history when the current
    entry is one the page's open pushed (its marks), and it replaces the entry otherwise.
  - With a detail open in the view, a click closes the detail and the view together. When the detail's entry was
    pushed over the view's own, it goes back over both. Otherwise it replaces.
  - Its `href` is `#` plus `toHash` of the state the replace would write (`leaveFixed` or `leaveLeftOver`, with the
    card set to bars when it is not a card of the overview). A new tab or a copied link lands there.
  - Claude's call: the click and the `href` can land on different states, since Back returns to the entry before the
    view. That keeps Back working as it does now.
  - After a click, the focus goes to the overview's heading, as after ← (`headingAfterBack`).
  - It works while the answer loads and on an error, as ← did (fixed expenses over time spec §8).
- In the fixed-expenses view, the × on a level step and on the unit step still clear that step in the view. "Alt
  forbrug" no longer clears the level in the view (it was a link inside the view). Claude's call: Thomas wants it to
  take him to the overview.
- **Escape and Back** are unchanged: Escape closes the detail, then full screen, then the view. Back walks the history
  as today (D73, D77).

### 6.2 Til overs

Thomas chose mockup A, Konti greyed, over a Konti that works on Til overs.

- Konti shows "Alle konti ({n})", greyed, and does not open.
- The dashed unit word and the dashed "Hovedgruppe" are drawn greyed and do not open. The unit word shows only where the
  overview would show one for the same period (D70); for "Denne måned" there is none.
- Greyed means `aria-disabled="true"`. The part stays in the Tab order. Its accessible description, and its tooltip,
  is "Til overs regner på alle konti" (Konti) or "Til overs viser hele perioden måned for måned" (the unit word and
  Hovedgruppe). Claude's call on the texts: a disabled button would hide the reason from the keyboard.
- Til overs still covers every account and the whole period (D73). Nothing in its table changes.

### 6.3 The overview's full screen

The postings mockup drew "Alt forbrug › Posteringer". Claude's call: full screen is the overview's right card filling
the page, not a page of its own (D60), so its bar stays as the overview's. The open tab names the card, as today.

## 7. Tests

Through the public interfaces only (CLAUDE.md rule 5), with the fast loop's made-up data. The fake Firefly gets three
bills to cover this: a monthly fixed expense whose end date is the last day of an earlier month of the current year,
a monthly one whose end date is in the middle of a month, and a yearly one paid in an earlier month.

- **§2:** the overview has the tabs Søjler, Posteringer and Butikker, and no Faste udgifter. The key numbers' links
  open the view on the "Poster i perioden" tab.
- **§2.1:** each row of the table, with the state's card `bars`; in the first row the period, Konti, the level and a
  `detail=s:<id>` kept, the unit and a `detail=p:<id>` dropped.
- **§3.1:** the two tabs by their accessible names; the heading is the open tab's name; `tab=all` in the hash and
  back, read only with `view=fixed`, written after `og`; the tab stays when the object group, the period, the unit or
  the level changes, and in full screen; a tab change replaces the entry, and "Alt forbrug" then leaves in one step;
  opening the view again starts on "Poster i perioden"; the focus stays on the tab's button.
- **§3.2:** the bill that ended at a month's end shows for that month and for "I år", and not for the month after it;
  a bill that starts after the time does not show, and one that starts later in "I år" shows there; a unit after
  today shows its rows with today's statuses; the object-group step, the level and Konti narrow the rows.
- **§3.3:** in "I år", the ended bills' Om året show greyed with their tooltip, and the object-group sum and the
  group sum leave them out. In the last month of the one that ends at a month's end, it counts in them. In the last
  month of the one that ends mid-month, it does not.
- **§3.4:** unit tests:
  - `dueDatesBetween`: from the start, between two dates, stopping at the end, with skip;
  - a past month with all due dates met reads "Betalt {date}" with the latest met payment's date;
  - a payment a few days before its due date, in the month before, meets it; a payment a few days late, in the next
    month, meets it;
  - a past month with a missed due date reads "Ikke set"; a weekly bill with one of four missed reads "Ikke set";
  - a past month whose due date is still open reads today's Forventes or Forfalden;
  - a yearly bill in a past month without a due date reads "Næste {date}";
  - a refund only does not meet a due date;
  - a payment booked in another category, at a main-group level, still meets the due date;
  - an ended bill in "I år" reads "Sluttet {end}", or "Ikke set" when its last due date was missed;
  - a past time has no Steget;
  - the Status sort order.
- **§3.5:** a row click opens the detail; ← in the detail goes back to the list, with the focus on the row; the hash
  has `detail=s:<id>` with `view=fixed` and `tab=all`; the detail closes when the tab changes, and when a later
  month takes its row away; its status reads as the row's; Escape closes the detail, then full screen, then the view.
- **§4.1:** server: `keepSubscriptions` keeps a bill whose end date is before today and on or after the range's
  start; it leaves out a bill that ended before the range's start, and an inactive bill with or without an end date.
- **§4.2:** an ended bill adds nothing to "Resterende udgifter", "Estimat for hele …", the bars' estimates or the
  "Forventes" rows; with a missed last due date, the tab and "Poster i perioden" agree; in "Denne måned", a kept bill
  that ended months ago adds no object-group card and no step row.
- **§5:** the key number's "X stk." equals the tab's rows for the same object group, with a bill that ended in the
  period, one with no payment in the period, and one that starts after today in "I år"; each row of the line's table;
  the object-group step reads the same count.
- **§6:** in the fixed-expenses view and in Til overs, there is no button "Tilbage til overblikket" and there is a
  link "Alt forbrug". Its click goes back in history when the page's open pushed the entry, and replaces it otherwise;
  with a detail open in the view, it leaves in one click; its `href` is the overview's hash; the focus lands on the
  overview's heading; it works while loading and on an error. In Til overs, Konti, the unit word and Hovedgruppe are
  `aria-disabled`, reachable by Tab, do not open, and have their descriptions; "Denne måned" has no unit word. On the
  overview, "Alt forbrug" is text with nothing chosen and a link with a level chosen. The tests that used the back
  button (`fixed-view.test.ts`, `left-over-view.test.ts`) use the link.
- **The Chrome check** ([`testing.md`](../../testing.md#chrome-check)) in the fast loop at 1200, 1440 and 1728 px:
  - the overview without the Faste udgifter tab;
  - the view's two tabs; a month clicked in the bars with the ended bill there, and gone after its end; a past
    month's statuses; the greyed Om året; a row's detail; full screen with the tab;
  - the same bar on the overview, the view and Til overs; "Alt forbrug" leaving the view and Til overs; the greyed
    parts on Til overs with their tooltips.
- **The integration check** (`scripts/integration`) seeds no bills today. An issue is opened to add an ended bill
  there, so the real Firefly III's answer for an ended bill is checked. Claude's call: that is a change to the
  integration seed of its own.

## 8. Docs

Changed in the same PR:

- `addon/DOCS.md`:
  - the overview's tabs, and the view's two tabs;
  - the list following the time, and its statuses, Sluttet and Næste among them;
  - the key numbers' "X stk." (lines 87–89 today), now the tab's rows;
  - "Inactive and ended subscriptions are left out" (lines 71–72 today): ended ones now show while they ran, and
    setting an end date in Firefly III stops one;
  - the ← (line 113 today), now "Alt forbrug";
  - the greyed parts on Til overs.
- `docs/domain-language.md`: the tab, the `tab=all` key, the Sluttet and Næste statuses, and "ran in the time".
- `docs/architecture.md`: the overview's Faste udgifter card (line 26 today) moves to the view.
- `docs/testing.md`: the Chrome check loses the overview's Faste udgifter tab steps and gets §7's steps.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D78 below, and the statuses it changes.

## 9. Decisions

### D78: The fixed-expenses list is a tab of the view, follows the time, keeps ended bills, and one top bar

- **Date:** 2026-11-05 · **Status:** active
- **Decision:**
  - The list of every fixed expense leaves the overview. It is the "Alle faste udgifter" tab of the fixed-expenses
    view's right card (`tab=all`). It shows the bills that ran in the chosen time, with the status as it stood then.
  - The server keeps a bill whose end date has passed, if the end date is on or after the asked range's start. It
    still leaves out an inactive bill.
  - The object-group key numbers' "X stk." counts the tab's rows.
  - Every page has the same top bar. There is no ←. "Alt forbrug" is a link to the overview, and on Til overs the
    parts that do not apply are greyed.
- **Why:** in a walkthrough, Thomas wanted the fixed expenses in one place, and wanted to see which fixed expenses
  he has and whether something is unpaid, month by month, with a stopped one gone after it stopped. He also wanted
  one top bar.
- **Source:** Thomas, 2026-11-05, [fixed list tab spec](2026-11-05-fixed-list-tab.md) (in `decisions.md` the link is
  `superpowers/specs/…`). The past status rules, the sums leaving out ended bills, the count rule, the `tab` key, the
  old-hash landing and the greyed texts are Claude's call.

| Decision | Status after this change |
| --- | --- |
| D20 | active; key list superseded by D35, D42, D44, D60, D61, D66, D73, D77 and D78 |
| D33 | active; the key number superseded by D41; the tab on the overview superseded by D78 |
| D40 | active; Alle posteringer's `sort` in the hash and the why that rests on D37 superseded by D60; the Faste udgifter tab's place superseded by D78 |
| D41 | active; the period's payments with the sum per month superseded by D56, the first key number's link to Alle posteringer by D60, the count of bills by D78 |
| D44 | active; "on Alle posteringer" superseded by D60; where a subscription's detail opens superseded by D78 |
| D56 | active; "the card's link keeps the unit" superseded by D62; the bill count superseded by D78 |
| D62 | active; "opens the Faste udgifter tab in the normal card" superseded by D66; the tab itself superseded by D78 |
| D73 | active; the trail superseded by D78 |
| D77 | active; "Forfalden is red in the Faste udgifter tab" superseded by D78 (the tab is in the view) |
