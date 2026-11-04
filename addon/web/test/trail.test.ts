import { unitAt } from "@ha-spending/shared";
import { fireEvent, getByRole, queryAllByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { rangeText, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { barButtons, names } from "./bars-helpers";
import { forgetCharts } from "./chart-mock";
import { answerFor } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

const TODAY = "2026-10-30";
const JAN = unitName(unitAt("2026-01-01", "month", TODAY), "month", false);
const ALL_THREE = "unit=2026-01-01&group=Bolig&category=Husleje";
const YEAR = da.presets.thisYear;

afterEach(() => {
  unmount();
  forgetCharts();
});

function trail(root: HTMLElement): HTMLElement {
  return getByRole(root, "navigation", { name: da.trail });
}

function trailText(root: HTMLElement): string {
  return (trail(root).textContent ?? "").replace(/\s+/g, " ").trim();
}

function params(): URLSearchParams {
  return new URLSearchParams(location.hash.slice(1));
}

function x(root: HTMLElement, step: string): HTMLElement {
  return getByRole(trail(root), "button", { name: da.remove(step) });
}

function focused(root: HTMLElement): Element | null {
  return (root as unknown as ShadowRoot).activeElement;
}

function heading(root: HTMLElement): HTMLElement {
  return getByRole(root, "heading", { level: 1 });
}

function headingText(root: HTMLElement): string {
  return (heading(root).textContent ?? "").trim();
}

async function back(app: SpendingApp): Promise<void> {
  history.back();
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await settle(app);
}

describe("the trail is the overview's filter", () => {
  it("names the unit, the main group and the category in order", async () => {
    const { root } = await mount(ALL_THREE);
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › ${JAN} › Bolig › Husleje`);
    expect(headingText(root)).toBe("Husleje");
  });

  it("puts the unit before the main group whatever order they were chosen in", async () => {
    const { app, root } = await mount("");
    const circle = getByRole(root, "region", { name: da.mainGroups });
    fireEvent.click(getByRole(circle, "button", { name: /^Bolig,/ }));
    await settle(app);
    const bars = getByRole(root, "region", { name: da.levelPer("Bolig", "month") });
    fireEvent.click(getByRole(bars, "button", { name: new RegExp(`^${JAN},`) }));
    await settle(app);
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › ${JAN} › Bolig ${da.categoryStep}`);
  });

  it("the unit's × removes the unit only and focuses the heading", async () => {
    const { app, root } = await mount(ALL_THREE);
    fireEvent.click(x(root, JAN));
    await settle(app);
    expect(params().get("unit")).toBeNull();
    expect(params().get("group")).toBe("Bolig");
    expect(params().get("category")).toBe("Husleje");
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › Bolig › Husleje`);
    expect(focused(root)).toBe(heading(root));
  });

  it("the main group's × removes the main group and its category", async () => {
    const { app, root } = await mount(ALL_THREE);
    fireEvent.click(x(root, "Bolig"));
    await settle(app);
    expect(params().get("unit")).toBe("2026-01-01");
    expect(params().get("group")).toBeNull();
    expect(params().get("category")).toBeNull();
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › ${JAN} ${da.mainGroupStep}`);
    expect(focused(root)).toBe(heading(root));
  });

  it("the category's × removes the category only", async () => {
    const { app, root } = await mount(ALL_THREE);
    fireEvent.click(x(root, "Husleje"));
    await settle(app);
    expect(params().get("unit")).toBe("2026-01-01");
    expect(params().get("group")).toBe("Bolig");
    expect(params().get("category")).toBeNull();
    expect(focused(root)).toBe(heading(root));
  });

  it("Alt forbrug removes the three and keeps the search and the shop", async () => {
    const { app, root } = await mount(`${ALL_THREE}&q=Hus&shop=Netto`);
    fireEvent.click(getByRole(trail(root), "link", { name: da.allSpending }));
    await settle(app);
    expect(params().get("unit")).toBeNull();
    expect(params().get("group")).toBeNull();
    expect(params().get("category")).toBeNull();
    expect(params().get("q")).toBe("Hus");
    expect(params().get("shop")).toBe("Netto");
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} ${da.mainGroupStep}`);
  });

  it("with nothing chosen has no link and no ×", async () => {
    const { root } = await mount("");
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} ${da.mainGroupStep}`);
    expect(queryByRole(trail(root), "link", { name: da.allSpending })).toBeNull();
    expect(queryByRole(trail(root), "button", { name: /^Fjern / })).toBeNull();
  });

  it("leaves the unit out while the answer loads", async () => {
    const { root } = await mount("unit=2026-01-01&group=Bolig", { answer: () => new Promise<Response>(() => {}) });
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › Bolig ${da.categoryStep}`);
  });

  it("leaves the unit out on an error", async () => {
    const { root } = await mount("unit=2026-01-01&group=Bolig", { answer: () => json({ error: "refused" }, 502) });
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › Bolig ${da.categoryStep}`);
  });

  it("shows no step for a unit the period does not have", async () => {
    const { root } = await mount("period=lastMonth&unit=2026-01-01");
    expect(trailText(root)).toBe(`${da.allSpending} › ${da.presets.lastMonth} ${da.mainGroupStep}`);
    expect(queryByRole(root, "button", { name: da.remove(JAN) })).toBeNull();
  });

  it("Back brings a removed unit's step back", async () => {
    const { app, root } = await mount(ALL_THREE);
    fireEvent.click(x(root, JAN));
    await settle(app);
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › Bolig › Husleje`);
    await back(app);
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › ${JAN} › Bolig › Husleje`);
  });

  it("the right card has no unit or category chip", async () => {
    const { root } = await mount(ALL_THREE);
    const right = getByRole(root, "region", { name: da.levelPer("Bolig", "month") });
    expect(queryByRole(right, "button", { name: da.remove(JAN) })).toBeNull();
    expect(queryByRole(right, "button", { name: da.remove("Husleje") })).toBeNull();
    unmount();
    const postings = await mount(`${ALL_THREE}&card=postings`).then((m) => m.root);
    const list = getByRole(postings, "region", { name: da.postingsOf("Bolig") });
    expect(queryByRole(list, "button", { name: da.remove(JAN) })).toBeNull();
    expect(queryByRole(list, "button", { name: da.remove("Husleje") })).toBeNull();
  });
});

