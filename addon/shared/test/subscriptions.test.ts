import { describe, expect, it } from "vitest";
import type { Subscription } from "../src/types";
import {
  PAYMENTS_PER_YEAR,
  amountPerPayment,
  amountPerYear,
  gapMonths,
  nextDate,
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
