import { describe, expect, it } from "vitest";
import type { Period, Posting, Subscription } from "../src/types";
import {
  PAYMENTS_PER_YEAR,
  amountPerPayment,
  amountPerYear,
  gapMonths,
  dueDatesBetween,
  dueDatesUntil,
  nextDate,
  statusInTime,
  subscriptionStatus,
} from "../src/subscriptions";

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "1",
    name: "Streaming",
    repeat: "monthly",
    skip: 0,
    start: "2025-01-01",
    end: null,
    amountMin: 9900,
    amountMax: 12900,
    objectGroup: "Made-up group",
    lastPayment: null,
    ...overrides,
  };
}

function paid(date: string, amount = 10000): Subscription["lastPayment"] {
  return { date, amount, category: null, account: "Checking" };
}

describe("amountPerPayment", () => {
  it("is the middle of the range", () => {
    expect(amountPerPayment(subscription())).toBe(11400);
  });

  it("rounds to whole øre", () => {
    expect(amountPerPayment(subscription({ amountMin: 9900, amountMax: 10001 }))).toBe(9951);
  });
});

describe("a rise", () => {
  const today = "2026-10-20";
  const withPaid = (amount: number) => subscription({ lastPayment: paid("2026-10-01", amount) });

  it("counts only from 1 kr. above the max", () => {
    expect(subscriptionStatus(withPaid(12950), today).kind).toBe("paid");
    expect(subscriptionStatus(withPaid(12999), today).kind).toBe("paid");
    expect(subscriptionStatus(withPaid(13000), today)).toEqual({ kind: "risen", max: 12900, paid: 13000 });
  });

  it("makes the amount per payment what was paid, and the year follows", () => {
    expect(amountPerPayment(withPaid(13000))).toBe(13000);
    expect(amountPerPayment(withPaid(12999))).toBe(11400);
    expect(amountPerYear(withPaid(13000))).toBe(156000);
  });

  it("holds when the status is notSeen", () => {
    const s = subscription({ lastPayment: paid("2026-09-01", 20000) });
    expect(subscriptionStatus(s, "2026-10-30").kind).toBe("notSeen");
    expect(amountPerPayment(s)).toBe(20000);
  });
});

describe("amountPerYear", () => {
  it("multiplies by the payments per year", () => {
    expect(amountPerYear(subscription())).toBe(136800);
    expect(amountPerYear(subscription({ repeat: "quarterly", amountMin: 90000, amountMax: 90000 }))).toBe(360000);
  });

  it.each([
    ["weekly", 52],
    ["half-year", 2],
    ["yearly", 1],
  ] as const)("counts %s as %i payments", (repeat, count) => {
    expect(PAYMENTS_PER_YEAR[repeat]).toBe(count);
    expect(amountPerYear(subscription({ repeat, amountMin: 100, amountMax: 100 }))).toBe(100 * count);
  });

  it("divides by skip + 1", () => {
    expect(amountPerYear(subscription({ skip: 1, amountMin: 100, amountMax: 100 }))).toBe(600);
  });
});

describe("gapMonths", () => {
  it("counts the months between payments", () => {
    expect(gapMonths("monthly", 0)).toBe(1);
    expect(gapMonths("quarterly", 1)).toBe(6);
    expect(gapMonths("half-year", 0)).toBe(6);
    expect(gapMonths("yearly", 1)).toBe(24);
    expect(gapMonths("yearly", 2)).toBe(36);
  });

  it("counts a week as 7 days of 30", () => {
    expect(gapMonths("weekly", 0)).toBeCloseTo(7 / 30);
    expect(gapMonths("weekly", 1)).toBeCloseTo(14 / 30);
  });
});

