import { type Period, type Posting, type Subscription, unitAt } from "@ha-spending/shared";
import {
  fireEvent,
  getAllByRole,
  getByRole,
  getByText,
  getByTitle,
  queryAllByRole,
  queryByRole,
  queryByText,
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { barKr, kr, shortDate, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { fixedBarChart } from "./chart-mock";
import { answerFor, withSubscriptions } from "./fixture";
import { json, mount, type MountOptions, settle, unmount } from "./mount";

afterEach(unmount);

const TODAY = "2026-10-30";
const FIXED_CARD = da.inPeriod("Faste udgifter");
const SUBS_CARD = da.inPeriod("Abonnementer");
const OPEN = "#view=fixed&og=Faste+udgifter";

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

/** Paid through the fixture's Husleje postings, except March's. */
const HUSLEJE = bill("b1", "Husleje", {
  start: "2025-01-01",
  amountMin: 800000,
  amountMax: 800000,
  lastPayment: { date: "2026-10-01", amount: 800000, category: "Husleje", account: "1" },
});
/** Next due on 31 October, the day after today. */
const AVIS = bill("b2", "Avis", {
  start: "2026-01-31",
  amountMin: 20000,
  amountMax: 20000,
  lastPayment: { date: "2026-09-30", amount: 20000, category: "Husleje", account: "1" },
});
/** Due on 28 October and not yet seen, but within the days it may be late: Forfalden. */
const FORSIKRING = bill("b3", "Forsikring", {
  start: "2026-01-28",
  amountMin: 30000,
  amountMax: 30000,
  lastPayment: { date: "2026-09-28", amount: 30000, category: "Husleje", account: "1" },
});
/** Expected on 12 September and not seen. */
const TENNIS = bill("b4", "Tennis", {
  objectGroup: "Abonnementer",
  start: "2026-01-12",
  amountMin: 15000,
  amountMax: 15000,
  lastPayment: { date: "2026-08-12", amount: 15000, category: "Gaver", account: "1" },
});
const BILLS = [HUSLEJE, AVIS, FORSIKRING, TENNIS];

type Link = Posting["subscription"];

function husleje(p: Posting): Link {
  return p.text === "Husleje" && p.date !== "2026-03-01"
    ? { id: "b1", name: "Husleje", objectGroup: "Faste udgifter" }
    : null;
}

function answer(
  opts: {
    today?: string;
    bills?: Subscription[];
    links?: (p: Posting) => Link;
    earliest?: string;
    /** Made-up postings beside the fixture's, with their own links. */
    extra?: Posting[];
  } = {},
) {
  return (range: Period) => {
    const data = withSubscriptions(answerFor(range, opts.today ?? TODAY), opts.bills ?? BILLS);
    return json({
      ...data,
      earliestPostingDate: opts.earliest ?? data.earliestPostingDate,
      postings: [
        ...data.postings.map((p) => ({ ...p, subscription: (opts.links ?? husleje)(p) })),
        ...(opts.extra ?? []).filter((p) => p.date >= range.start && p.date <= range.end),
      ],
    });
  };
}

function open(hash: string, opts: MountOptions = {}) {
  return mount(hash, { answer: answer(), ...opts });
}

function month(start: string, today = TODAY): string {
  return unitName(unitAt(start, "month", today), "month", false);
}

function flat(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function trailText(root: HTMLElement): string {
  return flat(getByRole(root, "navigation", { name: da.trail }).textContent);
}

async function click(app: SpendingApp, el: HTMLElement): Promise<void> {
  fireEvent.click(el);
  await settle(app);
}

/** Lets Lit's updates run, which are microtasks, without letting a timer run. */
async function ticks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function hashBecomes(app: SpendingApp, hash: string): Promise<void> {
  await vi.waitFor(() => expect(location.hash).toBe(hash));
  await settle(app);
}

function link(root: HTMLElement, card: string): HTMLElement {
  return getByRole(getByRole(root, "group", { name: card }), "link", { name: da.showSubscriptions });
}

function back(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: da.backToOverview });
}

function barsRegion(root: HTMLElement, title = da.levelPer("Faste udgifter", "month")): HTMLElement {
  return getByRole(root, "region", { name: title });
}

function barNames(root: HTMLElement, title?: string): string[] {
  return getAllByRole(barsRegion(root, title), "button").map((b) => flat(b.textContent));
}

function listRegion(root: HTMLElement, title = da.fixed.inPeriod): HTMLElement {
  return getByRole(root, "region", { name: title });
}

/** The payment rows, not the header or a unit's group line. */
function dataRows(list: HTMLElement): HTMLElement[] {
  return getAllByRole(list, "row").filter((r) => queryAllByRole(r, "cell").length > 2);
}

async function openGroups(app: SpendingApp, root: HTMLElement, name: string): Promise<HTMLElement> {
  await click(app, getByRole(root, "button", { name: da.switchObjectGroup(name) }));
  return getByRole(root, "group", { name: da.objectGroups });
}

function inOverview(root: HTMLElement, g: "month" | "day" = "month"): void {
  getByRole(root, "region", { name: da.per(g) });
  expect(queryByRole(root, "button", { name: da.backToOverview })).toBeNull();
}

function inView(root: HTMLElement): void {
  back(root);
  expect(queryByRole(root, "region", { name: da.per("month") })).toBeNull();
}

describe("the way in and out (spec §2)", () => {
  it("the link under an object-group card opens the view on that group in one entry, and Back returns", async () => {
    const { app, root } = await open("group=Bolig");
    const length = history.length;
    await click(app, link(root, FIXED_CARD));
    expect(location.hash).toBe("#group=Bolig&view=fixed&og=Faste+udgifter");
    expect(history.length).toBe(length + 1);
    getByRole(root, "button", { name: da.switchObjectGroup("Faste udgifter") });
    getByRole(root, "button", { name: da.switchMainGroup("Bolig") });
    expect(queryByRole(root, "group", { name: da.inPeriod("Bolig") })).toBeNull();
    history.back();
    await hashBecomes(app, "#group=Bolig");
    getByRole(root, "region", { name: da.levelPer("Bolig", "month") });
  });

  it("← right after the open goes back, so Forward reopens the view", async () => {
    const { app, root } = await open("");
    await click(app, link(root, FIXED_CARD));
    const length = history.length;
    await click(app, back(root));
    await hashBecomes(app, "");
    expect(history.length).toBe(length);
    inOverview(root);
    history.forward();
    await hashBecomes(app, OPEN);
    inView(root);
  });

  it("after ← goes back, a further Back goes on past the open and does not reopen the view", async () => {
    const { app, root } = await open("");
    await click(app, getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
    await click(app, link(root, FIXED_CARD));
    expect(location.hash).toBe("#card=postings&view=fixed&og=Faste+udgifter");
    await click(app, back(root));
    await hashBecomes(app, "#card=postings");
    history.back();
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("the open puts the focus on the bars' heading, and ← and Escape put it on the right card's heading", async () => {
    const { app, root } = await open("");
    const active = () => app.shadowRoot?.activeElement;
    const right = () => getByRole(root, "heading", { level: 2, name: da.per("month") });
    await click(app, link(root, FIXED_CARD));
    expect(active()).toBe(getByRole(root, "heading", { level: 2, name: da.levelPer("Faste udgifter", "month") }));
    await click(app, back(root));
    await hashBecomes(app, "");
    expect(active()).toBe(right());
    await click(app, link(root, FIXED_CARD));
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "");
    expect(active()).toBe(right());
  });

  it("Escape right after the open goes back too", async () => {
    const { app, root } = await open("");
    await click(app, link(root, FIXED_CARD));
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "");
    inOverview(root);
    history.forward();
    await hashBecomes(app, OPEN);
  });

  it("Escape that closes the object-group list stays in the view", async () => {
    const { app, root } = await open(OPEN.slice(1));
    const list = await openGroups(app, root, "Faste udgifter");
    fireEvent.keyDown(getAllByRole(list, "button")[0], { key: "Escape" });
    await settle(app);
    expect(location.hash).toBe(OPEN);
    expect(queryByRole(root, "group", { name: da.objectGroups })).toBeNull();
    inView(root);
  });

  it("← after choosing another object group replaces, and Back lands on the first view entry", async () => {
    const { app, root } = await open("");
    await click(app, link(root, FIXED_CARD));
    const list = await openGroups(app, root, "Faste udgifter");
    await click(app, getByRole(list, "button", { name: /^Abonnementer,/ }));
    expect(location.hash).toBe("#view=fixed&og=Abonnementer");
    const length = history.length;
    await click(app, back(root));
    expect(location.hash).toBe("");
    expect(history.length).toBe(length);
    inOverview(root);
    history.back();
    await hashBecomes(app, OPEN);
  });

  it("← after choosing a unit from the trail's list replaces, and keeps a unit the overview has", async () => {
    const { app, root } = await open("");
    await click(app, link(root, FIXED_CARD));
    await click(app, getByRole(root, "button", { name: da.chooseMonth }));
    const units = getByRole(root, "group", { name: da.units });
    await click(app, getByRole(units, "button", { name: new RegExp(`^${month("2026-10-01")},`) }));
    expect(location.hash).toBe("#unit=2026-10-01&view=fixed&og=Faste+udgifter");
    const length = history.length;
    await click(app, back(root));
    expect(location.hash).toBe("#unit=2026-10-01");
    expect(history.length).toBe(length);
    inOverview(root);
  });

  it("waits for a pending Back: the link pressed meanwhile opens the view once it has landed", async () => {
    const { app, root } = await open("");
    await click(app, link(root, FIXED_CARD));
    const length = history.length;
    const backNow = history.back.bind(history);
    vi.spyOn(history, "back").mockImplementation(() => void setTimeout(backNow));
    fireEvent.click(back(root));
    await ticks();
    fireEvent.click(link(root, FIXED_CARD));
    await settle(app, 10);
    expect(location.hash).toBe(OPEN);
    expect(history.length).toBe(length);
    inView(root);
    backNow();
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("Escape twice while its Back is pending goes back once", async () => {
    const { app, root } = await open("");
    await click(app, getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
    await click(app, link(root, FIXED_CARD));
    const backNow = history.back.bind(history);
    const go = history.go.bind(history);
    vi.spyOn(history, "back").mockImplementation(() => void setTimeout(backNow));
    vi.spyOn(history, "go").mockImplementation((delta) => void setTimeout(() => go(delta)));
    fireEvent.keyDown(window, { key: "Escape" });
    await ticks();
    fireEvent.keyDown(window, { key: "Escape" });
    await settle(app, 10);
    expect(location.hash).toBe("#card=postings");
    getByRole(root, "region", { name: da.postingsTitle });
    expect(queryByRole(root, "button", { name: da.backToOverview })).toBeNull();
  });

  it("the ← sits outside the trail and has no text", async () => {
    const { root } = await open(OPEN.slice(1));
    expect(flat(back(root).textContent)).toBe("");
    const nav = getByRole(root, "navigation", { name: da.trail });
    expect(queryByRole(nav, "button", { name: da.backToOverview })).toBeNull();
  });

  it("the Faste udgifter tab's ⤢ still opens its table in full screen", async () => {
    const { app, root } = await open("card=subscriptions");
    await click(app, getByRole(root, "button", { name: da.fullScreen }));
    expect(location.hash).toBe("#card=subscriptions&view=full");
    getByRole(root, "region", { name: da.subscriptions });
  });

  it("view=fixed with no subscriptions shows the overview", async () => {
    const { root } = await mount("view=fixed&og=Faste%20udgifter");
    expect(location.hash).toBe("");
    inOverview(root);
  });
});

describe("loading and errors (spec §8)", () => {
  it("on an error shows the error line, and the period step and ← still work", async () => {
    const { app, root } = await open(OPEN.slice(1), { answer: () => json({ error: "unreachable" }, 502) });
    expect(getByRole(root, "alert").textContent).toContain(da.errors.unreachable);
    await click(app, getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    const periods = getByRole(root, "group", { name: da.period });
    await click(app, getByRole(periods, "button", { name: da.presets.lastYear }));
    expect(location.hash).toBe("#period=lastYear&view=fixed&og=Faste+udgifter");
    getByRole(root, "alert");
    await click(app, back(root));
    expect(location.hash).toBe("#period=lastYear");
    getByRole(root, "alert");
    expect(queryByRole(root, "button", { name: da.backToOverview })).toBeNull();
  });
});

describe("the trail (spec §3.1, §3.4)", () => {
  it("has the object group right after Alt forbrug", async () => {
    const { root } = await open(OPEN.slice(1));
    expect(trailText(root)).toBe(
      `${da.allSpending} › Faste udgifter › ${da.presets.thisYear} ${da.monthStep} ${da.mainGroupStep}`,
    );
  });

  it("in a main group", async () => {
    const { root } = await open("group=Bolig&view=fixed&og=Faste+udgifter");
    expect(trailText(root)).toBe(
      `${da.allSpending} › Faste udgifter › ${da.presets.thisYear} ${da.monthStep} › Bolig ${da.categoryStep}`,
    );
  });

  it("lists the object groups and Alle with their counts and sums, the chosen one marked", async () => {
    const { app, root } = await open(OPEN.slice(1));
    const list = await openGroups(app, root, "Faste udgifter");
    const rows = getAllByRole(list, "button");
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
      `Abonnementer, ${da.billsInPeriod(1, kr(0))}`,
      `Faste udgifter, ${da.billsInPeriod(3, kr(7200000))}`,
      `${da.all}, ${da.billsInPeriod(4, kr(7200000))}`,
    ]);
    expect(rows.map((r) => r.getAttribute("aria-current"))).toEqual([null, "true", null]);
    expect(getByRole(root, "button", { name: da.switchObjectGroup("Faste udgifter") }).hasAttribute("aria-haspopup")).toBe(
      false,
    );
  });

  it("choosing Alle shows Alle faste udgifter and removes a chosen unit", async () => {
    const { app, root } = await open("unit=2026-10-01&view=fixed&og=Faste+udgifter");
    const list = await openGroups(app, root, "Faste udgifter");
    await click(app, getByRole(list, "button", { name: new RegExp(`^${da.all},`) }));
    expect(location.hash).toBe("#view=fixed");
    getByRole(root, "button", { name: da.switchObjectGroup(da.allFixed) });
    barsRegion(root, da.levelPer(da.allFixed, "month"));
    expect(queryByRole(root, "button", { name: da.switchMonth(month("2026-10-01")) })).toBeNull();
  });

  it("with one object group the step is its title alone", async () => {
    const { root } = await open("view=fixed&og=Faste+udgifter", {
      answer: answer({ bills: [HUSLEJE, AVIS, FORSIKRING] }),
    });
    expect(location.hash).toBe("#view=fixed");
    expect(queryByRole(root, "button", { name: new RegExp(`^${da.switchObjectGroup("")}`) })).toBeNull();
    expect(trailText(root)).toBe(
      `${da.allSpending} › Faste udgifter › ${da.presets.thisYear} ${da.monthStep} ${da.mainGroupStep}`,
    );
    barsRegion(root);
  });

  it("an object group found only on postings opens from its card and reads 0 stk.", async () => {
    const pizza = (p: Posting): Link =>
      p.text === "MOBILEPAY 1234" && p.date === "2026-09-20"
        ? { id: "b7", name: "Pizzaabonnement", objectGroup: "Abonnementer" }
        : husleje(p);
    const { app, root } = await open("", { answer: answer({ bills: [HUSLEJE, AVIS], links: pizza }) });
    await click(app, link(root, SUBS_CARD));
    expect(location.hash).toBe("#view=fixed&og=Abonnementer");
    const list = await openGroups(app, root, "Abonnementer");
    getByRole(list, "button", { name: `Abonnementer, ${da.billsInPeriod(0, kr(70000))}` });
  });

  it("the view's unit list holds the view's units with its sums", async () => {
    const { app, root } = await open(OPEN.slice(1));
    await click(app, getByRole(root, "button", { name: da.chooseMonth }));
    const rows = getAllByRole(getByRole(root, "group", { name: da.units }), "button");
    expect(rows).toHaveLength(12);
    expect(rows[11].getAttribute("aria-label")).toBe(`${month("2026-12-01")}, ${da.fixed.estimated(kr(850000))}`);
    expect(rows[9].getAttribute("aria-label")).toBe(
      `${month("2026-10-01")}, ${da.fixed.sum(barKr(800000), kr(50000))}`,
    );
  });

  it("before the answer the view's dashed Måned is there but disabled, also in January", async () => {
    const { root } = await mount(OPEN.slice(1), { now: "2026-01-15T10:00:00Z", answer: () => new Promise(() => {}) });
    expect(getByRole(root, "button", { name: da.chooseMonth }).hasAttribute("disabled")).toBe(true);
    back(root);
  });
});

describe("the cards (spec §4)", () => {
  /** The card's label and value, and the start of the line under it. */
  function card(root: HTMLElement, label: string): string {
    return flat(getByRole(root, "group", { name: label }).textContent);
  }

  it("I år shows Thomas's four, the estimates marked ca., and Betalt i år as the overview's card", async () => {
    const { app, root } = await open("");
    expect(card(root, FIXED_CARD).startsWith(flat(`${FIXED_CARD} ${kr(7200000)} `))).toBe(true);
    await click(app, link(root, FIXED_CARD));
    const starts = (label: string, value: string) =>
      expect(card(root, label).startsWith(flat(`${label} ${value} `))).toBe(true);
    starts(da.fixed.paidThisYear, kr(7200000));
    starts(da.fixed.remaining, `${da.fixed.about} ${kr(1750000)}`);
    starts(da.fixed.estimateFor("2026"), `${da.fixed.about} ${kr(8950000)}`);
    starts(da.fixed.perMonthAverage, `${da.fixed.about} ${kr(8950000 / 12)}`);
    expect(queryByRole(root, "group", { name: da.spendingInPeriod })).toBeNull();
    expect(queryByText(root, /Dyreste|Billigste/)).toBeNull();
  });
});

describe("the bars (spec §5)", () => {
  it("I år draws twelve bar buttons named with their sums", async () => {
    const { root } = await open(OPEN.slice(1));
    const names = barNames(root);
    expect(names).toHaveLength(12);
    expect(names[0]).toBe(flat(da.fixed.barPaid(month("2026-01-01"), barKr(800000))));
    expect(names[2]).toBe(flat(da.fixed.barNone(month("2026-03-01"))));
    expect(names[9]).toBe(flat(da.fixed.barMixed(month("2026-10-01"), barKr(800000), kr(50000))));
    expect(names[11]).toBe(flat(da.fixed.barEstimate(month("2026-12-01"), kr(850000))));
  });

  it("in January, December can be chosen, and ← drops it so the overview has no unit step", async () => {
    const today = "2026-01-15";
    const { app, root } = await mount(OPEN.slice(1), { now: `${today}T10:00:00Z`, answer: answer({ today }) });
    const december = month("2026-12-01", today);
    const buttons = getAllByRole(barsRegion(root), "button");
    expect(buttons).toHaveLength(12);
    await click(app, buttons[11]);
    expect(location.hash).toBe("#unit=2026-12-01&view=fixed&og=Faste+udgifter");
    getByRole(root, "button", { name: da.switchMonth(december) });
    expect(getAllByRole(barsRegion(root), "button")[11].getAttribute("aria-pressed")).toBe("true");
    await click(app, back(root));
    expect(location.hash).toBe("");
    inOverview(root, "day");
    expect(queryByRole(root, "button", { name: da.chooseMonth })).toBeNull();
    expect(queryByRole(root, "button", { name: new RegExp(`^${da.switchMonth("")}`) })).toBeNull();
  });

  it("a December unit with I år is kept in the view and dropped when ← replaces", async () => {
    const { app, root } = await open("unit=2026-12-01&view=fixed&og=Faste+udgifter");
    expect(location.hash).toBe("#unit=2026-12-01&view=fixed&og=Faste+udgifter");
    listRegion(root, month("2026-12-01"));
    await click(app, back(root));
    expect(location.hash).toBe("");
  });

  it("Denne måned draws its days, and they are not buttons", async () => {
    const { root } = await open("period=thisMonth&view=fixed&og=Faste+udgifter");
    const region = barsRegion(root, da.levelPer("Faste udgifter", "day"));
    expect(queryAllByRole(region, "button")).toEqual([]);
    expect(getAllByRole(region, "listitem")).toHaveLength(31);
    expect(queryByRole(root, "button", { name: da.chooseMonth })).toBeNull();
  });

  it("Sidste år has no estimate", async () => {
    const { root } = await open("period=lastYear&view=fixed&og=Faste+udgifter");
    const region = barsRegion(root);
    expect(queryByText(region, da.fixed.hatched)).toBeNull();
    expect(barNames(root).some((n) => n.includes(da.fixed.allEstimates))).toBe(false);
  });

  it("the legend names the due outline when a bar has a due estimate, and only then", async () => {
    let { root } = await open(OPEN.slice(1));
    let region = barsRegion(root);
    getByText(region, da.fixed.hatched);
    getByText(region, da.fixed.dueOutline);
    unmount();
    ({ root } = await open("period=lastYear&view=fixed&og=Faste+udgifter"));
    region = barsRegion(root);
    expect(queryByText(region, da.fixed.hatched)).toBeNull();
    expect(queryByText(region, da.fixed.dueOutline)).toBeNull();
    unmount();
    ({ root } = await open(OPEN.slice(1), { answer: answer({ bills: [HUSLEJE, AVIS] }) }));
    region = barsRegion(root);
    getByText(region, da.fixed.hatched);
    expect(queryByText(region, da.fixed.dueOutline)).toBeNull();
  });

  it("the legend names the main groups, then the categories, then the fixed expenses, and the hatching", async () => {
    let { root } = await open("view=fixed");
    let region = barsRegion(root, da.levelPer(da.allFixed, "month"));
    getByText(region, "Bolig");
    getByText(region, da.noMainGroup);
    getByText(region, da.fixed.hatched);
    unmount();
    ({ root } = await open("group=Bolig&view=fixed"));
    region = barsRegion(root, da.levelPer(da.allFixed, "month"));
    getByText(region, "Husleje");
    expect(queryByText(region, "Bolig")).toBeNull();
    unmount();
    ({ root } = await open("group=Bolig&category=Husleje&view=fixed"));
    region = barsRegion(root, da.levelPer(da.allFixed, "month"));
    for (const name of ["Husleje", "Avis", "Forsikring"]) getByText(region, name);
  });

  it("a bar press chooses its unit, as the trail's step shows, and a second press removes it", async () => {
    const { app, root } = await open(OPEN.slice(1));
    const october = month("2026-10-01");
    await click(app, getAllByRole(barsRegion(root), "button")[9]);
    expect(location.hash).toBe("#unit=2026-10-01&view=fixed&og=Faste+udgifter");
    getByRole(root, "button", { name: da.switchMonth(october) });
    expect(getAllByRole(listRegion(root, october), "row")).toHaveLength(4);
    await click(app, getAllByRole(barsRegion(root), "button")[9]);
    expect(location.hash).toBe(OPEN);
  });
});

describe("the bars' keyboard highlight (D19)", () => {
  it("a focused bar button highlights every segment of its bar, and blur lets go", async () => {
    const { root } = await open(OPEN.slice(1));
    const buttons = getAllByRole(barsRegion(root), "button");
    const chart = fixedBarChart();
    // One part, Bolig: its paid series is 0, its due series 1 and its estimate series 2.
    for (const [i, series] of [
      [0, [0]],
      [9, [0, 1, 2]],
      [11, [2]],
    ] as const) {
      fireEvent.focus(buttons[i]);
      fireEvent.blur(buttons[i]);
      expect(chart.calls.highlight.at(-1)).toBe(i);
      expect(chart.series.highlight.at(-1)).toEqual(series);
      expect(chart.calls.downplay.at(-1)).toBe(i);
      expect(chart.series.downplay.at(-1)).toEqual(series);
    }
  });
});

describe("the bars' keyboard highlight, a fully due estimate", () => {
  it("names no estimate series when every estimate of the bar is due", async () => {
    const { root } = await open(OPEN.slice(1), { answer: answer({ bills: [HUSLEJE, FORSIKRING] }) });
    const buttons = getAllByRole(barsRegion(root), "button");
    const chart = fixedBarChart();
    fireEvent.focus(buttons[9]);
    expect(chart.series.highlight.at(-1)).toEqual([0, 1]);
  });
});

describe("the accounts and refunds (spec §5.3)", () => {
  /** Q8's July posting on Kreditkort, paid through Avis. */
  const viaCard = (p: Posting): Link =>
    p.text === "Q8" ? { id: "b2", name: "Avis", objectGroup: "Faste udgifter" } : husleje(p);

  function refund(date: string, amount: number): Posting {
    return {
      id: `r-${date}`,
      groupId: `rg-${date}`,
      date,
      text: "Husleje retur",
      account: "1",
      category: "Husleje",
      shop: null,
      kind: "refund",
      amount,
      subscription: { id: "b1", name: "Husleje", objectGroup: "Faste udgifter" },
    };
  }

  function paidThisYear(root: HTMLElement): string {
    return flat(getByRole(root, "group", { name: da.fixed.paidThisYear }).textContent);
  }

  it("one account narrows Betalt i år, the bars' names and the rows", async () => {
    const both = await open(OPEN.slice(1), { answer: answer({ links: viaCard }) });
    expect(barNames(both.root)[6]).toBe(flat(da.fixed.barPaid(month("2026-07-01"), barKr(890000))));
    unmount();
    const { root } = await open(`accounts=2&${OPEN.slice(1)}`, { answer: answer({ links: viaCard }) });
    expect(paidThisYear(root).startsWith(flat(`${da.fixed.paidThisYear} ${kr(90000)} `))).toBe(true);
    const names = barNames(root);
    expect(names[6]).toBe(flat(da.fixed.barPaid(month("2026-07-01"), barKr(90000))));
    expect(names[0]).toBe(flat(da.fixed.barNone(month("2026-01-01"))));
    expect(names[11]).toBe(flat(da.fixed.barNone(month("2026-12-01"))));
    const rows = getAllByRole(listRegion(root), "row").filter((r) => queryAllByRole(r, "cell").length > 2);
    expect(rows.map((r) => flat(queryAllByRole(r, "cell")[0].textContent))).toEqual([shortDate("2026-07-03", TODAY)]);
  });

  it("a refund linked to a bill lowers its unit's sum and shows in its row", async () => {
    const { root } = await open(OPEN.slice(1), {
      answer: answer({ extra: [refund("2026-07-20", -100000), refund("2026-03-20", -100000)] }),
    });
    expect(paidThisYear(root).startsWith(flat(`${da.fixed.paidThisYear} ${kr(7000000)} `))).toBe(true);
    const names = barNames(root);
    expect(names[6]).toBe(flat(da.fixed.barPaid(month("2026-07-01"), barKr(700000))));
    // March's Husleje is not linked, so its bar is the refund alone: below zero, as on the overview (D54).
    expect(names[2]).toBe(flat(da.fixed.barPaid(month("2026-03-01"), barKr(-100000))));
    const cells = getAllByRole(listRegion(root), "row").map((r) =>
      queryAllByRole(r, "cell").map((c) => flat(c.textContent)),
    );
    const row = cells.find((c) => c[0] === shortDate("2026-07-20", TODAY));
    expect(row?.slice(3)).toEqual([flat(barKr(-100000)), da.fixed.status.paid]);
  });
});

describe("the payments (spec §6)", () => {
  it("groups the units newest first, with their counts and sums, under the period's sum line", async () => {
    const { root } = await open(OPEN.slice(1));
    const list = listRegion(root);
    const summary = [
      da.fixed.payments(17),
      da.fixed.summaryPaid(barKr(7200000)),
      da.fixed.summaryEstimate(kr(1750000)),
      da.fixed.summaryTotal(kr(8950000)),
    ].join(" · ");
    expect(flat(list.textContent)).toContain(flat(summary));
    const text = flat(list.textContent);
    const order = ["2026-12-01", "2026-11-01", "2026-10-01", "2026-09-01", "2026-01-01"].map((m) =>
      text.indexOf(`${month(m)}${da.fixed.payments(m >= "2026-10-01" ? 3 : 1)}`),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).not.toContain(`${month("2026-03-01")}${da.fixed.payments(1)}`);
    expect(text).toContain(flat(`${da.fixed.payments(3)} · ${da.inProgress}`));
    expect(text).toContain(flat(`${da.fixed.payments(3)} · ${da.fixed.allEstimates}`));
    expect(text).toContain(flat(da.fixed.sum(barKr(800000), kr(50000))));
  });

  it("writes each kind's date, amount and status", async () => {
    const { root } = await open("view=fixed");
    const cells = getAllByRole(listRegion(root), "row").map((r) =>
      queryAllByRole(r, "cell").map((c) => flat(c.textContent)),
    );
    const row = (date: string, name: string) => cells.find((c) => c[0] === date && c[1].startsWith(name));
    expect(row(shortDate("2026-10-01", TODAY), "Husleje")?.slice(2)).toEqual(["Husleje", flat(barKr(800000)), da.fixed.status.paid]);
    expect(row(shortDate("2026-10-31", TODAY), "Avis")?.slice(3)).toEqual([flat(da.fixed.estimated(kr(20000))), da.fixed.status.expected]);
    expect(row(shortDate("2026-10-28", TODAY), "Forsikring")?.slice(3)).toEqual([
      flat(da.fixed.estimated(kr(30000))),
      da.fixed.status.due,
    ]);
    expect(row(shortDate("2026-09-12", TODAY), "Tennis")?.slice(2)).toEqual(["Gaver", da.none, da.fixed.status.notSeen]);
    expect(cells.filter((c) => c[1]?.startsWith("Tennis") && c[0] === shortDate("2026-10-12", TODAY))).toEqual([]);
  });

  it("Alt by År has one row per fixed expense", async () => {
    const { root } = await open("period=all&view=fixed&og=Faste+udgifter", {
      answer: answer({ earliest: "2023-01-01" }),
    });
    const list = listRegion(root);
    expect(queryByRole(list, "columnheader", { name: da.fixed.dateColumn })).toBeNull();
    const text = flat(list.textContent);
    expect(text).toContain(`${da.fixed.payments(11)} · ${da.fixed.ofWhichEstimates(2, shortDate("2026-11-01", TODAY))}`);
  });

  it("with one object group chosen, no row has the object group's badge in its name", async () => {
    const { root } = await open(OPEN.slice(1));
    const names = dataRows(listRegion(root)).map((r) => flat(queryAllByRole(r, "cell")[1].textContent));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).not.toContain("Faste udgifter");
  });

  it("with Alle, a row's name has no badge and names its object group in its tooltip", async () => {
    const { root } = await open("view=fixed");
    const husleje = dataRows(listRegion(root))
      .map((r) => queryAllByRole(r, "cell")[1])
      .filter((c) => flat(c.textContent).startsWith("Husleje"));
    expect(husleje.length).toBeGreaterThan(0);
    for (const cell of husleje) {
      expect(flat(cell.textContent)).toBe("Husleje");
      getByTitle(cell, "Husleje · Faste udgifter");
    }
  });

  it("Alt by År with Alle starts each row's line with its object group", async () => {
    const { root } = await open("period=all&view=fixed", { answer: answer({ earliest: "2023-01-01" }) });
    const groupOf = new Map(BILLS.map((b) => [b.name, b.objectGroup]));
    const names = dataRows(listRegion(root)).map((r) => flat(queryAllByRole(r, "cell")[0].textContent));
    expect(names.length).toBeGreaterThan(0);
    for (const text of names) {
      const name = [...groupOf.keys()].find((n) => text.startsWith(`${n} `));
      expect(name, text).toBeDefined();
      expect(text.startsWith(`${name} ${groupOf.get(name ?? "")} · `), text).toBe(true);
    }
  });

  it("has a Kategori column at Alt forbrug and in a main group, and none in a category", async () => {
    const { root } = await open(OPEN.slice(1));
    getByRole(listRegion(root), "columnheader", { name: da.subscriptionColumns.category });
    unmount();
    const inCategory = await open("group=Bolig&category=Husleje&view=fixed&og=Faste+udgifter");
    expect(
      queryByRole(listRegion(inCategory.root), "columnheader", { name: da.subscriptionColumns.category }),
    ).toBeNull();
  });

  it("says so when the level has no fixed expenses", async () => {
    const { root } = await open("group=Bil&view=fixed&og=Faste+udgifter");
    getByText(listRegion(root), da.fixed.empty("Bil"));
  });
});
