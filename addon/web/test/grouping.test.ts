import { type Period, unitAt, unitsOf } from "@ha-spending/shared";
import { getAllByRole, getByRole, getByText, queryAllByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { type BarItem, barTooltip } from "../src/components/bars";
import { kr, unitName, withYear } from "../src/format";
import { da } from "../src/i18n/da";
import { barsList, barButtons, names } from "./bars-helpers";
import { forgetCharts } from "./chart-mock";
import { answerFor, OBJECT_GROUP } from "./fixture";
import { json, mount, unmount } from "./mount";
import { cardNames } from "./text";

afterEach(() => {
  unmount();
  forgetCharts();
});

const TODAY = "2026-10-30";

function nowAt(day: string, earliest?: string) {
  return {
    now: `${day}T10:00:00Z`,
    answer: (range: Period) => {
      const data = answerFor(range, day);
      return json(earliest === undefined ? data : { ...data, earliestPostingDate: earliest });
    },
  };
}

function shownNames(buttons: HTMLElement[]): string[] {
  return names(buttons).map((n) => n.split(" (")[0].split(",")[0]);
}

function monthNames(period: Period, today: string): string[] {
  const units = unitsOf(period, "month", today);
  return units.map((u) => unitName(u, "month", withYear(units)));
}

function barItems(root: HTMLElement): BarItem[] {
  return (root.querySelector("hs-bars") as unknown as { items: BarItem[] }).items;
}

function trail(root: HTMLElement): HTMLElement {
  return getByRole(root, "navigation", { name: da.trail });
}

describe("the grouping follows the period", () => {
  it("Sidste 3 måneder in March draws three months across the new year", async () => {
    const today = "2026-03-15";
    const { root } = await mount("period=last3Months", nowAt(today));
    expect(shownNames(barButtons(root, da.per("month")))).toEqual(
      monthNames({ start: "2025-12-01", end: "2026-02-28" }, today),
    );
    expect(queryByRole(root, "region", { name: da.per("year") })).toBeNull();
  });

  it("I år in February draws two months", async () => {
    const { root } = await mount("", nowAt("2026-02-10"));
    expect(barButtons(root, da.per("month"))).toHaveLength(2);
  });

  it("Sidste 12 måneder in November draws twelve months", async () => {
    const today = "2026-11-04";
    const { root } = await mount("period=last12Months", nowAt(today));
    expect(shownNames(barButtons(root, da.per("month")))).toEqual(
      monthNames({ start: "2025-11-01", end: "2026-10-31" }, today),
    );
  });

  it("Alt over three years draws a bar per year and averages per year", async () => {
    const { root } = await mount("period=all", nowAt(TODAY, "2024-03-01"));
    expect(shownNames(barButtons(root, da.per("year")))).toEqual(["2024", "2025", "2026"]);
    expect(cardNames(root, [OBJECT_GROUP])).toEqual([da.spendingInPeriod, da.averagePer("year")]);
    const average = getByRole(root, "group", { name: da.averagePer("year") });
    getByText(average, kr(600000));
    getByText(average, da.unitCount(2, "year"));
  });

  it("Alt over 17 months draws a bar per month and averages per month", async () => {
    const { root } = await mount("period=all", nowAt(TODAY, "2025-06-01"));
    expect(shownNames(barButtons(root, da.per("month")))).toEqual(
      monthNames({ start: "2025-06-01", end: "2026-10-31" }, TODAY),
    );
    expect(barButtons(root, da.per("month"))).toHaveLength(17);
    const average = getByRole(root, "group", { name: da.averagePer("month") });
    getByText(average, kr(727187));
    getByText(average, da.unitCount(16, "month"));
  });
});

describe("a one-unit period's bars are not buttons", () => {
  it("Denne måned draws its days with tooltips and no buttons", async () => {
    const { root } = await mount("period=thisMonth");
    const list = barsList(root, da.per("day"));
    expect(queryAllByRole(list, "button")).toHaveLength(0);
    expect(getAllByRole(list, "listitem")).toHaveLength(31);
    expect(barTooltip(barItems(root)[0]).split("<br>")[0]).toBe(unitName(unitAt("2026-10-01", "day", TODAY), "day", false));
  });

  it("I år in January draws January's days with tooltips and no buttons", async () => {
    const today = "2026-01-05";
    const { root } = await mount("", nowAt(today));
    const list = barsList(root, da.per("day"));
    expect(queryAllByRole(list, "button")).toHaveLength(0);
    expect(getAllByRole(list, "listitem")).toHaveLength(31);
    expect(barTooltip(barItems(root)[0]).split("<br>")[0]).toBe(unitName(unitAt("2026-01-01", "day", today), "day", false));
  });
});

describe("the unit step after the grouping", () => {
  const october = unitName(unitAt("2026-10-01", "month", TODAY), "month", false);
  const april = unitName(unitAt("2026-04-01", "month", TODAY), "month", false);

  it("a one-unit period shows no unit step", async () => {
    const { root } = await mount("period=thisMonth&unit=2026-10-01");
    expect(queryByRole(trail(root), "button", { name: da.remove(october) })).toBeNull();
    expect(new URLSearchParams(location.hash.slice(1)).get("unit")).toBeNull();
  });

  it("an old week's unit that starts mid-month shows no unit step, and month bars", async () => {
    const { root } = await mount("by=week&unit=2026-03-09");
    expect(queryAllByRole(trail(root), "button", { name: new RegExp(`^${da.remove("")}`) })).toHaveLength(0);
    expect(new URLSearchParams(location.hash.slice(1)).get("unit")).toBeNull();
    expect(barButtons(root, da.per("month"))).toHaveLength(10);
  });

  it("an old quarter's unit shows as its first month", async () => {
    const { root } = await mount("by=quarter&unit=2026-04-01");
    getByRole(trail(root), "button", { name: da.remove(april) });
  });
});