describe("nextDate", () => {
  it("clamps to the month's last day", () => {
    const s = subscription({ start: "2026-01-31", lastPayment: paid("2026-01-31") });
    expect(nextDate(s, "2026-02-01")).toBe("2026-02-28");
  });

  it("steps over skipped months", () => {
    const s = subscription({ start: "2026-01-15", skip: 1, lastPayment: paid("2026-01-15") });
    expect(nextDate(s, "2026-02-01")).toBe("2026-03-15");
  });

  it("lets a payment come 1 day early", () => {
    const s = subscription({ lastPayment: paid("2026-10-31") });
    expect(nextDate(s, "2026-10-31")).toBe("2026-12-01");
  });

  it("lets a payment come 4 days late", () => {
    const s = subscription({ lastPayment: paid("2026-11-04") });
    expect(nextDate(s, "2026-11-04")).toBe("2026-12-01");
  });

  it("is the latest due date on or before today without a payment", () => {
    expect(nextDate(subscription(), "2026-10-30")).toBe("2026-10-01");
  });

  it("is the start date when it is after today and there is no payment", () => {
    expect(nextDate(subscription({ start: "2026-11-20" }), "2026-10-30")).toBe("2026-11-20");
  });

  it("is null after the end date", () => {
    const s = subscription({ end: "2026-11-30", lastPayment: paid("2026-11-01") });
    expect(nextDate(s, "2026-11-02")).toBeNull();
  });

  it("counts the due dates from the start each time", () => {
    const s = subscription({ start: "2026-01-31", lastPayment: paid("2026-02-28") });
    expect(nextDate(s, "2026-03-01")).toBe("2026-03-31");
  });

  it("steps over skipped weeks", () => {
    const s = subscription({ repeat: "weekly", skip: 1, start: "2026-10-05", lastPayment: paid("2026-10-05") });
    expect(nextDate(s, "2026-10-06")).toBe("2026-10-19");
  });

  it("uses 2 days early for weekly", () => {
    const base = { repeat: "weekly", start: "2026-10-05" } as const;
    expect(nextDate(subscription({ ...base, lastPayment: paid("2026-10-10") }), "2026-10-10")).toBe("2026-10-19");
    expect(nextDate(subscription({ ...base, lastPayment: paid("2026-10-09") }), "2026-10-10")).toBe("2026-10-12");
  });
});

describe("subscriptionStatus", () => {
  const today = "2026-10-30";

  it("is notSeen more than 5 days after the next date", () => {
    const base = subscription({ start: "2026-10-25" });
    expect(subscriptionStatus(base, today).kind).toBe("expected");
    expect(subscriptionStatus(subscription({ start: "2026-10-24" }), today)).toEqual({
      kind: "notSeen",
      expected: "2026-10-24",
    });
  });

  it("is notSeen more than 2 days after the next date for weekly", () => {
    const weekly = { repeat: "weekly", start: "2026-10-28" } as const;
    expect(subscriptionStatus(subscription(weekly), today).kind).toBe("expected");
    expect(subscriptionStatus(subscription({ repeat: "weekly", start: "2026-10-27" }), today).kind).toBe("notSeen");
  });

  it("is expected up to 7 days ahead and paid beyond", () => {
    const paidIn = (next: string) => subscription({ start: next, lastPayment: paid("2026-01-01") });
    expect(subscriptionStatus(paidIn("2026-11-06"), today)).toEqual({ kind: "expected", date: "2026-11-06" });
    expect(subscriptionStatus(paidIn("2026-11-07"), today)).toEqual({ kind: "paid", date: "2026-01-01" });
  });

  it("is expected up to 3 days ahead for weekly", () => {
    const weeklyPaid = (start: string) =>
      subscription({ repeat: "weekly", start, lastPayment: paid("2026-10-22") });
    expect(subscriptionStatus(weeklyPaid("2026-11-02"), today).kind).toBe("expected");
    expect(subscriptionStatus(weeklyPaid("2026-11-03"), today).kind).toBe("paid");
  });

  it("lets notSeen win over risen", () => {
    const s = subscription({ lastPayment: paid("2026-09-01", 20000) });
    expect(subscriptionStatus(s, today)).toEqual({ kind: "notSeen", expected: "2026-10-01" });
  });

  it("is risen when the payment is above the max and not late", () => {
    const s = subscription({ lastPayment: paid("2026-10-01", 14900) });
    expect(subscriptionStatus(s, today)).toEqual({ kind: "risen", max: 12900, paid: 14900 });
  });

  it("is expected without a date when there is no payment and no next date", () => {
    const s = subscription({ start: "2025-01-01", end: "2025-01-15" });
    expect(subscriptionStatus(s, today)).toEqual({ kind: "expected", date: null });
  });

  it("is paid when there is a payment and no next date", () => {
    const s = subscription({ end: "2026-10-31", lastPayment: paid("2026-10-01") });
    expect(subscriptionStatus(s, today)).toEqual({ kind: "paid", date: "2026-10-01" });
  });
});

