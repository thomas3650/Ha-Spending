import { unitAt } from "@ha-spending/shared";
import { fireEvent, getByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import type { SpendingApp } from "../src/app";
import { unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { forgetCharts } from "./chart-mock";
import { json, mount, settle, unmount } from "./mount";

const TODAY = "2026-10-30";
const JAN = unitName(unitAt("2026-01-01", "month", TODAY), "month");
const ALL_THREE = "unit=2026-01-01&group=Bolig&category=Husleje";

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

async function back(app: SpendingApp): Promise<void> {
  history.back();
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await settle(app);
}

describe("the trail is the overview's filter", () => {
  it("names the unit, the main group and the category in order", async () => {
    const { root } = await mount(ALL_THREE);
    expect(trailText(root)).toBe(`${da.allSpending} › ${JAN} › Bolig › Husleje`);
    expect(heading(root).textContent?.trim()).toBe("Husleje");
  });

  it("puts the unit before the main group whatever order they were chosen in", async () => {
    const { app, root } = await mount("");
    const circle = getByRole(root, "region", { name: da.mainGroups });
    fireEvent.click(getByRole(circle, "button", { name: /^Bolig,/ }));
    await settle(app);
    const bars = getByRole(root, "region", { name: da.levelPer("Bolig", "month") });
    fireEvent.click(getByRole(bars, "button", { name: new RegExp(`^${JAN},`) }));
    await settle(app);
    expect(trailText(root)).toBe(`${da.allSpending} › ${JAN} › Bolig`);
  });

  it("the unit's × removes the unit only and focuses the heading", async () => {
    const { app, root } = await mount(ALL_THREE);
    fireEvent.click(x(root, JAN));
    await settle(app);
    expect(params().get("unit")).toBeNull();
    expect(params().get("group")).toBe("Bolig");
    expect(params().get("category")).toBe("Husleje");
    expect(trailText(root)).toBe(`${da.allSpending} › Bolig › Husleje`);
    expect(focused(root)).toBe(heading(root));
  });

  it("the main group's × removes the main group and its category", async () => {
    const { app, root } = await mount(ALL_THREE);
    fireEvent.click(x(root, "Bolig"));
    await settle(app);
    expect(params().get("unit")).toBe("2026-01-01");
    expect(params().get("group")).toBeNull();
    expect(params().get("category")).toBeNull();
    expect(trailText(root)).toBe(`${da.allSpending} › ${JAN}`);
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
    expect(trailText(root)).toBe(da.allSpending);
  });

  it("with nothing chosen has no link and no ×", async () => {
    const { root } = await mount("");
    expect(trailText(root)).toBe(da.allSpending);
    expect(queryByRole(trail(root), "link", { name: da.allSpending })).toBeNull();
    expect(queryByRole(trail(root), "button", { name: /^Fjern / })).toBeNull();
  });

  it("leaves the unit out while the answer loads", async () => {
    const { root } = await mount("unit=2026-01-01&group=Bolig", { answer: () => new Promise<Response>(() => {}) });
    expect(trailText(root)).toBe(`${da.allSpending} › Bolig`);
  });

  it("leaves the unit out on an error", async () => {
    const { root } = await mount("unit=2026-01-01&group=Bolig", { answer: () => json({ error: "refused" }, 502) });
    expect(trailText(root)).toBe(`${da.allSpending} › Bolig`);
  });

  it("shows no step for a unit the period does not have", async () => {
    const { root } = await mount("period=lastMonth&unit=2026-01-01");
    expect(trailText(root)).toBe(da.allSpending);
    expect(queryByRole(root, "button", { name: da.remove(JAN) })).toBeNull();
  });

  it("Back brings a removed unit's step back", async () => {
    const { app, root } = await mount(ALL_THREE);
    fireEvent.click(x(root, JAN));
    await settle(app);
    expect(trailText(root)).toBe(`${da.allSpending} › Bolig › Husleje`);
    await back(app);
    expect(trailText(root)).toBe(`${da.allSpending} › ${JAN} › Bolig › Husleje`);
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

describe("the trail on Alle posteringer", () => {
  const ON_ALL = "unit=2026-01-01&group=Bolig&view=all-postings&q=Hus&shop=Netto";

  it("is Alt forbrug › Alle posteringer, with no ×", async () => {
    const { root } = await mount(ON_ALL);
    expect(trailText(root)).toBe(`${da.allSpending} › ${da.allPostings}`);
    expect(queryByRole(trail(root), "button", { name: /^Fjern / })).toBeNull();
  });

  it("Alt forbrug goes back to the overview with the shared choices kept", async () => {
    const { app, root } = await mount(ON_ALL);
    fireEvent.click(getByRole(trail(root), "link", { name: da.allSpending }));
    await settle(app);
    expect(params().get("view")).toBeNull();
    expect(params().get("unit")).toBe("2026-01-01");
    expect(params().get("group")).toBe("Bolig");
    expect(params().get("q")).toBe("Hus");
    expect(params().get("shop")).toBe("Netto");
    expect(trailText(root)).toBe(`${da.allSpending} › ${JAN} › Bolig`);
  });

  it("a unit removed there is gone on the overview, and Back brings it back", async () => {
    const { app, root } = await mount("unit=2026-01-01&group=Bolig&view=all-postings");
    fireEvent.click(getByRole(root, "button", { name: da.remove(JAN) }));
    await settle(app);
    fireEvent.click(getByRole(trail(root), "link", { name: da.allSpending }));
    await settle(app);
    expect(trailText(root)).toBe(`${da.allSpending} › Bolig`);
    await back(app);
    expect(params().get("view")).toBe("all-postings");
    expect(queryByRole(root, "button", { name: da.remove(JAN) })).toBeNull();
    await back(app);
    expect(params().get("view")).toBe("all-postings");
    getByRole(root, "button", { name: da.remove(JAN) });
  });
});
