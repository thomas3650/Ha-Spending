# The date in the status in the fixed list's full screen – design

**Real Home Assistant:** no change there. No new option and no new file in `/data`.

**Issue:** closes #189.

**Approved:** by Claude, 2026-11-07, once `reviewer` rates it Ready, under Thomas's brief: in full screen the status
pill shows when a payment is expected. The rest is Claude's call.

## 1. Why

In the fixed-expenses view, the list "Poster i perioden" in full screen reads only "Forventes" in an estimate's status
pill. Thomas could not see when the payment is expected, and wants it in the pill in full screen. Today the status is
one word in both sizes, since the Dato column holds the date ([fixed view full screen
spec](2026-11-04-fixed-view-full-screen.md) §2.1, §3.3, [D77](../../decisions.md)).

- **Goal:** in full screen the status pill names its date.
- **Non-goals:** the normal card, which keeps one word for its narrow width. The "Alle faste udgifter" tab, which
  already names its dates. A year unit's rows, which have no status column.

## 2. The rule

In the payments list of the fixed-expenses view, in full screen only, each status carries the row's date, in the
texts the "Alle faste udgifter" tab already uses (`da.status` in `addon/web/src/i18n/da.ts`):

| Payment | Normal card | Full screen |
| --- | --- | --- |
| Paid | Betalt | Betalt 1. nov |
| Estimate | Forventes | Forventes 2. dec |
| Due estimate | Forfalden | Forfalden 3. nov |
| Not seen | Ikke set | Ikke set · ventet 7. okt |

- The date is the row's Dato, written the same way (`shortDate`, the year added outside the current year).
- The pill's colour, border and place are as today. The Dato column stays.
- Claude's call: every status carries its date, not only Forventes, so the full-screen list reads like the "Alle
  faste udgifter" tab beside it. Thomas asked for the estimate's date; a due estimate and a not-seen row also have an
  expected date, and a paid row's date makes the column read alike.
- Claude's call: in full screen the status cell may be wider. Dato, Beløb and Status still never clip; the name and the
  category give way as today (fixed view full screen spec §2.2).

## 3. Tests

Through the list's row model `fixedList` in `addon/web/test/fixed-model.test.ts`, with the existing made-up bills.
The `full` flag already reaches `fixedList` from the page (`addon/web/src/app.ts`), as the badge test checks, so no
page-level test is needed.

- In full screen, a paid, an estimate, a due and a not-seen row each read the dated text, checked as literal text with
  the row's date, such as "Forventes 1. dec".
- A row from last year (`period=lastYear`) reads its year in the pill, such as "Betalt 1. dec 2025", as in its Dato.
- A year unit in full screen keeps `status: null`.
- In the normal card the same rows read one word, as the existing tests check.

## 4. Docs and code comments

- `addon/DOCS.md`: the payments list's status is one word in the normal card and names its date in full screen.
- `addon/web/src/i18n/da.ts`: the comment on `da.fixed.status` says the one word is the normal card's, and full
  screen uses `da.status`.
- `docs/decisions.md`: D81 (§5). D77's status becomes `active; "Forfalden is red in the Faste udgifter tab"
  superseded by D78 (the tab is in the view); the one-word status in full screen superseded by D81`.
- `docs/domain-language.md`, the Subscription status row: a clause "in the fixed-expenses view's payments list the
  status is one word in the normal card and carries its date in full screen ([D77], [D81])".
- `docs/testing.md`, the Chrome check's step 54: in full screen the list's statuses read "Betalt 1. nov",
  "Forventes 2. dec", "Forfalden …" and "Ikke set · ventet …", and one word in the normal card. Checked at the step's
  widths (1100, 1200, 1440, 1728 and 900 px) with "Sidste år" too, so the longest dated status the fast loop
  shows, with its year, is seen: Dato, Beløb and Status not cut, and no sideways scroll beyond what the step already allows. The step
  links this spec and D81.
- `docs/README.md`: this spec in the specs list, and its plan in the plans list.

## 5. D81

- **Decision:** in the fixed-expenses view's payments list in full screen, each status carries the row's date, in the
  "Alle faste udgifter" tab's texts ("Betalt 1. nov", "Forventes 2. dec", "Forfalden 3. nov", "Ikke set · ventet 7.
  okt"). The normal card keeps the one word.
- **Why:** Thomas could not see in the pill when a payment is expected, and full screen has the room.
- **Source:** Thomas, 2026-11-07, #189, this spec. That every kind is dated, and that the status cell may be wider,
  are Claude's call.