describe("dueDatesUntil", () => {
  it("lists the monthly dates after the last payment up to the limit", () => {
    const s = subscription({ start: "2026-01-15", lastPayment: paid("2026-10-15") });
    expect(dueDatesUntil(s, "2026-10-20", "2026-12-31")).toEqual(["2026-11-15", "2026-12-15"]);
  });

  it("steps weekly with a skip by 14 days", () => {
    const s = subscription({ repeat: "weekly", skip: 1, start: "2026-11-02" });
    expect(dueDatesUntil(s, "2026-11-02", "2026-12-10")).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
  });

  it("steps quarterly", () => {
    const s = subscription({ repeat: "quarterly", start: "2026-01-10", lastPayment: paid("2026-10-10") });
    expect(dueDatesUntil(s, "2026-10-12", "2027-12-31")).toEqual(["2027-01-10", "2027-04-10", "2027-07-10", "2027-10-10"]);
  });

  it("steps yearly", () => {
    const s = subscription({ repeat: "yearly", start: "2025-03-01", lastPayment: paid("2026-03-01") });
    expect(dueDatesUntil(s, "2026-06-01", "2028-12-31")).toEqual(["2027-03-01", "2028-03-01"]);
  });

  it("stops at the end date", () => {
    const s = subscription({ start: "2026-01-15", end: "2026-11-30", lastPayment: paid("2026-10-15") });
    expect(dueDatesUntil(s, "2026-10-20", "2026-12-31")).toEqual(["2026-11-15"]);
  });

  it("counts every date from the start so a month end does not drift", () => {
    const s = subscription({ start: "2026-01-31" });
    expect(dueDatesUntil(s, "2026-01-31", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("starts at a due date that has already passed", () => {
    const s = subscription({ start: "2026-01-15", lastPayment: paid("2026-09-15") });
    expect(dueDatesUntil(s, "2026-11-01", "2026-12-31")).toEqual(["2026-10-15", "2026-11-15", "2026-12-15"]);
  });

  it("is empty when there is no next date", () => {
    const s = subscription({ start: "2026-01-15", end: "2026-10-31", lastPayment: paid("2026-10-15") });
    expect(dueDatesUntil(s, "2026-11-01", "2026-12-31")).toEqual([]);
  });
});

describe("dueDatesBetween", () => {
  it("lists the monthly dates between two days, counting from the start", () => {
    const s = subscription({ start: "2025-01-31" });
    expect(dueDatesBetween(s, "2026-02-01", "2026-04-15")).toEqual(["2026-02-28", "2026-03-31"]);
  });

  it("stops at the end date", () => {
    const s = subscription({ start: "2026-01-15", end: "2026-04-30" });
    expect(dueDatesBetween(s, "2026-02-01", "2026-12-31")).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("steps weekly with a skip", () => {
    const s = subscription({ repeat: "weekly", skip: 1, start: "2026-11-02" });
    expect(dueDatesBetween(s, "2026-11-10", "2026-12-31")).toEqual([
      "2026-11-16",
      "2026-11-30",
      "2026-12-14",
      "2026-12-28",
    ]);
  });
});

type Payment = Pick<Posting, "date" | "amount" | "kind">;

function payment(date: string, amount = 10000): Payment {
  return { date, amount, kind: "spending" };
}

describe("statusInTime in a past time", () => {
  const today = "2026-11-05";
  const fetched: Period = { start: "2025-01-01", end: today };
  const january: Period = { start: "2026-01-01", end: "2026-01-31" };
  const weekly = subscription({ repeat: "weekly", start: "2026-01-05" });

  it("a past month with every due date met reads paid with the latest met payment's date", () => {
    const payments = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-27"].map((date) => payment(date));
    expect(statusInTime(weekly, payments, january, fetched, today)).toEqual({ kind: "paid", date: "2026-01-27" });
  });

  it("a payment a few days early, in the month before, meets the due date", () => {
    const s = subscription({ start: "2025-02-01" });
    const february: Period = { start: "2026-02-01", end: "2026-02-28" };
    expect(statusInTime(s, [payment("2026-01-27")], february, fetched, today)).toEqual({
      kind: "paid",
      date: "2026-01-27",
    });
  });

  it("a payment a few days late, in the next month, meets the due date", () => {
    const s = subscription({ start: "2025-01-30" });
    expect(statusInTime(s, [payment("2026-02-03")], january, fetched, today)).toEqual({
      kind: "paid",
      date: "2026-02-03",
    });
  });

  it("a missed due date reads notSeen", () => {
    const s = subscription({ start: "2025-01-15" });
    expect(statusInTime(s, [payment("2025-12-15")], january, fetched, today)).toEqual({
      kind: "notSeen",
      expected: "2026-01-15",
    });
  });

  it("a weekly bill with three payments for four due dates reads notSeen", () => {
    const payments = ["2026-01-05", "2026-01-19", "2026-01-26"].map((date) => payment(date));
    expect(statusInTime(weekly, payments, january, fetched, today)).toEqual({
      kind: "notSeen",
      expected: "2026-01-12",
    });
  });

  it("an open due date reads expected, before today as well", () => {
    const s = subscription({ start: "2025-01-31" });
    const october: Period = { start: "2026-10-01", end: "2026-10-31" };
    const seenOn = "2026-11-02";
    expect(statusInTime(s, [], october, { start: "2025-01-01", end: seenOn }, seenOn)).toEqual({
      kind: "expected",
      date: "2026-10-31",
    });
  });

  it("a yearly bill with no due date in the time reads next with its next due date", () => {
    const s = subscription({ repeat: "yearly", start: "2025-06-01" });
    expect(statusInTime(s, [payment("2025-06-01")], january, fetched, today)).toEqual({
      kind: "next",
      date: "2026-06-01",
    });
  });

  it("a refund alone does not meet a due date", () => {
    const s = subscription({ start: "2025-01-15" });
    const refund: Payment = { date: "2026-01-15", amount: -10000, kind: "refund" };
    expect(statusInTime(s, [refund], january, fetched, today)).toEqual({ kind: "notSeen", expected: "2026-01-15" });
  });

  it("a bill that ends after the time but before its next due date reads ended", () => {
    const s = subscription({ repeat: "yearly", start: "2025-06-01", end: "2026-03-31" });
    expect(statusInTime(s, [payment("2025-06-01")], january, fetched, today)).toEqual({
      kind: "ended",
      end: "2026-03-31",
    });
  });

  it("has no risen in a past time", () => {
    const s = subscription({ start: "2025-01-15", lastPayment: paid("2026-01-15", 20000) });
    expect(statusInTime(s, [payment("2026-01-15", 20000)], january, fetched, today)).toEqual({
      kind: "paid",
      date: "2026-01-15",
    });
  });

  it("an ended bill reads paid in a month before its end and ended in its last month", () => {
    const s = subscription({ start: "2025-01-15", end: "2026-05-31", lastPayment: paid("2026-05-15") });
    const payments = [payment("2026-04-15"), payment("2026-05-15")];
    const april: Period = { start: "2026-04-01", end: "2026-04-30" };
    const may: Period = { start: "2026-05-01", end: "2026-05-31" };
    expect(statusInTime(s, payments, april, fetched, today)).toEqual({ kind: "paid", date: "2026-04-15" });
    expect(statusInTime(s, payments, may, fetched, today)).toEqual({ kind: "ended", end: "2026-05-31" });
  });

  it("an ended bill in its last month with its last due date unpaid reads notSeen, not ended", () => {
    const s = subscription({ start: "2025-01-15", end: "2026-05-31", lastPayment: paid("2026-04-15") });
    const may: Period = { start: "2026-05-01", end: "2026-05-31" };
    expect(statusInTime(s, [payment("2026-04-15")], may, fetched, today)).toEqual({
      kind: "notSeen",
      expected: "2026-05-15",
    });
  });

  it("an ended bill in its last month with its last due date open reads expected, not ended", () => {
    const s = subscription({ start: "2025-01-31", end: "2026-10-31" });
    const october: Period = { start: "2026-10-01", end: "2026-10-31" };
    const seenOn = "2026-11-02";
    expect(statusInTime(s, [], october, { start: "2025-01-01", end: seenOn }, seenOn)).toEqual({
      kind: "expected",
      date: "2026-10-31",
    });
  });

  it("a due date whose window ends after the fetched range is not judged, so the time reads next", () => {
    const s = subscription({ start: "2025-01-30" });
    const fetchedToJanuary: Period = { start: "2025-01-01", end: "2026-01-31" };
    expect(statusInTime(s, [], january, fetchedToJanuary, today)).toEqual({ kind: "next", date: "2026-02-28" });
  });

  it("a bill due 1 January, paid in late December, with the fetched range from 1 January: January's date is not judged, so January reads next 1 February", () => {
    const s = subscription({ start: "2025-01-01", lastPayment: paid("2026-10-01") });
    const thisYear: Period = { start: "2026-01-01", end: today };
    const payments = ["2026-02-01", "2026-03-01"].map((date) => payment(date));
    expect(statusInTime(s, payments, january, thisYear, today)).toEqual({ kind: "next", date: "2026-02-01" });
  });
});

describe("statusInTime in a time that holds today", () => {
  const today = "2026-11-05";
  const thisYear: Period = { start: "2026-01-01", end: "2026-12-31" };
  const fetched: Period = { start: "2026-01-01", end: "2026-12-31" };

  it("a time that holds today reads today's status", () => {
    const s = subscription({ start: "2025-01-15", lastPayment: paid("2026-09-15") });
    expect(statusInTime(s, [payment("2026-09-15")], thisYear, fetched, today)).toEqual(subscriptionStatus(s, today));
  });

  it("an ended bill reads ended, or today's status while nextDate still gives its last due date", () => {
    const unpaid = subscription({ start: "2025-01-10", end: "2026-10-15", lastPayment: paid("2026-09-10") });
    const settled = subscription({ start: "2025-01-10", end: "2026-10-15", lastPayment: paid("2026-10-10") });
    expect(statusInTime(unpaid, [payment("2026-09-10")], thisYear, fetched, today)).toEqual(
      subscriptionStatus(unpaid, today),
    );
    expect(subscriptionStatus(unpaid, today).kind).toBe("notSeen");
    expect(statusInTime(settled, [payment("2026-10-10")], thisYear, fetched, today)).toEqual({
      kind: "ended",
      end: "2026-10-15",
    });
  });
});
