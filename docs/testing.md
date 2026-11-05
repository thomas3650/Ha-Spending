# Testing

The gates are in [`CLAUDE.md`](../CLAUDE.md#commands) → *Commands*; CI runs the same. What a test may check is
`CLAUDE.md` hard rule 5. This doc covers testing beyond the gates: the fast loop, the image check and the Chrome
check ([technical spec](superpowers/specs/2026-10-30-technical-design.md) §7.3), and the
[integration tests](#integration-tests).

## Fast loop

Every PR. The server and the page on the Mac, with a fake Firefly III and nothing from Home Assistant.

1. `scripts/setup` once per clone, and after a dependency change.
2. `scripts/develop`. Claude starts it with the Bash tool's `run_in_background`; it stays in the foreground until it is
   stopped. It starts, each in the background with its log and pidfile in `local/`:
   - the fake Firefly III (`addon/dev`) on port 8091 with generated data (log `local/fake.log`). Set
     `FAKE_FIREFLY_FAULT` to `refused`, `error` or `slow` before `scripts/develop` to see the error states;
   - the server (`npm run dev` in `addon/server`, which restarts on a change) on port 8099, with `HA_SPENDING_DEV=1`,
     so the ingress check is off, `HA_SPENDING_OPTIONS` set to `addon/dev/options.json`, which points at the fake (a
     value already set wins, so a copy of that file in `local/` can replace it), and `HA_SPENDING_WEB_DIR` unset, so it
     serves no page at `/`: the default web directory `/opt/ha-spending/web` does not exist on the Mac (log
     `local/server.log`); `HA_SPENDING_HIDDEN_SHOPS` is `local/hidden-shops.json`, the hidden shops' file (git-ignored;
     delete it to start with none);
   - Vite's dev server with the page on `http://127.0.0.1:5173`, which passes `/api` to the server (log
     `local/web.log`).

   It waits until the fake and both others answer, and stops with an error naming the log when one does not.
3. Check: `curl -s http://127.0.0.1:5173/api/health` gives the health JSON (the page itself calls `api/data`), and `curl -s http://127.0.0.1:5173/`
   holds `<hs-app>`. `curl -s 'http://127.0.0.1:5173/api/data?start=2026-01-01&end=2026-01-31'` gives the postings
   of the made-up data.
