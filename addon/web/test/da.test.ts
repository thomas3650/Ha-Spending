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
  });
  it("words the amount chip", () => {
    expect(da.amountChip(100, 500)).toBe("Beløb: 100–500 kr.");
    expect(da.amountChip(100, null)).toBe("Beløb: fra 100 kr.");
    expect(da.amountChip(null, 500)).toBe("Beløb: til 500 kr.");
  });
  it("titles the difference", () => {
    expect(da.differenceTitle("Juli 2026", "month")).toBe("Juli 2026 mod en gennemsnitlig måned");
    expect(da.differenceTitle("2025", "year")).toBe("2025 mod et gennemsnitligt år");
  });
});
