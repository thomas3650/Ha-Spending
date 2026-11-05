import type { Period } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryAllByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { kr } from "../src/format";
import { da } from "../src/i18n/da";
import { MINUS } from "../src/model/left-over";
import { answerFor, leftOverFor, withLeftOver } from "./fixture";
import { json, mount, type MountOptions, settle, unmount } from "./mount";
import { cardNames } from "./text";

afterEach(unmount);

const CARD = da.leftOver.label(null);
const COLUMNS = da.leftOver.columns;
const CUT = "period=custom&from=2026-09-15&to=2026-11-10";
/** The fixture's posting p23. */
const CAFE = "Café Søde";

function withCard(range: Period): Response {
  return json(withLeftOver(answerFor(range)));
}

async function open(hash: string, opts: MountOptions = {}) {
  return mount(hash, { answer: withCard, ...opts });
}

function flat(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

async function click(app: SpendingApp, el: HTMLElement): Promise<void> {
  fireEvent.click(el);
  await settle(app);
}

async function hashBecomes(app: SpendingApp, hash: string): Promise<void> {
  await vi.waitFor(() => expect(location.hash).toBe(hash));
  await settle(app);
}

function table(root: HTMLElement): HTMLTableElement {
  return getByRole(root, "table", { name: da.leftOver.table }) as HTMLTableElement;
}

function monthsLink(root: HTMLElement): HTMLElement {
  return getByRole(getByRole(root, "group", { name: CARD }), "link", { name: da.leftOver.showMonths });
}

function trail(root: HTMLElement): HTMLElement {
  return getByRole(root, "navigation", { name: da.trail });
}

/** The trail's "Alt forbrug", which on Til overs leaves it. */
function leave(root: HTMLElement): HTMLElement {
  return getByRole(trail(root), "link", { name: da.allSpending });
}

function heads(root: HTMLElement): string[] {
  return getAllByRole(table(root), "columnheader").map(flat);
}

/** Each row by its row head, the cells keyed by their column's head. */
function rows(root: HTMLElement): { head: HTMLElement; cells: Record<string, string> }[] {
  const names = heads(root);
  return getAllByRole(table(root), "row")
    .filter((row) => queryAllByRole(row, "rowheader").length === 1)
    .map((row) => {
      const cells = getAllByRole(row, "cell").map(flat);
      return {
        head: getByRole(row, "rowheader"),
        cells: Object.fromEntries(cells.map((text, i) => [names[i + 1], text])),
      };
    });
}

/** The cell's amount in kroner, without its members line or "lånt" and "betalt af". */
function amount(text: string): number {
  const match = new RegExp(`^(0|[+${MINUS}][\\d.]+)`).exec(text);
  if (match === null) throw new Error(`no amount in "${text}"`);
  const value = Number(match[1].slice(1).replaceAll(".", ""));
  return match[1] === "0" ? 0 : match[1].startsWith(MINUS) ? -value : value;
}

function monthNames(root: HTMLElement): string[] {
  return rows(root).map((r) => {
    const button = queryByRole(r.head, "button");
    return button === null ? `[${flat(r.head)}]` : flat(button);
  });
}

function inOverview(root: HTMLElement, g: "month" | "day" = "month"): void {
  getByRole(root, "region", { name: da.per(g) });
  expect(queryByRole(root, "table", { name: da.leftOver.table })).toBeNull();
}

describe("the Til overs view (spec §2.2, §4)", () => {
  it("opens from the card's link with the columns in order, the months newest first and I alt last", async () => {
    const { app, root } = await open("");
    await click(app, monthsLink(root));
    expect(location.hash).toBe("#view=leftover");
    expect(heads(root)).toEqual([
      da.leftOver.monthColumn,
      COLUMNS.paidIn,
      COLUMNS.back,
      COLUMNS.spending,
      COLUMNS.leftOver,
      COLUMNS.credit,
      COLUMNS.savings,
      COLUMNS.other,
      COLUMNS.change,
    ]);
    expect(monthNames(root)).toEqual([
      `okt. ${da.leftOver.running}`,
      "sep.",
      "aug.",
      "jul.",
      "jun.",
      "maj",
      "apr.",
      "mar.",
      "feb.",
      "jan.",
      `[${da.leftOver.total}]`,
    ]);
    getByText(root, da.leftOver.note);
  });

  it("replaces the key numbers and the overview's halves", async () => {
    const { root } = await open("view=leftover");
    table(root);
    expect(cardNames(root)).toEqual([]);
    expect(queryByRole(root, "region", { name: da.per("month") })).toBeNull();
  });

  it("shows the members under Ind and Tilbage, and a draw on the credit as lånt", async () => {
    const { root } = await open("view=leftover");
    const [october, september] = rows(root);
    expect(october.cells[COLUMNS.paidIn]).toBe("+31.000 Anna 18.000 · Bo 13.000");
    expect(october.cells[COLUMNS.back]).toBe(`${MINUS}2.000 Anna 2.000`);
    expect(september.cells[COLUMNS.credit]).toBe(`+10.000 ${da.leftOver.borrowed}`);
  });

  it("adds up by both sum rules on every row and on I alt, as shown", async () => {
    const { root } = await open("view=leftover");
    const all = rows(root);
    expect(all).toHaveLength(11);
    for (const { cells } of all) {
      const a = (column: string) => amount(cells[column]);
      expect(a(COLUMNS.leftOver)).toBe(a(COLUMNS.paidIn) + a(COLUMNS.back) + a(COLUMNS.spending));
      expect(a(COLUMNS.change)).toBe(
        a(COLUMNS.leftOver) + a(COLUMNS.credit) + a(COLUMNS.savings) + a(COLUMNS.other),
      );
    }
    const total = all[all.length - 1].cells;
    for (const column of [COLUMNS.paidIn, COLUMNS.spending, COLUMNS.leftOver, COLUMNS.change]) {
      const months = all.slice(0, -1).reduce((sum, r) => sum + amount(r.cells[column]), 0);
      expect(amount(total[column])).toBe(months);
    }
  });

  it("I alt's Til overs is the card's number on a period cut mid-month", async () => {
    const { app, root, leftOver } = await open(CUT);
    const card = flat(getByRole(root, "group", { name: CARD }));
    await click(app, monthsLink(root));
    expect(leftOver).toHaveBeenCalledTimes(1);
    expect(leftOver.mock.calls[0][0]).toBe("api/left-over?start=2026-09-15&end=2026-11-10");
    expect(monthNames(root)).toEqual(["nov.", `okt. ${da.leftOver.running}`, "sep.", `[${da.leftOver.total}]`]);
    const total = amount(rows(root)[3].cells[COLUMNS.leftOver]);
    expect(total).not.toBe(0);
    expect(card).toContain(`${total < 0 ? MINUS : ""}${kr(Math.abs(total) * 100)}`);
  });

  it("a month with no postings is a row of zeros", async () => {
    const { root } = await open("view=leftover");
    const june = rows(root).find((r) => flat(r.head) === "jun.");
    expect(june).toBeDefined();
    expect(Object.values(june?.cells ?? {})).toEqual(Array(8).fill("0"));
  });

  it("leaves out Kreditten and Opsparing when the household has neither", async () => {
    const { root } = await open("view=leftover", {
      leftOver: (range) => json({ ...leftOverFor(range), hasCredit: false, hasSavings: false }),
    });
    expect(heads(root)).toEqual([
      da.leftOver.monthColumn,
      COLUMNS.paidIn,
      COLUMNS.back,
      COLUMNS.spending,
      COLUMNS.leftOver,
      COLUMNS.other,
      COLUMNS.change,
    ]);
  });

  it("names the months with their year over two calendar years", async () => {
    const { root } = await open("period=custom&from=2025-11-01&to=2026-02-28&view=leftover");
    expect(monthNames(root)).toEqual(["feb. 2026", "jan. 2026", "dec. 2025", "nov. 2025", `[${da.leftOver.total}]`]);
  });
});

describe("the trail (spec §4.1)", () => {
  it("is Alt forbrug › Til overs › the period, then the unit word and Hovedgruppe, with Konti", async () => {
    const { root } = await open("view=leftover");
    const nav = trail(root);
    expect(flat(nav)).toBe(`${da.allSpending} › ${da.leftOver.name} › ${da.presets.thisYear} ${da.monthStep} ${da.mainGroupStep}`);
    expect(queryAllByRole(nav, "link")).toEqual([leave(root)]);
    expect(getAllByRole(nav, "button")).toHaveLength(3);
    expect(flat(getByRole(nav, "heading", { level: 1 }))).toBe(da.presets.thisYear);
    expect(flat(getByRole(root, "button", { name: new RegExp(`^${da.accounts}`) }))).toContain(da.allAccountsCount(2));
  });

  it("Konti, the unit word and Hovedgruppe are greyed, reachable by Tab, and do not open", async () => {
    const { app, root } = await open("view=leftover");
    const parts = [
      { name: new RegExp(`^${da.accounts}`), description: da.leftOver.allAccountsNote },
      { name: da.chooseMonth, description: da.leftOver.wholePeriodNote },
      { name: da.chooseMainGroup, description: da.leftOver.wholePeriodNote },
    ];
    for (const part of parts) {
      const button = getByRole(root, "button", part) as HTMLButtonElement;
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.disabled).toBe(false);
      expect(button.tabIndex).toBeGreaterThanOrEqual(0);
      await click(app, button);
      expect(button.getAttribute("aria-expanded")).not.toBe("true");
    }
    expect(queryByRole(root, "group", { name: da.accounts })).toBeNull();
    expect(queryByRole(root, "group", { name: da.units })).toBeNull();
    expect(queryByRole(root, "group", { name: da.mainGroups })).toBeNull();
    expect(flat(getByRole(root, "button", { name: new RegExp(`^${da.accounts}`) }))).toContain(da.allAccountsCount(2));
    expect(location.hash).toBe("#view=leftover");
  });

  it("Denne måned has no unit word", async () => {
    const { root } = await open("period=thisMonth&view=leftover");
    expect(flat(trail(root))).toBe(`${da.allSpending} › ${da.leftOver.name} › ${da.presets.thisMonth} ${da.mainGroupStep}`);
    expect(queryByRole(root, "button", { name: da.chooseMonth })).toBeNull();
  });

  it("a new period asks for its months and stays in the view", async () => {
    const { app, root, leftOver } = await open("view=leftover");
    const length = history.length;
    await click(app, getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await click(app, getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    expect(location.hash).toBe("#period=lastMonth&view=leftover");
    expect(history.length).toBe(length + 1);
    expect(leftOver).toHaveBeenCalledTimes(2);
    expect(leftOver.mock.calls[1][0]).toBe("api/left-over?start=2026-09-01&end=2026-09-30");
    expect(monthNames(root)).toEqual(["sep.", `[${da.leftOver.total}]`]);
  });
});

describe("the way in and out (spec §2.2)", () => {
  it("has no Tilbage til overblikket button and has an Alt forbrug link", async () => {
    const { root } = await open("view=leftover");
    expect(queryByRole(root, "button", { name: "Tilbage til overblikket" })).toBeNull();
    expect(leave(root).tagName).toBe("A");
  });

  it("the link's href is the overview's hash", async () => {
    const { root } = await open("card=postings&detail=p:p23&view=leftover");
    expect(leave(root).getAttribute("href")).toBe("#card=postings&detail=p%3Ap23");
    expect(fireEvent.click(leave(root), { metaKey: true })).toBe(true);
  });

  it("the link right after the open goes back, so Forward reopens the page", async () => {
    const { app, root } = await open("");
    const active = () => app.shadowRoot?.activeElement;
    const length = history.length;
    await click(app, monthsLink(root));
    expect(history.length).toBe(length + 1);
    expect(active()).toBe(table(root).caption);
    await click(app, leave(root));
    await hashBecomes(app, "");
    expect(history.length).toBe(length + 1);
    inOverview(root);
    expect(active()).toBe(getByRole(root, "heading", { level: 2, name: da.per("month") }));
    history.forward();
    await hashBecomes(app, "#view=leftover");
    table(root);
  });

  it("Escape right after the open goes back too, and the focus goes to the overview's heading", async () => {
    const { app, root } = await open("");
    await click(app, monthsLink(root));
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "");
    inOverview(root);
    expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: da.per("month") }));
  });

  it("the link after another choice replaces, and Back lands on the first view entry", async () => {
    const { app, root } = await open("");
    await click(app, monthsLink(root));
    await click(app, getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await click(app, getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    expect(location.hash).toBe("#period=lastMonth&view=leftover");
    const length = history.length;
    await click(app, leave(root));
    expect(location.hash).toBe("#period=lastMonth");
    expect(history.length).toBe(length);
    inOverview(root, "day");
    history.back();
    await hashBecomes(app, "#view=leftover");
    table(root);
  });

  it("after the link the focus is on the overview's heading", async () => {
    const { app, root } = await open("view=leftover");
    const alt = leave(root);
    alt.focus();
    await click(app, alt);
    expect(location.hash).toBe("");
    expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: da.per("month") }));
  });

  it("the link and Escape on a link to the view replace the entry with the overview's", async () => {
    for (const out of [(root: HTMLElement) => fireEvent.click(leave(root)), () => fireEvent.keyDown(window, { key: "Escape" })]) {
      const { app, root } = await open("card=postings&view=leftover");
      const length = history.length;
      out(root);
      await settle(app);
      expect(location.hash).toBe("#card=postings");
      expect(history.length).toBe(length);
      getByRole(root, "region", { name: da.postingsTitle });
      unmount();
    }
  });

  it("a past month's button opens the overview for that whole month, pushing an entry", async () => {
    const { app, root } = await open(CUT);
    await click(app, monthsLink(root));
    const length = history.length;
    await click(app, getByRole(table(root), "button", { name: "sep." }));
    expect(location.hash).toBe("#period=custom&from=2026-09-01&to=2026-09-30");
    expect(history.length).toBe(length + 1);
    getByRole(root, "region", { name: da.per("day") });
    expect(queryByRole(root, "table", { name: da.leftOver.table })).toBeNull();
  });

  it("after a month's button, the focus is on the overview's heading once its answer is in", async () => {
    const { app, root } = await open("");
    await click(app, monthsLink(root));
    const button = getByRole(table(root), "button", { name: "sep." });
    button.focus();
    await click(app, button);
    expect(location.hash).toBe("#period=custom&from=2026-09-01&to=2026-09-30");
    expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: da.per("day") }));
  });

  it("today's month's button opens Denne måned", async () => {
    const { app, root } = await open("view=leftover");
    await click(app, getByRole(table(root), "button", { name: `okt. ${da.leftOver.running}` }));
    expect(location.hash).toBe("#period=thisMonth");
  });

  it("one Escape leaves the view with a detail kept for the way back, and the detail is open again", async () => {
    const { app, root } = await open("card=postings&detail=p:p23&view=leftover");
    table(root);
    expect(queryByRole(root, "heading", { level: 3, name: CAFE })).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    await settle(app);
    expect(location.hash).toBe("#card=postings&detail=p%3Ap23");
    getByRole(root, "heading", { level: 3, name: CAFE });
    expect(queryByRole(root, "table", { name: da.leftOver.table })).toBeNull();
  });

  it("a stale link with no Til overs shows the overview and replaces the entry without the view", async () => {
    const length = history.length;
    const { root, leftOver } = await mount("card=postings&view=leftover");
    expect(location.hash).toBe("#card=postings");
    expect(history.length).toBe(length);
    expect(history.state).toBeNull();
    getByRole(root, "region", { name: da.postingsTitle });
    expect(queryByRole(root, "table", { name: da.leftOver.table })).toBeNull();
    expect(leftOver).not.toHaveBeenCalled();
  });
});

