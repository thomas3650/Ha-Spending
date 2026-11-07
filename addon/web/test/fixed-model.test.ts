import {
  amountPerPayment,
  NO_PIECE,
  PALETTE,
  type Period,
  type Posting,
  type SpendingData,
  type Subscription,
  unitAt,
} from "@ha-spending/shared";
import { describe, expect, it } from "vitest";

import { kr, rangeText } from "../src/format";
import { da } from "../src/i18n/da";
import { partColours } from "../src/model/circle";
import { viewContext } from "../src/model/context";
import { fixedColours, fixedLevelRows, fixedUnits, fixedView, type FixedView } from "../src/model/fixed";
import { fixedList } from "../src/model/fixed-list";
import { objectGroupCards } from "../src/model/key-numbers";
import { leaveFixed, normalise } from "../src/state/actions";
import { DEFAULT_STATE, parseHash, type ViewState } from "../src/state/view";
import { DEFAULT_SUBSCRIPTION_SORT, subscriptionTable } from "../src/model/subscriptions";
import {
  answerFor,
  billPayment,
  SUBSCRIPTIONS,
  TAB_AVIS,
  TAB_BILLS,
  TAB_POSTINGS,
  TAB_TIDSSKRIFT,
  TAB_TODAY,
  tabBill,
  tabData,
  withSubscriptions,
} from "./fixture";

const TODAY = "2026-10-30";
const FETCHED: Period = { start: "2025-01-01", end: TODAY };
const FIXED = "view=fixed&og=Faste%20udgifter";

/** Husleje and Q8 paid through bills in Faste udgifter; the fixture's own link to Pizzaabonnement stays. */
function bills(p: Posting): Posting["subscription"] {
  if (p.text === "Husleje") return { id: "b1", name: "Husleje", objectGroup: "Faste udgifter" };
  if (p.text === "Q8") return { id: "b4", name: "Bilforsikring", objectGroup: "Faste udgifter" };
  return p.subscription;
}

function linked(subscriptions: Subscription[] = SUBSCRIPTIONS, today = TODAY, range: Period = FETCHED): SpendingData {
  const answer = withSubscriptions(answerFor(range, today), subscriptions);
  return {
    ...answer,
    postings: answer.postings.map((p) => ({ ...p, subscription: bills(p) })),
  };
}

function viewOf(hash: string, data = linked(), today = TODAY): FixedView {
  return fixedView(viewContext(data, parseHash(hash), today));
}

function bill(id: string, name: string, extra: Partial<Subscription>): Subscription {
  return {
    id,
    name,
    objectGroup: "Faste udgifter",
    repeat: "monthly",
    skip: 0,
    start: "2026-01-01",
    end: null,
    amountMin: 10000,
    amountMax: 10000,
    lastPayment: null,
    ...extra,
  };
}

function paidIn(data: SpendingData, group: string, range: Period): number {
  return data.postings
    .filter((p) => p.subscription?.objectGroup === group && p.date >= range.start && p.date <= range.end)
    .reduce((sum, p) => sum + p.amount, 0);
}

/** A last payment of 100 kr. in Husleje. */
function paidOn(date: string): Subscription["lastPayment"] {
  return { date, amount: 10000, category: "Husleje", account: "1" };
}

function sub(id: string): Subscription {
  const found = SUBSCRIPTIONS.find((s) => s.id === id);
  if (found === undefined) throw new Error(id);
  return found;
}

/** Due on the 31st, so with today 30 October it is due tomorrow. */
const MOBILE = bill("b8", "Mobil", { start: "2026-01-31", lastPayment: paidOn("2026-09-30") });

