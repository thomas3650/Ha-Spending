# Inactive bills with an end date – design

**Real Home Assistant:** no change there. No new option and no new file in `/data`. The release reaches the house
through the house session ([`releasing.md`](../../releasing.md#after-a-release)).

**Issue:** closes #183. One branch, one PR.

**Approved:** by Claude, 2026-11-05, once `reviewer` rates it Ready. Thomas filed the issue with the rule. This spec
only adds the edge cases, and on a small issue Claude approves the small spec itself, with its calls in the PR.

Thomas filed #183 after installing 0.20.0. Everything else in the
[fixed list tab spec](2026-11-05-fixed-list-tab.md) holds. Where they differ, this spec holds. It supersedes that
spec's §4.1 bullet "An inactive bill is still left out, with or without an end date", its §1 non-goal on inactive
bills, and its §5 line "An inactive bill is in no count": an inactive bill with an end date now counts as any ended
bill.

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
- An inactive bill with an `end_date` on or before today follows the same rule as an active one. It is kept when its end date is on or
  after the asked range's start. Otherwise it is left out.
- **An inactive bill whose end date is after today** is left out, as one without an end date is. Claude's call: an
  inactive bill does not run, so its end date cannot be in the future, and the page cannot tell when it stopped.
  Reading the end as today would give a row that never reads Sluttet, or one with "Forventes" after it stopped. This
  should be rare, because the runbook sets the end date at the last payment.
- An active bill is unchanged.
- Nothing else changes: the object group, the main group, the excluded main groups and the liability rule apply as
  today. So does the link from postings to every bill with an object group.

The page's code needs no change. `Subscription` has no `active` field, so a kept inactive bill is an ended bill to
the page, and its ended-bill rules and tests apply (fixed list tab spec §3 and §4.2). What the page shows does
change: the bill is a row of "Alle faste udgifter" in the months it ran, and it counts in "X stk." there.

## 3. Tests

Through `keepSubscriptions` and `/api/data` over the fake, with made-up data:

- an inactive bill with an end date before today, and on or after the range's start, is kept with that end;
- an inactive bill with an end date before the range's start is left out;
- an inactive bill with no end date is left out;
- an inactive bill with an end date after today is left out;
- an active bill whose end date is after today is kept with that end date;
- the fast loop's seed (`addon/dev/src/generate.ts`): Avisabonnement, which already matches the issue's example
  (monthly, ended at an earlier month's end, paid up to it), becomes inactive. So the fast loop and the Chrome check
  show an inactive ended bill reading "Sluttet". Tidsskrift stays active, so both kinds stay covered;
- the example seed (`addon/dev/src/example.ts`), which drives the server's `/api/data` tests and the integration
  comparison with a real Firefly III: Gammel forsikring, which ended on 2026-10-29, becomes inactive. `/api/data`
  returns it with its end for a range that starts on or before its end. The integration test "gives the same
  subscriptions as the fake does for the same seed" then checks that a real Firefly III lists an inactive bill with
  its end date and payments as the fake does.

Tests changed on purpose, named in the build's report:

- `addon/server/test/subscriptions.test.ts`: "leaves out an inactive bill, with or without an end date" becomes the
  two cases above, and any list of kept names follows Gammel forsikring;
- `addon/dev/test/generate.test.ts`: Avisabonnement's assertions add `active: false`;
- any count over the example seed that moves, each named.

A test comment in `addon/web/test/key-numbers.test.ts` ("Payments linked to a bill Firefly III no longer gives, as for
an inactive one") is narrowed to an inactive bill without an end date.

#180 gets a comment: the example seed already holds ended bills, and after this change one of them is inactive with
an end date, as the household ends its bills. What #180 still adds is up to that issue.

## 4. Docs

Changed in the same PR:

- `addon/DOCS.md`: "Inactive subscriptions are left out" becomes "An inactive subscription without an end date is
  left out. One with an end date shows up to its end, as an ended one."
- `docs/architecture.md`: the `/api/data` row's "an inactive one is left out" is changed the same way.
- `docs/testing.md`: the Chrome check's ended bill to look for (step 55) names Avisabonnement as inactive.
- `docs/README.md`: the map gets this spec and its plan.
- `docs/decisions.md`: D79 below, and D78's status.

## 5. Decision

### D79: An inactive bill with an end date is kept as an ended one

- **Date:** 2026-11-05 · **Status:** active
- **Decision:** the server keeps an inactive bill with an end date on or before today by the same rule as an ended
  active bill: kept when its end date is on or after the asked range's start. An inactive bill without an end date,
  or with one after today, is still left out.
- **Why:** the household ends a bill by setting an end date and making it inactive. With the end date, the page knows
  when it ran.
- **Source:** Thomas, 2026-11-05, #183; [inactive ended bills spec](2026-11-05-inactive-ended-bills.md) (in
  `decisions.md` the link is `superpowers/specs/…`). Leaving out an inactive bill whose end date is after today is Claude's call.

| Decision | Status after this change |
| --- | --- |
| D78 | active; "It still leaves out an inactive bill" superseded by D79 |