describe("an old link to Alle posteringer", () => {
  it("shows the overview's trail with its unit and main group", async () => {
    const { root } = await mount("unit=2026-01-01&group=Bolig&view=all-postings&q=Hus&shop=Netto");
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › ${JAN} › Bolig ${da.categoryStep}`);
    getByRole(trail(root), "button", { name: da.remove(JAN) });
  });
});

describe("the trail holds the period and the levels", () => {
  const YEAR_NAME = da.periodStep(YEAR, rangeText({ start: "2026-01-01", end: TODAY }));

  function periodStep(root: HTMLElement): HTMLButtonElement {
    return getByRole(trail(root), "button", { name: YEAR_NAME }) as HTMLButtonElement;
  }

  function dashed(root: HTMLElement, name: string): HTMLButtonElement {
    return getByRole(trail(root), "button", { name }) as HTMLButtonElement;
  }

  function konti(root: HTMLElement): HTMLButtonElement {
    return getByRole(root, "button", { name: new RegExp(`^${da.accounts}`) }) as HTMLButtonElement;
  }

  it("reads Alt forbrug › I år Hovedgruppe on an empty hash, with the period as the heading", async () => {
    const { root } = await mount("");
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} ${da.mainGroupStep}`);
    expect(queryByRole(trail(root), "link", { name: da.allSpending })).toBeNull();
    expect(headingText(root)).toBe(YEAR);
    expect(heading(root).contains(periodStep(root))).toBe(true);
    expect(heading(root).contains(dashed(root, da.chooseMainGroup))).toBe(false);
  });

  it("has one period control, the trail's, and no Gruppér pr.", async () => {
    const { root } = await mount("");
    const periods = queryAllByRole(root, "button", { name: new RegExp(`^${da.period}`) });
    expect(periods).toEqual([periodStep(root)]);
    expect(queryByRole(root, "combobox")).toBeNull();
  });

  it("makes Alt forbrug a link with a unit, a main group or a category", async () => {
    for (const hash of ["unit=2026-01-01", "group=Bolig", "group=Bolig&category=Husleje"]) {
      const { root } = await mount(hash);
      getByRole(trail(root), "link", { name: da.allSpending });
      unmount();
    }
  });

  it("gives the heading the last step's text", async () => {
    const cases: [string, string][] = [
      ["unit=2026-01-01", JAN],
      ["group=Bolig", "Bolig"],
      ["unit=2026-01-01&group=Bolig&category=Husleje", "Husleje"],
    ];
    for (const [hash, text] of cases) {
      const { root } = await mount(hash);
      expect(headingText(root)).toBe(text);
      unmount();
    }
  });

  it("names the period step by the preset and its dates", async () => {
    const { root } = await mount("");
    expect(periodStep(root).textContent?.trim()).toBe(YEAR);
  });

  it("opens the Periode panel from the period step, and a preset changes the trail with a push", async () => {
    const { app, root } = await mount("");
    const push = vi.spyOn(history, "pushState");
    fireEvent.click(periodStep(root));
    await app.updateComplete;
    expect(periodStep(root).getAttribute("aria-expanded")).toBe("true");
    const panel = getByRole(root, "group", { name: da.period });
    fireEvent.click(getByRole(panel, "button", { name: da.presets.lastYear }));
    await settle(app);
    expect(push).toHaveBeenCalledWith(null, "", "#period=lastYear");
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();
    expect(trailText(root)).toBe(`${da.allSpending} › ${da.presets.lastYear} ${da.mainGroupStep}`);
    expect(headingText(root)).toBe(da.presets.lastYear);
  });

  it("shows a custom period's dates in the step", async () => {
    const { root } = await mount("period=custom&from=2026-01-01&to=2026-03-15");
    const range = rangeText({ start: "2026-01-01", end: "2026-03-15" });
    const step = getByRole(trail(root), "button", { name: da.periodStep(da.customLabel, range) });
    expect(step.textContent?.trim()).toBe(range);
    expect(trailText(root)).toBe(`${da.allSpending} › ${range} ${da.mainGroupStep}`);
  });

  it("names Alt by itself before the first answer", async () => {
    const { root } = await mount("period=all", { answer: () => new Promise<Response>(() => {}) });
    getByRole(trail(root), "button", { name: da.periodStep(da.presets.all, null) });
  });

  it("shows a chosen main group and category as buttons with a ×, and no dashed button after a category", async () => {
    const { root } = await mount("group=Bolig&category=Husleje");
    expect(trailText(root)).toBe(`${da.allSpending} › ${YEAR} › Bolig › Husleje`);
    const mainGroup = getByRole(trail(root), "button", { name: da.switchMainGroup("Bolig") });
    const category = getByRole(trail(root), "button", { name: da.switchCategory("Husleje") });
    expect(mainGroup.getAttribute("aria-expanded")).toBe("false");
    expect(category.getAttribute("aria-expanded")).toBe("false");
    expect(mainGroup.getAttribute("aria-haspopup")).toBeNull();
    expect(category.getAttribute("aria-haspopup")).toBeNull();
    expect(heading(root).contains(category)).toBe(true);
    getByRole(trail(root), "button", { name: da.remove("Bolig") });
    getByRole(trail(root), "button", { name: da.remove("Husleje") });
    expect(queryByRole(trail(root), "button", { name: da.chooseMainGroup })).toBeNull();
    expect(queryByRole(trail(root), "button", { name: da.chooseCategory })).toBeNull();
  });

  it("gives the dashed buttons an expanded state and no popup role", async () => {
    const { root } = await mount("");
    const mainGroup = dashed(root, da.chooseMainGroup);
    expect(mainGroup.getAttribute("aria-expanded")).toBe("false");
    expect(mainGroup.getAttribute("aria-haspopup")).toBeNull();
    unmount();
    const { root: withGroup } = await mount("group=Bolig");
    const category = dashed(withGroup, da.chooseCategory);
    expect(category.getAttribute("aria-expanded")).toBe("false");
    expect(category.getAttribute("aria-haspopup")).toBeNull();
  });

  it("disables the dashed button and the level steps while loading, and the period step works", async () => {
    const { app, root } = await mount("group=Bolig", {
      answer: (range, n) => (n === 1 ? json(answerFor(range)) : new Promise<Response>(() => {})),
    });
    fireEvent.click(getByRole(trail(root), "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastYear }));
    await settle(app);
    expect(queryAllByRole(root, "region", { name: da.loading }).length).toBeGreaterThan(0);
    expect(dashed(root, da.chooseCategory).disabled).toBe(true);
    expect((getByRole(trail(root), "button", { name: da.switchMainGroup("Bolig") }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await expectTopFilterWorks(app, root);
  });

  it("disables the dashed button and the level steps on an error, and the period step and Konti work", async () => {
    const { app, root } = await mount("group=Bolig", {
      answer: (range, n) => (n === 1 ? json(answerFor(range)) : json({ error: "unreachable" }, 502)),
    });
    fireEvent.click(getByRole(trail(root), "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastYear }));
    await settle(app);
    getByRole(root, "alert");
    expect(dashed(root, da.chooseCategory).disabled).toBe(true);
    expect((getByRole(trail(root), "button", { name: da.switchMainGroup("Bolig") }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await expectTopFilterWorks(app, root);
  });

  it("disables the dashed button before the first answer", async () => {
    const { root } = await mount("", { answer: () => new Promise<Response>(() => {}) });
    expect(dashed(root, da.chooseMainGroup).disabled).toBe(true);
    expect(periodStep(root).disabled).toBe(false);
  });

  async function expectTopFilterWorks(app: SpendingApp, root: HTMLElement): Promise<void> {
    const period = getByRole(trail(root), "button", { name: new RegExp(`^${da.period}`) }) as HTMLButtonElement;
    expect(period.disabled).toBe(false);
    fireEvent.click(period);
    await app.updateComplete;
    getByRole(root, "group", { name: da.period });
    fireEvent.keyDown(getByRole(root, "group", { name: da.period }), { key: "Escape" });
    await settle(app);
    expect(konti(root).disabled).toBe(false);
    fireEvent.click(konti(root));
    await app.updateComplete;
    getByRole(root, "group", { name: da.accounts });
  }
});

describe("a unit's name carries its year only when the bars cross a new year", () => {
  const at = (day: string, earliest?: string) => ({
    now: `${day}T10:00:00Z`,
    answer: (range: { start: string; end: string }) => {
      const data = answerFor(range, day);
      return json(earliest === undefined ? data : { ...data, earliestPostingDate: earliest });
    },
  });

  function postingsGroups(root: HTMLElement): string[] {
    return queryAllByRole(getByRole(root, "region", { name: da.postingsTitle }), "button")
      .map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "")
      .filter((n) => /^Juli\b/.test(n));
  }

  it("with I år the trail, the bar and the Posteringer group read the month alone", async () => {
    const { root } = await mount("unit=2026-07-01", at(TODAY));
    getByRole(trail(root), "button", { name: da.remove("Juli") });
    expect(queryByRole(trail(root), "button", { name: da.remove("Juli 2026") })).toBeNull();
    expect(names(barButtons(root, da.per("month")))[6]).toMatch(/^Juli,/);
    getByRole(trail(root), "button", { name: da.remove("Juli") });
  });

  it("with I år the Posteringer group lines are months without a year", async () => {
    const { root } = await mount("card=postings", at(TODAY));
    expect(postingsGroups(root).length).toBe(1);
    expect(postingsGroups(root)[0]).toMatch(/^Juli, /);
  });

  it("with Sidste 12 måneder in November the month keeps its year", async () => {
    const { root } = await mount("period=last12Months&unit=2026-07-01", at("2026-11-04"));
    getByRole(trail(root), "button", { name: da.remove("Juli 2026") });
    expect(names(barButtons(root, da.per("month"))).some((n) => n.startsWith("Juli 2026,"))).toBe(true);
  });

  it("with Alt over three years the year units read 2025", async () => {
    const { root } = await mount("period=all&unit=2025-01-01", at(TODAY, "2024-03-01"));
    getByRole(trail(root), "button", { name: da.remove("2025") });
  });

  it("names the Posteringer groups of Sidste 12 måneder with their year", async () => {
    const { root } = await mount("period=last12Months&card=postings", at("2026-11-04"));
    expect(postingsGroups(root).length).toBeGreaterThan(0);
    expect(postingsGroups(root).every((n) => n.startsWith("Juli 2026"))).toBe(true);
  });
});