4. Open `http://127.0.0.1:5173/` for the [Chrome check](#chrome-check).
5. `scripts/develop stop` (from another shell) stops all three and waits until 8091, 8099 and 5173 are free.

To wait for the loop from a script, as `scripts/develop` does:
`curl -sf -o /dev/null --retry 30 --retry-delay 1 --retry-connrefused --retry-all-errors http://127.0.0.1:5173/`.

## Image check

For a change to `addon/Dockerfile`, `addon/config.yaml` or what the image holds. It runs the image as the add-on
would, on the Mac.

1. `docker build -t ha-spending:dev addon`.
2. `docker run --name hs ha-spending:dev` without options exits 1, and `docker logs hs` names `/data/options.json`,
   `firefly_url` and `firefly_token`. Then `docker rm hs`.
3. With options and the ingress check on, `docker run -d --rm -p 8099:8099 -e HA_SPENDING_OPTIONS=/opt/options.json
   -v "$PWD/addon/dev/options.json:/opt/options.json:ro" --name hs ha-spending:dev`:
   `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/` gives `403` (the peer is not ingress), and
   `docker exec hs node -v` gives `v24.…`. Then `docker stop hs`.
4. The same with `-e HA_SPENDING_DEV=1`, which binds `127.0.0.1` inside the container:
   `docker exec hs wget -qO- http://127.0.0.1:8099/api/health` gives the health JSON with the version in
   `addon/config.yaml`. The fake is not reachable from the container, so the server logs that Firefly III is
   unreachable. That is harmless. Then `docker stop hs`.

## Integration tests

For a change to the Firefly III client, the mapping or the options. `scripts/integration` starts a real Firefly III
from `addon/dev/firefly/compose.yaml`, makes a user and a token in it, seeds it with the example data, runs the
server's integration tests against it and removes it, also on failure. They also run the sorter's two tools and the
chat's tools against it, so their search and their writes, a shop's expense account, a refund's revenue account and a
move's notes included, are checked on a real Firefly III ([D30](decisions.md), [D32](decisions.md),
[D34](decisions.md), [D50](decisions.md)). Docker must run. It
listens on port 8090; `FIREFLY_PORT` changes that. The token lives only in the run's environment and is never written or
printed. CI runs the script as the `integration` job ([`releasing.md`](releasing.md#the-workflows)). The design is
technical spec §7.2 ([technical spec](superpowers/specs/2026-10-30-technical-design.md)); the token script is
[D17](decisions.md).

## Chrome check

For every UI change, in the fast loop. `reviewer` runs it last in every branch review, in Claude in Chrome
([D45](decisions.md)):

- A new Chrome tab at `http://127.0.0.1:5173/`. The window is **1440×960**, the mockups' size
  ([mockups](mockups/README.md)).
- Compare each screen and state the change touches with its mockup in the
  [UI spec](superpowers/specs/2026-10-30-ui-ux-design.md).
- No errors in the console.
- Screenshots go in `screenshots/<YYYY-MM-DD>-<topic>/` in the repo root. The folder is git-ignored. The PR
  description lists the screens checked and the folder. Screenshots show made-up data only, never the real Firefly III.

### The screens and states

The page's list. Every screenshot is at 1440×960 with the console free of errors, compared with the mockup named
(files in `docs/mockups/v2/`).

1. `01-alt-forbrug`: the opening view, with every main group in the circle, the eight largest in colour and the rest
   grey. Compare `1-alt-forbrug.png`.
2. `02-hover`: the mouse on a small group's name. The name has a light blue background, the line is blue and the piece
   is out.
3. `03-focus-piece`, `04-focus-bar`: Tab to a circle name, then to a bar. Each shows the highlight from the keyboard.
4. Clicks, each with a screenshot after it: `05-click-piece` (on a piece), `06-click-label` (on an ECharts label) and
   `07-click-bar` (on a bar). Each does what its button does.
5. `08-periode`, `10-konti`: the period step in the trail and Konti open; the period panel under its step holds the
   presets with "Alt" and the calendar with two months. Compare `1-alt-forbrug-konti.png`; the period panel has no
   mockup file, its design is the lists spec §1.2 and the [top filter spec](superpowers/specs/2026-11-04-top-filter.md)
   §2.2. Load the page once with `#by=week` and check that it opens on months, with no Gruppér pr. field.
6. `11-flere-maaneder`: a custom period of a few months. The first bar is clipped and the last is light, with "i gang".
7. `12-denne-maaned`: Denne måned. The average reads "gns. … før".
8. `13-posteringer`: screen 1 on Posteringer.
9. `14-link`: a click on a posting opens a new tab at the fake's `/transactions/show/<id>`. `addon/dev/options.json`
   sets `firefly_link_url` to the fake, so the tab may show the fake's 404; the URL is what is checked.
10. `15-hovedgruppe`, `16-kategori-soejler`, `17-kategori-posteringer`: Mad, then a category with bars, then with
    postings. Compare `2-hovedgruppe*.png`.
11. `18-uden-hovedgruppe`: Uden hovedgruppe as a screen, with its categories and Uden kategori.
12. `19-posteringer-fuld-skaerm`, `20-stoerste-foerst` (a click on the Beløb header), `21-beloeb`, `22-ingen-match`:
    Posteringer in full screen, from "N posteringer →"; sorted by size as a flat list, the Beløb header with ▲ and
    aria-sort ascending after the first click (largest spending first) and the other columns sorting by a click; the
    Beløb pill open; a search nothing matches (`da.noMatch`). Compare `3-posteringer.png`.
13. `23-soejle`, `24-soejle-kategori`: a click on a bar opens Posteringer for that month. A chosen month at all
    spending, then in Mad with a category chosen, with the trail "Alt forbrug › <month> › Mad › <category>". With the
    month chosen, the key numbers are the month's sum and the two object groups, with no ▲, ▼ or red. Compare
    `4-soejle.png`.
14. `25-loading` (`FAKE_FIREFLY_FAULT=slow`), `26-refused` (`refused`), `27-unreachable` (`error`), `28-empty` (a period
    typed in Fra and Til in a year with no data).
15. `29-ingen-regelgruppe`: `scripts/develop` with `HA_SPENDING_OPTIONS` pointing at a copy of `addon/dev/options.json`
    in `local/` whose `main_group_rule_group` names a group that does not exist. The page shows `da.noRuleGroup` once.
16. `30-1024`: the window at 1024×960 (the four key numbers in five columns, the end of the row empty). The frame is
    1024 px or wider, so the halves sit side by side, equal ([D24](decisions.md)). The circle's names neither overlap
    nor are cut.
17. `31-900`: the window at 900×960. The halves stack, and the four key numbers sit two by two.
18. Back: three clicks, then back three times returns to the opening view.
19. `33-posteringer-soeg`: screen 1 on Posteringer with a search typed. The search row sits under the title, its field
    taking the row's whole width, with no "Vis alle" button in either width; the count and the sum follow the search;
    the circle and the key numbers do not. Also at 1728 px. Back after typing returns to the view before the first key.
20. `34-posteringer-ingen-match`: a search nothing matches on the overview: the summary at 0 and `da.noMatch`, with the
    search row still there.
21. `35-abonnementer`, `36-abonnementer-hovedgruppe`: the right card's Faste udgifter choice, so the card shows on Alt
    forbrug, then on a main group (the key numbers are not buttons). Every status shows, the order within each group is
    Ikke set, Steget, Forventes, Betalt, and the names link to the fake. Also at 1728 px; compare `docs/mockups/v3/`.
22. `37-butik-forslag`: screen 1 on Posteringer with part of a shop's name typed. The suggestions open under the field,
    over the list. Names that start with the typed text come first, then the rest, each group biggest sum first, and
    each row shows its sum; a mouse-over shows the bank text. Also at 1728 px.
23. `38-butik-valgt`: a shop chosen from the suggestions. The chip "Butik: …" sits on its own row under the search
    field; the field keeps the row's whole width and the focus. Only that shop's rows show, and the count and the sum
    are its own. The ✕ and Back undo it. The same in full screen.
24. `39-fuld-skaerm`: screen 1 on Posteringer with "Fuld skærm" pressed. The right card alone, the full width; the
    button sits on the title's row at every width. The view switch moves under the title when the card is under 700 px
    wide. Escape and the button bring the circle and the key numbers back. Also on Søjler and Faste udgifter, at 1440
    and 1728 px.
25. `40-faste-udgifter-grupper`: Faste udgifter at Alt forbrug, grouped by main group with a Kategori column, each
    group's dot the same colour as its part in the circle; then at a main group, grouped by category.
26. `41-objektgrupper`: Faste udgifter at Alt forbrug and at the main group Abonnementer. Each row carries the pill with
    its object group's title, and the boxes under the head show one yearly sum per object group. Also at 1440 and 1728
    px.
27. `42-posteringer-maerke`: Posteringer, normal and in full screen, with marked rows. A posting linked to a bill carries the
    pill, and its tooltip gives the bill's name. Also at 1440 and 1728 px.
28. `43-kalender`: the period menu with the calendar. Pick two days by mouse, then press Vis; the period's trail
    step shows those days, and "Valgt periode" is only in the step's accessible name. Repeat with the keyboard: Tab to a day, Enter or Space picks it, and the picked start and
    end are announced. Check that a pick, a change of month or year, and a redraw that removes the focused day keep the
    menu open, and that days after today cannot be picked. Check the month and year lists by mouse and keyboard, and the
    year list's floor. Type `3.1.2024` in Fra and Til: the calendar moves there. Also "Alt": the trail step reads
    "Alt" with the dates. The open menu stays inside the frame at 1440, 1728, 1024 and 900 px. Do this in Safari as well
    as Chrome; Safari is where the typed year failed.
29. `44-sorter`: Posteringer, normal and in full screen, sorted by each column: one click and a second click; the sorted header
    is bold with its arrow; sorted by the date the groups return. Faste udgifter sorts inside each group, with Status
    ascending at the start. The card's sort survives a switch to Søjler and back, and is gone after a reload.
30. `45-noegletal`: the first key number with "N posteringer →" at Alt forbrug, a main group, a category and a chosen
    unit; a click opens Posteringer in full screen with no search, shop or amount. The object group key numbers show the sum, the sum per
    month and the count; a click on the card does nothing, only the link clicks. With a chosen unit they show that
    unit's sum and "N stk." as "<group> i <unit>". Also at 1440, 1728, 1024 and 900 px, with no comparison card at any
    of them. At 1440 and 1728 px the cards are a fifth of the row wide and the end of the row is empty, with and without
    a chosen unit.
31. `46-objektgruppe-link`: the two object group key numbers at Alt forbrug and at a
    main group; the link "Vis faste udgifter →" under each opens the fixed-expenses view ([D66](decisions.md)), and Back
    returns to the card before. At 1440 px.
32. `47-butikker`: the Butikker card at Alt forbrug, at a main group and at a category (the title "Butikker i Mad"), and
    with a chosen unit as a step in the trail. The rows run biggest first, with place, bar, sum and share; "Uden butik"
    sits under the list. A click on a name opens Posteringer with the shop's chip, and Back returns. Also this card's
    "Vis alle" and "Vis færre", and full screen. At 1440 px.
33. `48-butikker-skjult`: "Skjul" on a shop removes its row, and the places close up. "Vis skjulte (n · sum)" shows it
    grey with "Vis"; "Vis" brings it back. After a reload the hidden shops are as they were, and the circle and the
    shares are unchanged. Stop the server for a moment to see "Kunne ikke gemme. Prøv igen." on a write and "Skjulte
    butikker kunne ikke hentes." on a start.
34. `49-detalje`: the detail of a fixed expense, a subscription and a shop (a row on Posteringer and Faste udgifter),
    on the normal page and in full screen. At 1440, 1728 and 1000 px. Tab to a
    row's name and press Enter: the detail opens and the focus is on its heading; "Luk" and Escape close it and the
    focus is back on the row. The amounts in the detail's rows have the same sign as the list beside it (spending minus,
    a refund plus). A click on a row, or on its date, opens that posting in Firefly III in one new tab, also on a double
    click. "Vis alle N"/"Vis færre" and "Åbn i Firefly III" stand on lines of their own. Compare `docs/mockups/v5/`.
35. `50-indlaeser`: with `FAKE_FIREFLY_FAULT=slow`, the loading placeholder has as many key-number boxes as the loaded
    page (UI polish spec §1.1).
36. `51-hoved-raekke`: the right card's head row stays on one line at 1440 and 1728 px, on the normal page and in full
    screen, with nothing chosen, a category, a unit, and both. No button moves between those states, since the tabs no
    longer change.
37. `52-detalje-staar`: in full screen at 1440 px the detail stays in view while the list
    scrolls, a click on a row does not scroll the page, and closing the detail (Escape or "Luk") does not scroll the
    page. Below 1024 px the focus still lands on the detail's heading (spec §2.1).
38. `53-detalje-bokse`: the detail's three boxes each fit on one line at 1440 and 1728 px (spec §2.2).
39. `54-banktekst`: a search that hits the bank's text shows that text in grey under the shop (spec §3.1).
40. `55-beloeb-dato-beskeder`: the Beløb and date messages appear on blur or Enter, not while typing; the period
    picker's dash stays aligned when a message shows (spec §3.2, §3.3).
41. `56-filter-soeg`: the quick filter's search over the Posteringer list, in both widths: typing filters the list, and
    the suggestions offer shops with their count and sum.
42. `57-soejle-under-nul`: a bar below zero (step 50 finds such a bar): the axis goes only a little below it, with no
    odd bottom label (spec §5.7).
43. `58-maanedens-dage`: "Sidste måned" and "Denne måned" at Alt forbrug and Mad, at 1440 and 1728 px, normal and full
    screen ([month days spec](superpowers/specs/2026-11-03-month-days.md)). One bar per day, readable axis labels, today
    lighter with "i gang", the days after today empty, no average line, the tooltip on a day, and a day below zero
    (step 50). The day bars are not buttons in a one-month period: a click on a day does nothing.
44. `59-kategori-liste`: at 1440 and 1728 px, the list under the trail's main group and category steps, and under the
    dashed button: the rows are the circle's pieces in its order, each with its colour dot and sum, and the chosen one is
    marked. "Uden hovedgruppe" and "Uden kategori" show when they have a piece. Tab reaches every row in order.
45. `60-gennemgang-rettelser`: the fixes from the 0.11.0 walkthrough ([walkthrough fixes
    spec](superpowers/specs/2026-11-03-walkthrough-fixes.md)), at 1440 and 1728 px, on the normal page and in full
    screen. The full-screen button sits on the title's row on Søjler, Posteringer and Faste udgifter. The title still
    ends in "…" when long. No key-number card has a hover border or a ring, as none is a button. "Vis alle" is not on
    the Posteringer search row, in the normal card or in full screen. A chosen shop's chip sits under the search field.
    With the suggestion list open, Tab chooses the highlighted suggestion, or the first one when none is highlighted;
    Shift+Tab chooses nothing. A day bar's tooltip names its date once: two lines for a day, three for a whole month.
    The running bar is drawn faded on the bars and in the detail.
46. `61-finere-soejler`: at 1440 and 1728 px, normal and full screen ([finer bars
    spec](superpowers/specs/2026-11-03-finer-bars.md)): a custom one-week period, a custom one-month period, "I år" in January, "Sidste måned" and
    "Denne måned", and the detail of a fixed expense on "Sidste måned". The finer bars, their titles, no average line,
    the running unit lighter, the detail's names thinned and readable, and no click on a bar, since the period is the
    one unit. A day below zero (step 50).
47. `62-et-filter`: the trail as the overview's filter ([one filter spec](superpowers/specs/2026-11-04-one-filter.md)),
    at 1440 and 1728 px, normal and full screen. The trail with its × in the thin light-grey look (B1), the × in a 24 px
    round hit area, hover and focus giving it a light background. Each × removes its step and puts the focus on the
    heading; Back brings the step back. The key numbers with and without a unit; the full-screen button level with the
    tabs in both widths; the bar tooltip hiding when the mouse leaves the chart, and on a window blur. In full screen
    Posteringer the Kategori column shows from 600 px up. The y-axis of the bars writes its ticks with `axisTickKr`:
    step 50 and D68.
48. `63-smaa-rettelser`: the small fixes from the walkthrough ([small walkthrough fixes
    spec](superpowers/specs/2026-11-04-walkthrough-small-fixes.md)), at 1440 and 1728 px, normal and full screen.
    Faste udgifter: a Steget row reads in whole kroner with no øre, and its Beløb shows the same number as the
    latest payment. The Fitnessabonnement row reads Forfalden with no "næste" under its name. The repeat ("pr.
    måned") sits on its own line in every row. Every group header keeps its name and count on one line. The circle's
    small labels are apart, and each leader line runs to its piece. Butikker: every track starts and ends at the same
    place in the shown list and in the hidden one ("Vis"). A shop with a share above zero but under 1 % reads "< 1 %".
49. `64-oeverste-filter`: the top filter, the quick filter and the one full-screen list ([top filter
    spec](superpowers/specs/2026-11-04-top-filter.md) §8), at 1440 and 1728 px, normal and full screen. The trail with
    its dropdown steps and the dashed button, and no Periode or Gruppér pr. field. The period panel under its step. The
    Beløb pill empty, open and filled, in all four kinds, and the search and the pill the same height. The sentence
    over the list and "Ryd". The full-screen list with a detail open: no wrapped cells and no Konto column. Back and ⤡
    out of full screen.
50. `65-fuld-skaerm-soejler`: the full-screen Søjler chart ([full-screen bars
    spec](superpowers/specs/2026-11-04-full-screen-bars-and-follow-ups.md) §1, [D67](decisions.md)).
    At 1440 and 1728 px, in full screen on the Søjler tab, the chart reaches the window's bottom edge, and the page does
    not scroll. In a window about 500 px high, the chart stays 400 px, and the page scrolls.
    With a unit, a main group and a category chosen, the chart still ends at the window's bottom, with no page scroll.
    In a window narrow enough for the trail to wrap, the chart is shorter by that line.
    Back in the normal card, the chart is 400 px.
    A bar below zero: every month in the example data has one "Retur …" deposit, in a category under Tøj, Fritid or
    Mad. On Posteringer, search "Retur" to find last month's, and read its main group from its category. Choose
    "Sidste måned" and that main group on Søjler. The refund's day is below zero unless a bigger purchase in that main
    group falls on the same day; then use the month before, as a custom period.
    The bar's tooltip says "+… kr. retur", the axis goes only a little below zero, and no tick has a minus.
    The accessibility tree of the trail's steps and of the Beløb pill shows no "menu", and the empty pill is named
    "Filtrér på beløb".
51. `66-hullets-tekst`: the donut's centre ([small follow-ups spec](superpowers/specs/2026-11-04-small-follow-ups.md) §2).
    Choose a month and a main group with a long name (two words and "og"). The name is on at most two lines inside the
    hole, the unit ("i …") is on its own line under it, and the amount is under that. At Alt forbrug with a month
    chosen, the unit alone is the name. Also at 1600 px wide and with the chart under 400 px wide (narrow).
52. `67-faste-udgifter-over-tid`: the fixed-expenses view ([fixed expenses over time
    spec](superpowers/specs/2026-11-04-fixed-expenses-over-time.md) §9), at 1440 and 1728 px. The way in from both
    object-group cards, and the object-group step with its list of groups and "Alle". "I år", "Denne måned", "Sidste år"
    and "Alt": the four key numbers, the hatched estimates and the "i dag" line only where the span runs past today.
    A chosen unit, and the month step in the trail ([D70](decisions.md)) on the overview and in the view: the dashed
    "Måned", the list with its sums, a month without its year inside one year, and the cross. The colours at Alt
    forbrug, in a main group and in a category. The way out by ← and by Back.
53. `68-til-overs`: the Til overs card and view ([Til overs spec](superpowers/specs/2026-11-04-left-over.md) §2 and
    §4), at 1440 and 1728 px, in the example data with the three options set. On the overview the card sits after the
    period's own cards and before the object groups' cards, with no colour and no "+"; with a main group, a category or
    an account chosen it is gone. "Vis måneder →" opens the view. A row adds up from left to right: Til overs is Ind,
    Tilbage and Forbrug as shown, and Ændring på konti is Til overs, Kreditten, Opsparing and Øvrigt; so does "I alt",
    and its Til overs is the card's number. A month's button opens the overview for that month. ← and Escape leave the
    view.
54. `69-fuld-skaerm-faste-udgifter`: the fixed-expenses view's full screen, tooltip and red Forfalden ([fixed view full
    screen spec](superpowers/specs/2026-11-04-fixed-view-full-screen.md) §6, [D77](decisions.md)), at 1100, 1200, 1440
    and 1728 px, at 900 px for the stacked halves, and in a window about 500 px high.
    From 1200 px up the normal list fits with no sideways scroll, no badge and no cut status or sum, with one object
    group and with "Alle". At 1100 px nothing is cut off or covered, and any sideways scroll stays inside the list.
    Each card's "Fuld skærm: …" button: the list's badges in full screen, and the bars reaching the bottom edge, or
    keeping 400 px and scrolling in the low window.
    The tooltip on a mixed bar at Alt forbrug and in a main group. Forfalden red in the tab, in the detail's pill and
    in the list, and the red outline and the legend lines in the bars.
    Back, Escape twice, and ← out of full screen.
