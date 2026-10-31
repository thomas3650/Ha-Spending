import { describe, expect, it } from "vitest";
import { toOre } from "../src/firefly/amount";
import { FireflyError } from "../src/firefly/client";

describe("toOre", () => {
  it("reads Firefly III's twelve decimals as whole øre", () => {
    expect(toOre("75.000000000000")).toBe(7500);
    expect(toOre("0.290000000000")).toBe(29);
    expect(toOre("1722.860000000000")).toBe(172286);
  });

  it("rounds half away from zero at the third decimal only", () => {
    expect(toOre("0.005000000000")).toBe(1);
    expect(toOre("12.344999999999")).toBe(1234);
    expect(toOre("-0.005")).toBe(-1);
  });

  it("reads a sign and missing decimals", () => {
    expect(toOre("-3.5")).toBe(-350);
    expect(toOre("8")).toBe(800);
  });

  it("refuses a malformed amount without echoing it", () => {
    for (const amount of ["", "12,50", "1.2.3", "abc", "1e3"]) {
      let error: unknown;
      try {
        toOre(amount);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(FireflyError);
      expect((error as FireflyError).reason).toBe("unreachable");
      if (amount !== "") expect((error as FireflyError).message).not.toContain(amount);
    }
  });
});
