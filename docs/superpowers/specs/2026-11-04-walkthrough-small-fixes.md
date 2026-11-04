# Small fixes from the 2026-11-04 walkthrough – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issues:** closes #142, #144, #146, #147, #148, #149 and #151. One branch, one PR.

**Approved:** by Claude, 2026-11-04, under the controller session's brief for these issues (filed by Thomas from his
walkthrough that day): fix them, and for #142 pick a fix from the issue's options, with no decimals on the page. The
choices made here (§1's rule, §5's word, §7's text) are listed in the PR as decisions Claude made alone, for Thomas to
overrule.

Thomas went through the page live on 2026-11-04. These are the small findings. Each section changes one thing
and names the earlier spec it changes; everything else in the [UI spec](2026-10-30-ui-ux-design.md), the
[subscriptions spec](2026-11-01-subscriptions.md) and the later specs holds.

## 1. A rise counts from 1 kr., and the row shows what is paid now (#142)

This changes subscriptions spec §1.2 (the foot), §2.1 and §2.3, and supersedes
[UI polish spec](2026-11-03-ui-polish.md) §5.4 (øre when whole kroner would read the same).

- **Steget:** the last payment P is a rise when it is at least 1 kr. (100 øre) above the range's max. A smaller
  difference is no rise; the status is then the next in the table (Forventes or Betalt).
- **Whole kroner:** "Steget · {max} → {paid} kr." shows both amounts in whole kroner, each rounded as every other
  amount on the page. A rise of 1 kr. or more always shows two different numbers, so the øre form
  of UI polish §5.4 ("149,70 → 150,20") goes. No amount in Faste udgifter (Beløb, Om året, Steget) has øre; the
  postings' øre (D46) are not changed.
- **What is paid now:** when P is a rise, the amount per payment is P's amount, not the middle of the range. So Beløb
  and the arrow's right side show the same number, and Om året, the group sums, the object-group sums and the detail
  view count from it. This holds whatever the status, since P is what the household pays now.
- The foot under the table says so: "Fra Firefly III. Beløbet er midten af den faste udgifts beløbsinterval, eller
  den seneste betaling, når den er steget. Om året er det regnet om til et år."
- Made-up examples:

  | Min | Max | P | Status | Beløb |
  | --- | --- | --- | --- | --- |
  | 98,00 | 99,00 | 99,50 | not Steget | 99 kr. (the middle, 98,50) |
  | 849,00 | 849,00 | 849,42 | not Steget | 849 kr. |
  | 98,00 | 99,00 | 120,00 | Steget · 99 → 120 kr. | 120 kr. |
  | 99,40 | 99,40 | 100,60 | Steget · 99 → 101 kr. | 101 kr. |

- Each number is rounded on its own, so a shown step may be up to 1 kr. more or less than the real rise. That is meant:
  the alternative is øre, or numbers that are not the amounts rounded.
- The threshold lives with the status rules in `shared/src/subscriptions.ts`, and the status carries the amounts it
  compared, so the rule and the text cannot drift apart. This is D63.

## 2. The repeat always on its own line (#144)

- In the table's Beløb cell, the amount is on the first line and the repeat ("pr. måned", "hver 2. måned", "om året")
  on the second, in every row. The second line has the muted small text of the name cell's "næste {date}", so the two
  columns read alike.
- The detail view's amount line is not changed: it has room for one line.

## 3. The labels of small pieces get room (#146)

- The circle's labels keep their place, but get longer leader lines and more space between them, so the labels of the
  small pieces at 9 o'clock are apart and each line runs to its piece without a sharp bend.
- The longer lines take room from the labels. So they are drawn only where even the smallest ring leaves the labels
  their whole room, and the ring is a little smaller there to make room for them. On a narrower chart (the 1024 px
  window) the lines stay short, so no name breaks inside a word.
- Small pieces are not folded into one label: each piece is a click target that opens its main group or category, and
  a folded label could also clash with a real main group named like it.
- Only the chart's label layout changes; the ring's size stays within the label room of UI spec §3.2.

## 4. The shop bars' tracks end at one place (#147)

- In the Butikker list, the sum column has a fixed width, room for a seven-digit sum ("1.234.567 kr."), and the hide
  column has a fixed width, room for "Skjul". The share column keeps a fixed width, room for both "100 %" and
"< 1 %". So every row's track starts and ends at the same place, in the shown list
  and in the hidden one ("Vis").
- Without the hide column (no hiding allowed), the row has no empty column at its end.

## 5. A due payment says "Forfalden" (#148)

This changes subscriptions spec §2.3's Forventes row and UI polish spec §5.5 ("with any other status it shows as
today").

- When the status is Forventes and its date is before today (the payment is due but still inside the days it may be
  late), the text is "Forfalden {date}" instead of "Forventes {date}". On today and later it stays "Forventes {date}".
- Such a row does not show "næste {date}" under its name, as an Ikke set row does not: the date is the status's.
- The status's kind, colour and place in the order do not change: it is still a Forventes. This is D64.

## 6. A main-group header keeps its count on its line (#149)

- In the Faste udgifter table, a group's header cell spans the columns before Om året (Navn, Kategori when shown, and
  Beløb), which are empty in that row. So the name and the count ("4 faste udgifter") share one line when the row has
  room. The group's Om året and the empty Status cell stay in their columns.

## 7. A share above zero never reads 0 % (#151)

This changes [top-shops spec](2026-11-02-top-shops.md) §2 ("A share under 0.5 % reads "0 %"").

- A share whose whole per cent rounds to 0 while the amount is not 0 reads "< 1 %". A share of exactly 0 reads "0 %".
- It holds wherever a share is shown: the circle's labels and their buttons' names, the key numbers and the Butikker
  list. The shops' share is kept as a fraction, formatted as the others are.
- When the base's total is not above zero (refunds outweigh spending), a shop's row shows no share, as the circle
  shows none when `share()` has none. It never reads "0 %" beside a positive sum.
- This is D65.

## 8. Tests and checks

- §1: the shared rules' unit tests: no rise below 1 kr., a rise at exactly 1 kr., the amount per payment and per year
  from P when risen, also when the status is Ikke set; the table's cells and the foot through the rendered page; the step's
  text in whole kroner.
- §5: a Forventes with a date before today reads "Forfalden {date}" and its row has no "næste"; on today it reads
  "Forventes {date}".
- §6: the group's header row has the header, the Om året cell and the Status cell, with or without Kategori.
- §7: `percent` of a tiny fraction reads "< 1 %"; of 0 reads "0 %"; a shop with a tiny share reads "< 1 %"; a shop
  in a base whose total is not above zero shows no share.
- The fast loop's generated data gets a monthly fixed expense due 2 days before today with no payment since, so
  the Chrome check can see a Forfalden row.
- §2, §3 and §4 are layout only. Hard rule 5 rules out CSS tests, so the Chrome check covers them at 1440 and 1728 px,
  normal and full screen ([`testing.md`](../../testing.md#chrome-check)).
