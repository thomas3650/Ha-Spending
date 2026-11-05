# Inactive bills with an end date – design

**Real Home Assistant:** no change there. No new option and no new file in `/data`. The release reaches the house
through the house session ([`releasing.md`](../../releasing.md#after-a-release)).

**Issue:** closes #183. One branch, one PR.

**Approved:** by Claude, 2026-11-05, once `reviewer` rates it Ready. Thomas filed the issue with the rule. This spec
only adds the edge cases, and on a small issue Claude approves the small spec itself, with its calls in the PR.

Thomas filed #183 after installing 0.20.0. Everything else in the
[fixed list tab spec](2026-11-05-fixed-list-tab.md) holds. Where they differ, this spec holds: it supersedes that
spec's §4.1 bullet "An inactive bill is still left out, with or without an end date".

## 1. Why

The household ends a fixed expense the way the house's runbook says. It sets the end date at the last payment, sets
`active: false`, and turns off its linking rules. So every ended bill is inactive with an end date.

0.20.0 leaves every inactive bill out, so none of these ever reads Sluttet. Example from the issue: a monthly
subscription that ended at the end of August, inactive with that end date, is missing from August in "Alle faste
udgifter".

The fixed list tab spec's reason was that Firefly III gives no date for when a bill went inactive. That holds only
for an inactive bill without an end date. With an end date, the page knows when it ended.

- **Goal:** an inactive bill with an end date shows in the months it ran, reads "Sluttet {end}" in its last month, and
  is gone after it, the same as an active bill whose end date has passed.
- **Non-goal:** an inactive bill without an end date. It stays out, as today.
- **Anti-goal:** an inactive bill that gets estimates, "Forventes" or "Ikke set" after it stopped.

## 2. The rule

In `keepSubscriptions` (`addon/server/src/firefly/subscriptions.ts`):

- An inactive bill with no `end_date` is left out, as today.
- An inactive bill with an `end_date` follows the same rule as an active one. It is kept when its end date is on or
  after the asked range's start. Otherwise it is left out.
- **An inactive bill whose end date is after today** is kept with its `end` read as today. Claude's call: an inactive
  bill does not run, so no due date after today may give it an estimate. This should be rare, because the runbook
  sets the end date at the last payment.
- An active bill is unchanged.
- Nothing else changes: the object group, the main group, the excluded main groups and the liability rule apply as
  today. So does the link from postings to every bill with an object group.

The page needs no change. It already handles an ended bill (fixed list tab spec §3 and §4.2).

## 3. Tests

Through `keepSubscriptions` and `/api/data` over the fake, with made-up data:

- an inactive bill with an end date before today, and on or after the range's start, is kept with that end;
- an inactive bill with an end date before the range's start is left out;
- an inactive bill with no end date is left out;
- an inactive bill with an end date after today is kept with `end` equal to today;
- an active bill whose end date is after today keeps that end date;
- the fake gets one bill that matches the issue's example: monthly, inactive, with an end date at an earlier month's
  end, paid up to it. `/api/data` returns it with its end. Over the fake, the page's existing "Sluttet" tests can use
  it. A test that names the kept bills is updated on purpose.

#180, the integration seed, gets a comment: its ended bill should be inactive with an end date, as the household
ends its bills.

## 4. Docs

Changed in the same PR:

- `addon/DOCS.md`: "Inactive subscriptions are left out" becomes "An inactive subscription without an end date is
  left out. One with an end date shows up to its end, as an ended one."
- `docs/architecture.md`: the `/api/data` row's "an inactive one is left out" is changed the same way.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D79 below, and D78's status.

## 5. Decision

### D79: An inactive bill with an end date is kept as an ended one

- **Date:** 2026-11-05 · **Status:** active
- **Decision:** the server keeps an inactive bill that has an end date by the same rule as an ended active bill: kept
  when its end date is on or after the asked range's start. When that end date is after today, it reads as today. An
  inactive bill without an end date is still left out.
- **Why:** the household ends a bill by setting an end date and making it inactive. With the end date, the page knows
  when it ran.
- **Source:** Thomas, 2026-11-05, #183; [inactive ended bills spec](2026-11-05-inactive-ended-bills.md) (in
  `decisions.md` the link is `superpowers/specs/…`). The end read as today is Claude's call.

| Decision | Status after this change |
| --- | --- |
| D78 | active; "It still leaves out an inactive bill" superseded by D79 |