describe("the view's units", () => {
  it("draws I år as twelve months to 31 December, with buttons", () => {
    const f = fixedUnits(linked(), parseHash(FIXED), TODAY);
    expect(f.grouping).toBe("month");
    expect(f.span).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(f.units.map((u) => u.fullStart)).toEqual(
      Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}-01`),
    );
    expect(f.buttons).toBe(true);
  });

  it("draws I år as twelve months also in January", () => {
    const today = "2026-01-15";
    const f = fixedUnits(linked(SUBSCRIPTIONS, today, { start: "2025-01-01", end: today }), parseHash(FIXED), today);
    expect(f.units).toHaveLength(12);
    expect(f.buttons).toBe(true);
  });

  it("draws Denne måned as its days, to the month's last day, without buttons", () => {
    const f = fixedUnits(linked(), parseHash(`period=thisMonth&${FIXED}`), TODAY);
    expect(f.units).toHaveLength(31);
    expect(f.units[30].fullStart).toBe("2026-10-31");
    expect(f.buttons).toBe(false);
  });

  it("runs Alt by År to 31 December", () => {
    const data = { ...linked(), earliestPostingDate: "2023-05-01" };
    const f = fixedUnits(data, parseHash(`period=all&${FIXED}`), TODAY);
    expect(f.grouping).toBe("year");
    expect(f.units.map((u) => u.fullStart)).toEqual(["2023-01-01", "2024-01-01", "2025-01-01", "2026-01-01"]);
    expect(f.span.end).toBe("2026-12-31");
    expect(f.buttons).toBe(true);
  });

  it("draws Sidste år to its own last day", () => {
    const f = fixedUnits(linked(), parseHash(`period=lastYear&${FIXED}`), TODAY);
    expect(f.span).toEqual({ start: "2025-01-01", end: "2025-12-31" });
  });
});

describe("the view's payments", () => {
  it("sums each month's paid part from its linked postings", () => {
    const data = linked();
    const view = viewOf(FIXED, data);
    for (const bar of view.bars) {
      expect(bar.paidSum).toBe(paidIn(data, "Faste udgifter", { start: bar.unit.start, end: bar.unit.end }));
    }
    expect(view.bars[6].paidSum).toBeGreaterThan(0);
  });

  it("estimates the due dates after today at amountPerPayment", () => {
    const estimates = viewOf(FIXED)
      .payments.filter((p) => p.kind === "estimate")
      .map((p) => [p.date, p.name, p.amount]);
    expect(estimates).toEqual([
      ["2026-11-01", "Husleje", amountPerPayment(sub("b1"))],
      ["2026-11-20", "Avis", amountPerPayment(sub("b5"))],
      ["2026-12-01", "Husleje", amountPerPayment(sub("b1"))],
    ]);
  });

  it("makes a due one and one due today estimates", () => {
    const due = bill("d1", "Forfalden", { start: "2026-01-28", lastPayment: paidOn("2026-09-28") });
    const today = bill("d2", "I dag", { start: "2026-01-30", lastPayment: paidOn("2026-09-30") });
    const payments = viewOf(FIXED, linked([due, today])).payments;
    expect(
      payments.filter((p) => p.kind !== "paid" && p.date <= TODAY).map((p) => [p.date, p.kind, p.due, p.amount]),
    ).toEqual([
      ["2026-10-28", "estimate", true, 10000],
      ["2026-10-30", "estimate", false, 10000],
    ]);
  });

  it("gives a not-seen date one row with no amount and no count", () => {
    const view = viewOf(FIXED);
    const notSeen = view.payments.filter((p) => p.kind === "notSeen");
    expect(notSeen.map((p) => [p.date, p.name, p.amount])).toEqual([["2026-07-05", "Indboforsikring", 0]]);
    const july = view.bars[6];
    expect(july.paidSum + july.estimateSum).toBe(
      paidIn(linked(), "Faste udgifter", { start: "2026-07-01", end: "2026-07-31" }),
    );
    const counted = view.payments.filter((p) => p.kind !== "notSeen").length;
    expect(fixedList(view, null).summary.startsWith(da.fixed.payments(counted))).toBe(true);
  });

  it("shows nothing for a not-seen monthly bill's later miss before today", () => {
    const missed = bill("m1", "Fitness", { start: "2026-01-03", lastPayment: paidOn("2026-08-03") });
    const payments = viewOf(FIXED, linked([missed]))
      .payments.filter((p) => p.kind !== "paid")
      .map((p) => [p.date, p.kind, p.amount]);
    expect(payments).toEqual([
      ["2026-09-03", "notSeen", 0],
      ["2026-11-03", "estimate", 10000],
      ["2026-12-03", "estimate", 10000],
    ]);
  });

  it("leaves out a due date before the span", () => {
    const today = "2026-11-04";
    const due = bill("d1", "Mobil", { start: "2026-01-30", lastPayment: paidOn("2026-09-30") });
    const data = linked([due], today, { start: "2025-11-01", end: today });
    const payments = viewOf(`period=thisMonth&${FIXED}`, data, today).payments.filter((p) => p.kind !== "paid");
    expect(payments.map((p) => [p.date, p.kind])).toEqual([["2026-11-30", "estimate"]]);
  });

  it("has no estimate in Sidste år", () => {
    const view = viewOf(`period=lastYear&${FIXED}`);
    expect(view.payments.some((p) => p.kind === "estimate")).toBe(false);
    expect(view.bars.every((b) => b.estimateSum === 0)).toBe(true);
  });

  it("keeps only the chosen object group", () => {
    const view = viewOf("view=fixed&og=Abonnementer");
    expect(new Set(view.payments.map((p) => p.objectGroup))).toEqual(new Set(["Abonnementer"]));
    const all = viewOf("view=fixed");
    expect(new Set(all.payments.map((p) => p.objectGroup))).toEqual(new Set(["Abonnementer", "Faste udgifter"]));
  });
});

describe("the view's key numbers", () => {
  it("shows Thomas's four cards for I år", () => {
    const data = linked();
    const view = viewOf(FIXED, data);
    const paid = paidIn(data, "Faste udgifter", { start: "2026-01-01", end: TODAY });
    const estimates = view.payments.filter((p) => p.kind === "estimate");
    const estimate = estimates.reduce((sum, p) => sum + p.amount, 0);
    expect(view.cards).toEqual([
      {
        label: da.fixed.paidThisYear,
        value: kr(paid),
        sub: `${rangeText({ start: "2026-01-01", end: TODAY })} · ${da.fixed.notSeenCount(1)}`,
      },
      {
        label: da.fixed.remaining,
        value: kr(estimate),
        sub: da.fixed.paymentsUntil(da.fixed.payments(estimates.length), "31. dec"),
        estimate: true,
      },
      {
        label: da.fixed.estimateFor("2026"),
        value: kr(paid + estimate),
        sub: da.fixed.paidPlus(kr(estimate), "31. dec"),
        estimate: true,
      },
      {
        label: da.fixed.perMonthEstimate,
        value: kr((paid + estimate) / 12),
        sub: expect.stringMatching(new RegExp(`^${da.fixed.yearSplit("2026")} · `)),
        estimate: true,
      },
    ]);
  });

  /** The text of "betalt … pr. måned" in a card's sub-line, or null. */
  function paidPart(sub: string): string | null {
    const [, part] = sub.split(" · ");
    return part === undefined ? null : part.replace(/^betalt /, "");
  }

  it("the I år per-month card is labelled as an estimate and names the paid per-month figure", () => {
    const card = viewOf(FIXED).cards[3];
    expect(card.label).toBe(da.fixed.perMonthEstimate);
    expect(card.estimate).toBe(true);
    const part = paidPart(card.sub);
    expect(part).toMatch(/pr\. måned$/);
    expect(card.sub).toBe(`${da.fixed.yearSplit("2026")} · ${da.fixed.summaryPaid(part ?? "")}`);
  });

  it("with one object group chosen, the card's paid per-month figure matches the overview card's", () => {
    const data = linked();
    const overview = objectGroupCards(viewContext(data, DEFAULT_STATE, TODAY), () => "#").find(
      (c) => c.label === da.inPeriod("Faste udgifter"),
    );
    const part = paidPart(viewOf(FIXED, data).cards[3].sub);
    expect(part).not.toBeNull();
    expect(overview?.sub.split(" · ")[0]).toBe(part);
  });

  it("in January the per-month card has only the year line", () => {
    const today = "2026-01-15";
    const data = linked(SUBSCRIPTIONS, today, { start: "2025-01-01", end: today });
    expect(viewOf(FIXED, data, today).cards[3].sub).toBe(da.fixed.yearSplit("2026"));
  });

  it("with no estimate left, Estimat pr. måned and Estimat for hele … have no ca.", () => {
    const data = linked([]);
    const thisYear = viewOf(FIXED, data);
    expect(thisYear.payments.some((p) => p.kind === "estimate")).toBe(false);
    expect(thisYear.cards[2].label).toBe(da.fixed.estimateFor("2026"));
    expect(thisYear.cards[2].estimate).toBeFalsy();
    expect(thisYear.cards[3].label).toBe(da.fixed.perMonthEstimate);
    expect(thisYear.cards[3].estimate).toBeFalsy();
    expect(viewOf(`period=thisMonth&${FIXED}`, data).cards[1].estimate).toBeFalsy();
    expect(viewOf(`period=all&${FIXED}`, data).cards[2].estimate).toBeFalsy();
  });

  it("on Alt a due estimate before the running unit does not mark Estimat for hele … with ca.", () => {
    const today = "2026-10-02";
    const ended = bill("d1", "Mobil", { start: "2026-01-30", end: "2026-09-30", lastPayment: paidOn("2026-08-30") });
    const data = linked([ended], today, { start: "2025-11-01", end: today });
    const view = viewOf(`period=all&${FIXED}`, data, today);
    expect(view.payments.filter((p) => p.kind === "estimate").map((p) => [p.date, p.due])).toEqual([
      ["2026-09-30", true],
    ]);
    const whole = view.cards[2];
    expect(whole.label).toBe(da.fixed.estimateFor("oktober 2026"));
    expect(whole.estimate).toBeFalsy();
  });

  it("pays in I år what the overview's object-group card shows", () => {
    const data = linked();
    const card = objectGroupCards(viewContext(data, DEFAULT_STATE, TODAY), () => "#").find(
      (c) => c.label === da.inPeriod("Faste udgifter"),
    );
    expect(viewOf(FIXED, data).cards[0].value).toBe(card?.value);
  });

  it("shows the other periods' cards", () => {
    expect(viewOf(`period=thisMonth&${FIXED}`).cards.map((c) => c.label)).toEqual([
      da.fixed.paidIn("oktober"),
      da.fixed.estimateFor("oktober"),
      da.fixed.nextPayment,
    ]);
    expect(viewOf(`period=all&${FIXED}`).cards.map((c) => c.label)).toEqual([
      da.fixed.paidTotal,
      da.fixed.paidIn("oktober 2026"),
      da.fixed.estimateFor("oktober 2026"),
    ]);
    expect(viewOf(`period=lastYear&${FIXED}`).cards.map((c) => c.label)).toEqual([
      da.fixed.paidInPeriod,
      da.fixed.averagePerMonth,
    ]);
  });

  it("names Denne måned's next payment, or none", () => {
    const next = viewOf(`period=thisMonth&${FIXED}`, linked([MOBILE])).cards[2];
    expect(next).toMatchObject({ value: kr(10000), sub: da.fixed.nextOn("31. okt", "Mobil"), estimate: true });
    const none = viewOf(`period=thisMonth&${FIXED}`, linked([sub("b1")])).cards[2];
    expect(none).toMatchObject({ value: da.none, sub: da.fixed.noMoreIn("oktober") });
  });
});

describe("the view's bars", () => {
  it("names each bar with its unit and sums", () => {
    const mixed = viewOf(FIXED, linked([sub("b1"), MOBILE])).bars;
    expect(mixed[9].label).toBe(`Oktober: betalt ${kr(800000)}, estimat ca. ${kr(10000)}`);
    expect(mixed[11].label).toBe(`December: estimat ca. ${kr(810000)}`);
    const subscriptions = viewOf("view=fixed&og=Abonnementer").bars;
    expect(subscriptions[8].label).toBe(`September: betalt ${kr(70000)}`);
    expect(subscriptions[2].label).toBe("Marts: ingen betalinger");
  });

  it("keeps a part's due estimates apart, and in the estimates", () => {
    const due = bill("d1", "Forfalden", { start: "2026-01-28", lastPayment: paidOn("2026-09-28") });
    const data = linked([due, MOBILE]);
    const bars = viewOf(FIXED, data).bars;
    const october = bars[9];
    expect(october.due).toEqual(new Map([["Bolig", 10000]]));
    expect(october.estimate).toEqual(new Map([["Bolig", 20000]]));
    const paid = paidIn(data, "Faste udgifter", { start: "2026-10-01", end: "2026-10-31" });
    expect(october.paidSum).toBe(paid);
    expect(october.estimateSum).toBe(20000);
    expect(october.label).toBe(da.fixed.barMixed("Oktober", kr(paid), kr(20000)));
    expect(october.sum).toBe(da.fixed.sum(kr(paid), kr(20000)));
    expect(bars[10].estimate.size).toBeGreaterThan(0);
    expect(bars[10].due.size).toBe(0);
  });

  it("marks the running unit", () => {
    expect(viewOf(FIXED).bars.map((b) => b.running)).toEqual(Array.from({ length: 12 }, (_, i) => i === 9));
  });

  it("lists the view's units in the unit step with their sums", () => {
    const view = viewOf(`${FIXED}&unit=2026-12-01`, linked([sub("b1"), MOBILE]));
    expect(view.unitStep?.word).toBe("month");
    expect(view.unitStep?.chosen).toBe("December");
    const rows = view.unitStep?.rows ?? [];
    expect(rows.map((r) => r.name)).toEqual(view.bars.map((b) => b.name));
    expect(rows[0].sum).toBe(kr(800000));
    expect(rows[9].sum).toBe(`${kr(800000)} + ca. ${kr(10000)}`);
    expect(rows[11]).toMatchObject({ sum: `ca. ${kr(810000)}`, current: true });
    expect(rows.filter((r) => r.current)).toHaveLength(1);
  });

  it("has no unit step without buttons", () => {
    expect(viewOf(`period=thisMonth&${FIXED}`).unitStep).toBeNull();
  });

  it("names the years in the unit step with Alt by År", () => {
    const data = { ...linked(), earliestPostingDate: "2023-05-01" };
    const step = viewOf(`period=all&${FIXED}`, data).unitStep;
    expect(step?.word).toBe("year");
    expect(step?.rows?.map((r) => r.name)).toEqual(["2023", "2024", "2025", "2026"]);
  });
});

describe("the view's object groups", () => {
  it("counts and sums each group, a group found only on postings and Alle", () => {
    const fixedOnly = SUBSCRIPTIONS.filter((s) => s.objectGroup === "Faste udgifter");
    const data = linked(fixedOnly);
    const period = { start: "2026-01-01", end: TODAY };
    expect(viewOf(FIXED, data).groups).toEqual([
      {
        name: "Abonnementer",
        count: 0,
        sum: paidIn(data, "Abonnementer", period),
        current: false,
      },
      {
        name: "Faste udgifter",
        count: fixedOnly.length,
        sum: paidIn(data, "Faste udgifter", period),
        current: true,
      },
      {
        name: null,
        count: fixedOnly.length,
        sum: paidIn(data, "Abonnementer", period) + paidIn(data, "Faste udgifter", period),
        current: false,
      },
    ]);
  });

  it("marks Alle when no group is chosen", () => {
    expect(viewOf("view=fixed").groups.find((g) => g.current)?.name).toBeNull();
  });
});

describe("the view's colours", () => {
  /** Fritid has only a refund, so it has no piece in the circle and is grey there. */
  function refunded(): SpendingData {
    const answer = linked();
    const refund: Posting = {
      ...answer.postings[0],
      id: "r1",
      category: "Sport",
      kind: "refund",
      amount: -5000,
      date: "2026-05-05",
      subscription: null,
    };
    return {
      ...answer,
      categories: [...answer.categories, { name: "Sport", mainGroup: "Fritid" }],
      mainGroups: [...answer.mainGroups, "Fritid"],
      postings: [...answer.postings, refund],
    };
  }

  it("keeps a main group's circle colour and gives the grey and missing ones the free palette colours, largest first", () => {
    const ctx = viewContext(refunded(), parseHash(FIXED), TODAY);
    const circle = partColours(ctx);
    expect(circle.get("Fritid")).toBe(NO_PIECE);
    const bolig = circle.get("Bolig");
    const colours = fixedColours(ctx, [
      { key: "Ukendt", size: 100 },
      { key: "Bolig", size: 500 },
      { key: "Fritid", size: 900 },
    ]);
    const free = PALETTE.filter((c) => c !== bolig);
    expect(colours.get("Bolig")).toBe(bolig);
    expect(colours.get("Fritid")).toBe(free[0]);
    expect(colours.get("Ukendt")).toBe(free[1]);
  });

  it("greys the parts after the palette runs out", () => {
    const ctx = viewContext(linked(), parseHash(`group=Bolig&category=Husleje&${FIXED}`), TODAY);
    const parts = Array.from({ length: PALETTE.length + 2 }, (_, i) => ({
      key: `Bill ${i}`,
      size: 100 - i,
    }));
    const colours = [...fixedColours(ctx, parts).values()];
    expect(colours.slice(0, PALETTE.length)).toEqual([...PALETTE]);
    for (const colour of colours.slice(PALETTE.length)) expect(PALETTE).not.toContain(colour);
  });

  it("stacks by main group at Alt forbrug, by category in a main group and by fixed expense in a category", () => {
    expect(viewOf(FIXED).parts.map((p) => p.name)).toEqual(["Bolig", "Bil", da.noMainGroup]);
    expect(viewOf(`group=Bolig&${FIXED}`).parts.map((p) => p.name)).toEqual(["Husleje"]);
    expect(viewOf(`group=Bolig&category=Husleje&${FIXED}`).parts.map((p) => p.name)).toEqual([
      "Husleje",
      "Indboforsikring",
    ]);
  });
});

describe("the view's trail lists", () => {
  it("a row's dot has the colour of its part of the bars", () => {
    const cases: [string, "mainGroup" | "category", string][] = [
      [FIXED, "mainGroup", FIXED],
      [`group=Bolig&${FIXED}`, "mainGroup", FIXED],
      [`group=Bolig&category=Husleje&${FIXED}`, "category", `group=Bolig&${FIXED}`],
    ];
    for (const [hash, of, partsHash] of cases) {
      const rows = fixedLevelRows(viewContext(linked(), parseHash(hash), TODAY), of);
      const parts = new Map(viewOf(partsHash).parts.map((p) => [p.key, p.colour]));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.colour).toBe(parts.get(row.key));
    }
  });

  it("a chosen row with no part has no colour of its own", () => {
    const rows = fixedLevelRows(viewContext(linked(), parseHash(`group=Mad&${FIXED}`), TODAY), "mainGroup");
    expect(rows.find((r) => r.key === "Mad")?.colour).toBe(NO_PIECE);
  });

  it("has no Kategori list with no main group chosen", () => {
    expect(fixedLevelRows(viewContext(linked(), parseHash(FIXED), TODAY), "category")).toEqual([]);
  });
});

describe("the view's list", () => {
  it("groups the rows by unit, newest first, each by date", () => {
    const list = fixedList(viewOf(FIXED), null);
    expect(list.title).toBe(da.fixed.inPeriod);
    const names = (list.groups ?? []).map((g) => g.name);
    expect(names[0]).toBe("December");
    expect(names.at(-1)).toBe("Januar");
    const july = list.groups?.find((g) => g.name === "Juli");
    expect(july?.rows.map((r) => [r.date, r.name, r.status?.text])).toEqual([
      ["1. jul", "Husleje", da.fixed.status.paid],
      ["3. jul", "Bilforsikring", da.fixed.status.paid],
      ["5. jul", "Indboforsikring", da.fixed.status.notSeen],
    ]);
    expect(july?.rows[2].amount).toBe(da.none);
    expect(july?.count).toBe(da.fixed.payments(2));
    const december = list.groups?.[0];
    expect(december?.count).toBe(`${da.fixed.payments(1)} · estimat`);
    expect(december?.rows[0]).toMatchObject({
      amount: `ca. ${kr(800000)}`,
      date: "1. dec",
      status: { text: da.fixed.status.expected },
    });
    expect(list.groups?.find((g) => g.name === "Oktober")?.count).toBe(`${da.fixed.payments(1)} · i gang`);
  });

  it("writes the sum line with the estimates", () => {
    const data = linked();
    const view = viewOf(FIXED, data);
    const paid = paidIn(data, "Faste udgifter", { start: "2026-01-01", end: TODAY });
    const estimate = view.payments.filter((p) => p.kind === "estimate").reduce((sum, p) => sum + p.amount, 0);
    const count = view.payments.filter((p) => p.kind !== "notSeen").length;
    expect(fixedList(view, null).summary).toBe(
      `${da.fixed.payments(count)} · betalt ${kr(paid)} · estimat ca. ${kr(estimate)} · i alt ca. ${kr(paid + estimate)}`,
    );
    expect(fixedList(viewOf(`period=lastYear&${FIXED}`, data), null).summary).toBe(
      `${da.fixed.payments(1)} · betalt ${kr(800000)}`,
    );
  });

  it("names a due estimate forfalden", () => {
    const due = bill("d1", "Forfalden", { start: "2026-01-28", lastPayment: paidOn("2026-09-28") });
    const rows = fixedList(viewOf(FIXED, linked([due])), null).rows;
    expect(rows.find((r) => r.date === "28. okt")?.status).toEqual({
      kind: "estimate",
      due: true,
      text: da.fixed.status.due,
    });
  });

  it("shows only a chosen unit's rows, with no group line", () => {
    const view = viewOf(FIXED);
    const july = unitAt("2026-07-01", "month", TODAY);
    const list = fixedList(view, july);
    expect(list.title).toBe("Juli");
    expect(list.groups).toBeNull();
    expect(list.rows.map((r) => r.name)).toEqual(["Husleje", "Bilforsikring", "Indboforsikring"]);
    expect(list.summary).toBe(`${da.fixed.payments(2)} · betalt ${kr(890000)}`);
  });

  it("gives Alt by År one row per fixed expense, biggest first", () => {
    const data = { ...linked(), earliestPostingDate: "2023-05-01" };
    const list = fixedList(viewOf(`period=all&${FIXED}`, data), null);
    const year = list.groups?.find((g) => g.name === "2026");
    expect(year?.rows.map((r) => [r.name, r.sub, r.amount, r.date])).toEqual([
      ["Husleje", "12 betalinger · heraf 2 estimat, næste forventes 1. nov", `ca. ${kr(12 * 800000)}`, null],
      ["Bilforsikring", "1 betaling", kr(90000), null],
      ["Avis", "1 betaling · heraf 1 estimat, næste forventes 20. nov", `ca. ${kr(20000)}`, null],
      ["Indboforsikring", "1 ikke set", da.none, null],
    ]);
  });

  it("in the normal card with several object groups, names the group in the name's tooltip and the year's line", () => {
    const data = { ...linked(), earliestPostingDate: "2023-05-01" };
    const list = fixedList(viewOf(`period=all&${FIXED}`, data), null, { full: false, oneGroup: false });
    expect(list.full).toBe(false);
    const husleje = list.groups?.find((g) => g.name === "2026")?.rows.find((r) => r.name === "Husleje");
    expect(husleje).toMatchObject({
      badge: false,
      nameTitle: "Husleje · Faste udgifter",
      sub: "Faste udgifter · 12 betalinger · heraf 2 estimat, næste forventes 1. nov",
    });
  });

  it("with one object group, has no badge and the plain name in the tooltip", () => {
    const row = fixedList(viewOf(FIXED), null).rows.find((r) => r.name === "Husleje");
    expect(row).toMatchObject({ badge: false, nameTitle: "Husleje" });
  });

  it("in full screen, has the badge, the plain name and a year's line without the group", () => {
    const data = { ...linked(), earliestPostingDate: "2023-05-01" };
    const list = fixedList(viewOf(`period=all&${FIXED}`, data), null, { full: true, oneGroup: false });
    expect(list.full).toBe(true);
    const year = list.groups?.find((g) => g.name === "2026")?.rows ?? [];
    expect(year.length).toBeGreaterThan(0);
    for (const r of year) {
      expect(r.badge).toBe(true);
      expect(r.nameTitle).toBe(r.name);
      expect(r.sub?.startsWith(r.objectGroup)).toBe(false);
    }
    const rows = fixedList(viewOf(FIXED), null, { full: true, oneGroup: false }).rows;
    expect(rows.every((r) => r.badge && r.nameTitle === r.name)).toBe(true);
  });

  it("shows the Kategori column outside a category", () => {
    expect(fixedList(viewOf(FIXED), null).showCategory).toBe(true);
    expect(fixedList(viewOf(`group=Bolig&${FIXED}`), null).showCategory).toBe(true);
    expect(fixedList(viewOf(`group=Bolig&category=Husleje&${FIXED}`), null).showCategory).toBe(false);
  });

  it("says when a level has no fixed expenses", () => {
    const list = fixedList(viewOf(`group=Mad&category=Dagligvarer&${FIXED}`), null);
    expect(list.rows).toEqual([]);
    expect(list.empty).toBe("Ingen faste udgifter i Dagligvarer i perioden");
  });
});

describe("normalise in the view", () => {
  const january = "2026-01-15";
  const data = linked(SUBSCRIPTIONS, january, { start: "2025-01-01", end: january });
  const fixed: ViewState = { ...parseHash(FIXED), unit: "2026-12-01" };

  it("keeps a December unit with I år in January", () => {
    expect(normalise(fixed, data, january).unit).toBe("2026-12-01");
  });

  it("drops it on the way out", () => {
    expect(normalise(leaveFixed(fixed), data, january).unit).toBeNull();
  });

  it("drops a day's unit with Denne måned", () => {
    const s: ViewState = {
      ...parseHash(`period=thisMonth&${FIXED}`),
      unit: "2026-10-05",
    };
    expect(normalise(s, linked(), TODAY).unit).toBeNull();
  });
});

describe("ended bills in the view", () => {
  const tabView = (hash: string, data: SpendingData) => fixedView(viewContext(data, parseHash(hash), TAB_TODAY));

  it("an ended bill adds no estimate to Resterende udgifter, Estimat for hele, the bars or Poster i perioden", () => {
    const withEnded = tabView("view=fixed", tabData());
    const without = tabView("view=fixed", tabData(TAB_BILLS.filter((b) => b !== TAB_AVIS && b !== TAB_TIDSSKRIFT)));
    const ended = new Set([TAB_AVIS.name, TAB_TIDSSKRIFT.name]);
    expect(withEnded.payments.filter((p) => p.kind !== "paid" && ended.has(p.name))).toEqual([]);
    expect(withEnded.payments).toEqual(without.payments);
    expect(withEnded.cards).toEqual(without.cards);
    const estimates = (v: FixedView) => v.bars.map((b) => [b.estimateSum, b.label]);
    expect(estimates(withEnded)).toEqual(estimates(without));
  });

  it("in Denne måned a kept bill that ended months ago adds no object-group card and no step row", () => {
    const medlemskab = tabBill("t10", "Medlemskab", {
      objectGroup: "Medlemskaber",
      end: "2026-03-31",
      lastPayment: { date: "2026-03-01", amount: 10000, category: "Husleje", account: "1" },
    });
    const paid = ["01", "02", "03"].map((m) => billPayment(medlemskab, `2026-${m}-01`));
    const data = tabData([...TAB_BILLS, medlemskab], [...TAB_POSTINGS, ...paid]);
    const ctx = viewContext(data, parseHash("period=thisMonth"), TAB_TODAY);
    expect(objectGroupCards(ctx, (g) => g).map((c) => c.label)).not.toContain(da.inPeriod("Medlemskaber"));
    expect(tabView("view=fixed&period=thisMonth", data).groups.map((g) => g.name)).not.toContain("Medlemskaber");
  });

  it("X stk. is the tab's rows for the same group", () => {
    const data = tabData();
    const card = objectGroupCards(viewContext(data, parseHash(""), TAB_TODAY), (g) => g).find(
      (c) => c.label === da.inPeriod("Faste udgifter"),
    );
    const rows = subscriptionTable(
      viewContext(data, parseHash("view=fixed&og=Faste%20udgifter"), TAB_TODAY),
      DEFAULT_SUBSCRIPTION_SORT,
    ).rows;
    // Avisabonnement ended in May, Licens has no payment in I år, and Vandabonnement starts in December.
    expect(rows.map((r) => r.name).sort()).toEqual(["Avisabonnement", "Husleje", "Licens", "Vandabonnement"]);
    expect(card?.sub).toMatch(new RegExp(` · ${da.billCount(rows.length)}$`));
    expect(tabView("view=fixed", data).groups.find((g) => g.name === "Faste udgifter")?.count).toBe(rows.length);
  });

  it("the object-group step counts the chosen unit's rows", () => {
    const groups = tabView("view=fixed&unit=2026-08-01", tabData()).groups;
    expect(groups.map((g) => [g.name, g.count])).toEqual([
      ["Abonnementer", 1],
      ["Bil", 1],
      ["Faste udgifter", 2],
      [null, 4],
    ]);
  });
});
