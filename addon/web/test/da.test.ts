import { describe, expect, it } from "vitest";
import { da } from "../src/i18n/da";

describe("da", () => {
  it("words the average before", () => {
    expect(da.averageBefore(12, "month")).toBe("gns. de 12 måneder før");
    expect(da.averageBefore(7, "month")).toBe("gns. af 7 måneder før");
    expect(da.averageBefore(1, "week")).toBe("gns. af 1 uge før");
  });
  it("counts units", () => {
    expect(da.unitCount(1, "month")).toBe("1 måned");
    expect(da.unitCount(9, "month")).toBe("9 måneder");
    expect(da.unitCount(2, "year")).toBe("2 år");
    expect(da.unitCount(3, "quarter")).toBe("3 kvartaler");
  });
  it("counts accounts", () => {
    expect(da.allAccountsCount(2)).toBe("Alle konti (2)");
    expect(da.someAccounts(4, 5)).toBe("4 af 5 konti");
  });
  it("words the amount chip", () => {
    expect(da.amountChip("100", "500")).toBe("Beløb: 100–500 kr.");
    expect(da.amountChip("100", null)).toBe("Beløb: fra 100 kr.");
    expect(da.amountChip(null, "500")).toBe("Beløb: til 500 kr.");
  });
  it("titles the difference", () => {
    expect(da.differenceTitle("Juli 2026", "month")).toBe("Juli 2026 mod en gennemsnitlig måned");
    expect(da.differenceTitle("2025", "year")).toBe("2025 mod et gennemsnitligt år");
  });
  it("words a subscription's repeat", () => {
    expect(da.repeatText("weekly", 0)).toBe("pr. uge");
    expect(da.repeatText("monthly", 0)).toBe("pr. måned");
    expect(da.repeatText("quarterly", 0)).toBe("pr. kvartal");
    expect(da.repeatText("half-year", 0)).toBe("pr. halvår");
    expect(da.repeatText("yearly", 0)).toBe("om året");
    expect(da.repeatText("weekly", 2)).toBe("hver 3. uge");
    expect(da.repeatText("monthly", 1)).toBe("hver 2. måned");
    expect(da.repeatText("quarterly", 1)).toBe("hvert 2. kvartal");
    expect(da.repeatText("half-year", 1)).toBe("hver 12. måned");
    expect(da.repeatText("yearly", 1)).toBe("hvert 2. år");
  });
  it("words a subscription's status", () => {
    expect(da.status.notSeen("5. jul")).toBe("Ikke set · ventet 5. jul");
    expect(da.status.risen("149,50", "149,75")).toBe("Steget · 149,50 → 149,75 kr.");
    expect(da.status.expected("1. nov")).toBe("Forventes 1. nov");
    expect(da.status.expected(null)).toBe("Forventes ikke");
    expect(da.status.paid("1. mar")).toBe("Betalt 1. mar");
  });
  it("counts subscriptions", () => {
    expect(da.subscriptionCount(1)).toBe("1 fast udgift");
    expect(da.subscriptionCount(5)).toBe("5 faste udgifter");
  });
});