describe("loading and errors (spec §4.3)", () => {
  it("says once that the rule group is missing, as the overview does", async () => {
    const { root } = await open("view=leftover", {
      answer: (range) => json({ ...withLeftOver(answerFor(range)), mainGroupsFound: false }),
    });
    table(root);
    const status = getAllByRole(root, "status");
    expect(status).toHaveLength(1);
    expect(flat(status[0])).toBe(da.noRuleGroup);
  });

  it("when the view is entered and its months fail, the focus goes to the trail's heading", async () => {
    const { app, root } = await open("", {
      leftOver: (range, n) => (n === 1 ? json(leftOverFor(range)) : json({ error: "unreachable" }, 502)),
    });
    location.hash = "period=lastYear&view=leftover";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await settle(app);
    getByRole(root, "alert");
    const nav = getByRole(root, "navigation", { name: da.trail });
    expect(app.shadowRoot?.activeElement).toBe(getByRole(nav, "heading", { level: 1 }));
  });

  it("while the months load, the table has one placeholder row per month of the period", async () => {
    const { root } = await open("view=leftover", { leftOver: () => new Promise<Response>(() => {}) });
    const busy = table(root);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(getAllByRole(busy, "row")).toHaveLength(10);
    expect(queryAllByRole(busy, "button")).toHaveLength(0);
  });

  it("while the page's own answer loads, the table has its placeholder rows too", async () => {
    const { root } = await open("period=lastMonth&view=leftover", { answer: () => new Promise<Response>(() => {}) });
    expect(getAllByRole(table(root), "row")).toHaveLength(1);
    expect(cardNames(root)).toEqual([]);
  });

  it("the link works while loading and on an error", async () => {
    for (const answer of [() => new Promise<Response>(() => {}), () => json({ error: "unreachable" }, 502)]) {
      const { app, root } = await open("period=lastMonth&view=leftover", { answer });
      const length = history.length;
      const alt = leave(root);
      alt.focus();
      await click(app, alt);
      expect(location.hash).toBe("#period=lastMonth");
      expect(history.length).toBe(length);
      expect(queryByRole(root, "table", { name: da.leftOver.table })).toBeNull();
      expect(app.shadowRoot?.activeElement).toBe(getByRole(trail(root), "heading", { level: 1 }));
      unmount();
    }
  });

  it("when the months fail, the page's error card shows under the trail and the link still works", async () => {
    const { app, root } = await open("view=leftover", { leftOver: () => json({ error: "unreachable" }, 502) });
    expect(flat(getByRole(root, "alert"))).toBe(da.errors.unreachable);
    getByRole(root, "navigation", { name: da.trail });
    expect(queryByRole(root, "table", { name: da.leftOver.table })).toBeNull();
    expect(cardNames(root)).toEqual([]);
    await click(app, leave(root));
    expect(location.hash).toBe("");
    inOverview(root);
  });
});
