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
  queryByTitle,
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

/** The trail's "Alt forbrug", which in the view leaves it. */
function leave(root: HTMLElement): HTMLElement {
  return getByRole(getByRole(root, "navigation", { name: da.trail }), "link", { name: da.allSpending });
}

/** The view's list card, under either tab's name. */
function notInView(root: HTMLElement): void {
  expect(queryByRole(root, "region", { name: da.fixed.inPeriod })).toBeNull();
  expect(queryByRole(root, "region", { name: da.allFixed })).toBeNull();
}

function barsRegion(root: HTMLElement, title = da.levelPer("Faste udgifter", "month")): HTMLElement {
  return getByRole(root, "region", { name: title });
}

/** The bars' own buttons, in their list, not the card's full-screen button. */
function barButtons(root: HTMLElement, title?: string): HTMLElement[] {
  return getAllByRole(getByRole(barsRegion(root, title), "list"), "button");
}

function barNames(root: HTMLElement, title?: string): string[] {
  return barButtons(root, title).map((b) => flat(b.textContent));
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
  notInView(root);
}

function inView(root: HTMLElement): void {
  leave(root);
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

  it("the link right after the open goes back, so Forward reopens the page", async () => {
    const { app, root } = await open("");
    await click(app, link(root, FIXED_CARD));
    const length = history.length;
    await click(app, leave(root));
    await hashBecomes(app, "");
    expect(history.length).toBe(length);
    inOverview(root);
    history.forward();
    await hashBecomes(app, OPEN);
    inView(root);
  });

  it("after the link goes back, a further Back goes on past the open and does not reopen the view", async () => {
    const { app, root } = await open("");
    await click(app, getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
    await click(app, link(root, FIXED_CARD));
    expect(location.hash).toBe("#card=postings&view=fixed&og=Faste+udgifter");
    await click(app, leave(root));
    await hashBecomes(app, "#card=postings");
    history.back();
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("the open puts the focus on the bars' heading, and the link and Escape put it on the right card's heading", async () => {
    const { app, root } = await open("");
    const active = () => app.shadowRoot?.activeElement;
    const right = () => getByRole(root, "heading", { level: 2, name: da.per("month") });
    await click(app, link(root, FIXED_CARD));
    expect(active()).toBe(getByRole(root, "heading", { level: 2, name: da.levelPer("Faste udgifter", "month") }));
    await click(app, leave(root));
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

  it("the link after another choice replaces, and Back lands on the first view entry", async () => {
    const { app, root } = await open("");
    await click(app, link(root, FIXED_CARD));
    const list = await openGroups(app, root, "Faste udgifter");
    await click(app, getByRole(list, "button", { name: /^Abonnementer,/ }));
    expect(location.hash).toBe("#view=fixed&og=Abonnementer");
    const length = history.length;
    await click(app, leave(root));
    expect(location.hash).toBe("");
    expect(history.length).toBe(length);
    inOverview(root);
    history.back();
    await hashBecomes(app, OPEN);
  });

  it("the link after choosing a unit from the trail's list replaces, and keeps a unit the overview has", async () => {
    const { app, root } = await open("");
    await click(app, link(root, FIXED_CARD));
    await click(app, getByRole(root, "button", { name: da.chooseMonth }));
    const units = getByRole(root, "group", { name: da.units });
    await click(app, getByRole(units, "button", { name: new RegExp(`^${month("2026-10-01")},`) }));
    expect(location.hash).toBe("#unit=2026-10-01&view=fixed&og=Faste+udgifter");
    const length = history.length;
    await click(app, leave(root));
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
    fireEvent.click(leave(root));
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
    notInView(root);
  });


  it("view=fixed with no subscriptions shows the overview, not in full screen", async () => {
    const { root } = await mount("view=fixed&og=Faste%20udgifter&full=list");
    expect(location.hash).toBe("");
    inOverview(root);
    getByRole(root, "region", { name: da.mainGroups });
    expect(getByRole(root, "button", { name: da.fullScreen }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("the top bar (fixed-list-tab spec §6)", () => {
  async function fromOverview(start = "") {
    const opened = await open(start);
    await click(opened.app, link(opened.root, FIXED_CARD));
    return opened;
  }

  function postingsTab(root: HTMLElement): HTMLElement {
    return getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings });
  }

  it("has no Tilbage til overblikket button and has an Alt forbrug link", async () => {
    const { root } = await open(OPEN.slice(1));
    expect(queryByRole(root, "button", { name: "Tilbage til overblikket" })).toBeNull();
    expect(leave(root).tagName).toBe("A");
  });

  it("the link's href is the overview's hash", async () => {
    const { root } = await open("group=Bolig&card=postings&view=fixed&og=Faste+udgifter&tab=all&full=list&detail=s%3Ab1");
    expect(leave(root).getAttribute("href")).toBe("#group=Bolig&card=postings");
    expect(fireEvent.click(leave(root), { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(leave(root), { button: 1 })).toBe(true);
  });

  it("the link with a detail open over full screen leaves the view in one click, and Back lands before the view", async () => {
    const { app, root } = await open("");
    await click(app, postingsTab(root));
    await click(app, link(root, FIXED_CARD));
    await click(app, getByRole(root, "button", { name: da.fullScreenOf(da.fixed.inPeriod) }));
    await click(app, getByRole(getByRole(listRegion(root), "group", { name: da.view }), "button", { name: da.allFixed }));
    await click(app, getByRole(listRegion(root, da.allFixed), "button", { name: "Husleje" }));
    expect(location.hash).toBe("#card=postings&view=fixed&og=Faste+udgifter&tab=all&full=list&detail=s%3Ab1");
    await click(app, leave(root));
    await hashBecomes(app, "#card=postings");
    getByRole(root, "region", { name: da.postingsTitle });
    notInView(root);
    history.back();
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("the link with a detail open in the view leaves it in one click, and Back lands before the view", async () => {
    const { app, root } = await open("");
    await click(app, postingsTab(root));
    await click(app, link(root, FIXED_CARD));
    await click(app, getByRole(getByRole(listRegion(root), "group", { name: da.view }), "button", { name: da.allFixed }));
    await click(app, getByRole(listRegion(root, da.allFixed), "button", { name: "Husleje" }));
    expect(location.hash).toBe("#card=postings&view=fixed&og=Faste+udgifter&tab=all&detail=s%3Ab1");
    await click(app, leave(root));
    await hashBecomes(app, "#card=postings");
    notInView(root);
    history.back();
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("after the link the focus is on the overview's heading, also with group=Bolig, where Alt forbrug stays a link", async () => {
    for (const [start, title] of [
      ["", da.per("month")],
      ["group=Bolig", da.levelPer("Bolig", "month")],
    ]) {
      const { app, root } = await fromOverview(start);
      const alt = leave(root);
      alt.focus();
      await click(app, alt);
      await hashBecomes(app, start === "" ? "" : `#${start}`);
      expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: title }));
      if (start !== "") leave(root);
      unmount();
    }
  });

  it("the link works while loading and on an error", async () => {
    for (const answer of [() => new Promise<Response>(() => {}), () => json({ error: "unreachable" }, 502)]) {
      const { app, root } = await open(`period=lastYear&${OPEN.slice(1)}`, { answer });
      const length = history.length;
      const alt = leave(root);
      alt.focus();
      await click(app, alt);
      expect(location.hash).toBe("#period=lastYear");
      expect(history.length).toBe(length);
      expect(app.shadowRoot?.activeElement).toBe(
        getByRole(getByRole(root, "navigation", { name: da.trail }), "heading", { level: 1 }),
      );
      unmount();
    }
  });
});

describe("loading and errors (spec §8)", () => {
  it("on an error shows the error line, and the period step and the link still work", async () => {
    const { app, root } = await open(OPEN.slice(1), { answer: () => json({ error: "unreachable" }, 502) });
    expect(getByRole(root, "alert").textContent).toContain(da.errors.unreachable);
    await click(app, getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    const periods = getByRole(root, "group", { name: da.period });
    await click(app, getByRole(periods, "button", { name: da.presets.lastYear }));
    expect(location.hash).toBe("#period=lastYear&view=fixed&og=Faste+udgifter");
    getByRole(root, "alert");
    await click(app, leave(root));
    expect(location.hash).toBe("#period=lastYear");
    getByRole(root, "alert");
    notInView(root);
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

  it("an object group found only on postings opens from its card, with no stk. on the card and 0 stk. in the step", async () => {
    const pizza = (p: Posting): Link =>
      p.text === "MOBILEPAY 1234" && p.date === "2026-09-20"
        ? { id: "b7", name: "Pizzaabonnement", objectGroup: "Abonnementer" }
        : husleje(p);
    const { app, root } = await open("", { answer: answer({ bills: [HUSLEJE, AVIS], links: pizza }) });
    expect(getByRole(root, "group", { name: SUBS_CARD }).textContent).not.toContain(da.billCount(0).replace(/^0 /, ""));
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
    leave(root);
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

  it("in January, December can be chosen, and the link drops it so the overview has no unit step", async () => {
    const today = "2026-01-15";
    const { app, root } = await mount(OPEN.slice(1), { now: `${today}T10:00:00Z`, answer: answer({ today }) });
    const december = month("2026-12-01", today);
    const buttons = barButtons(root);
    expect(buttons).toHaveLength(12);
    await click(app, buttons[11]);
    expect(location.hash).toBe("#unit=2026-12-01&view=fixed&og=Faste+udgifter");
    getByRole(root, "button", { name: da.switchMonth(december) });
    expect(barButtons(root)[11].getAttribute("aria-pressed")).toBe("true");
    await click(app, leave(root));
    expect(location.hash).toBe("");
    inOverview(root, "day");
    expect(queryByRole(root, "button", { name: da.chooseMonth })).toBeNull();
    expect(queryByRole(root, "button", { name: new RegExp(`^${da.switchMonth("")}`) })).toBeNull();
  });

  it("a December unit with I år is kept in the view and dropped when the link replaces", async () => {
    const { app, root } = await open("unit=2026-12-01&view=fixed&og=Faste+udgifter");
    expect(location.hash).toBe("#unit=2026-12-01&view=fixed&og=Faste+udgifter");
    listRegion(root, month("2026-12-01"));
    await click(app, leave(root));
    expect(location.hash).toBe("");
  });

  it("Denne måned draws its days, and they are not buttons", async () => {
    const { root } = await open("period=thisMonth&view=fixed&og=Faste+udgifter");
    const region = barsRegion(root, da.levelPer("Faste udgifter", "day"));
    expect(queryAllByRole(getByRole(region, "list"), "button")).toEqual([]);
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
    await click(app, barButtons(root)[9]);
    expect(location.hash).toBe("#unit=2026-10-01&view=fixed&og=Faste+udgifter");
    getByRole(root, "button", { name: da.switchMonth(october) });
    expect(getAllByRole(listRegion(root, october), "row")).toHaveLength(4);
    await click(app, barButtons(root)[9]);
    expect(location.hash).toBe(OPEN);
  });
});

describe("the bars' keyboard highlight (D19)", () => {
  it("a focused bar button highlights every segment of its bar, and blur lets go", async () => {
    const { root } = await open(OPEN.slice(1));
    const buttons = barButtons(root);
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
    const buttons = barButtons(root);
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

  it("with no og and one object group in the answer, a row's name tooltip is the name alone", async () => {
    const { root } = await open("view=fixed", { answer: answer({ bills: [HUSLEJE, AVIS, FORSIKRING] }) });
    const husleje = dataRows(listRegion(root))
      .map((r) => queryAllByRole(r, "cell")[1])
      .filter((c) => flat(c.textContent).startsWith("Husleje"));
    expect(husleje.length).toBeGreaterThan(0);
    for (const cell of husleje) {
      getByTitle(cell, "Husleje");
      expect(queryByTitle(cell, da.fixed.nameInGroup("Husleje", "Faste udgifter"))).toBeNull();
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

describe("full screen (spec §3)", () => {
  const BARS = da.levelPer("Faste udgifter", "month");
  const FULL_BARS = `${OPEN}&full=bars`;
  const FULL_LIST = `${OPEN}&full=list`;

  function fullButton(root: HTMLElement, title: string): HTMLElement {
    return getByRole(root, "button", { name: da.fullScreenOf(title) });
  }

  function keyNumbers(root: HTMLElement): HTMLElement | null {
    return queryByRole(root, "group", { name: da.fixed.paidThisYear });
  }

  async function press(app: SpendingApp, button: HTMLElement): Promise<HTMLElement> {
    button.focus();
    await click(app, button);
    return button;
  }

  function bothCards(root: HTMLElement): void {
    barsRegion(root);
    listRegion(root);
    expect(keyNumbers(root)).not.toBeNull();
    expect(fullButton(root, BARS).getAttribute("aria-pressed")).toBe("false");
    expect(fullButton(root, da.fixed.inPeriod).getAttribute("aria-pressed")).toBe("false");
  }

  function barsAlone(root: HTMLElement, listTitle: string = da.fixed.inPeriod): void {
    barsRegion(root);
    expect(queryByRole(root, "region", { name: listTitle })).toBeNull();
    expect(keyNumbers(root)).toBeNull();
    expect(fullButton(root, BARS).getAttribute("aria-pressed")).toBe("true");
  }

  function listAlone(root: HTMLElement, title: string = da.fixed.inPeriod): void {
    listRegion(root, title);
    expect(queryByRole(root, "region", { name: BARS })).toBeNull();
    expect(keyNumbers(root)).toBeNull();
    expect(fullButton(root, title).getAttribute("aria-pressed")).toBe("true");
  }

  /** Opens the view by its link from the overview, so its entry has the open's mark. */
  async function fromOverview(start = "") {
    const opened = await open(start);
    await click(opened.app, link(opened.root, FIXED_CARD));
    return opened;
  }

  describe("the buttons and what they show (§3.1, §3.2)", () => {
    it("each card has its button, named after the card, not pressed", async () => {
      const { root } = await open(OPEN.slice(1));
      bothCards(root);
      getByRole(barsRegion(root), "button", { name: da.fullScreenOf(BARS) });
      getByRole(listRegion(root), "button", { name: da.fullScreenOf(da.fixed.inPeriod) });
    });

    it("the bars' button shows the bars alone, and a second press brings both cards back", async () => {
      const { app, root } = await open(OPEN.slice(1));
      await click(app, fullButton(root, BARS));
      expect(location.hash).toBe(FULL_BARS);
      barsAlone(root);
      await click(app, fullButton(root, BARS));
      expect(location.hash).toBe(OPEN);
      bothCards(root);
    });

    it("the list's button shows the list alone, and a second press brings both cards back", async () => {
      const { app, root } = await open(OPEN.slice(1));
      await click(app, fullButton(root, da.fixed.inPeriod));
      expect(location.hash).toBe(FULL_LIST);
      listAlone(root);
      await click(app, fullButton(root, da.fixed.inPeriod));
      expect(location.hash).toBe(OPEN);
      bothCards(root);
    });

    it("the buttons are there when the list shows its empty text", async () => {
      const { root } = await open("group=Bil&view=fixed&og=Faste+udgifter");
      getByText(listRegion(root), da.fixed.empty("Bil"));
      fullButton(root, da.levelPer("Faste udgifter", "month"));
      fullButton(root, da.fixed.inPeriod);
    });

    it("a bar press in full screen chooses the unit, and the bars stay alone", async () => {
      const { app, root } = await open(FULL_BARS.slice(1));
      await click(app, barButtons(root)[9]);
      expect(location.hash).toBe("#unit=2026-10-01&view=fixed&og=Faste+udgifter&full=bars");
      getByRole(root, "button", { name: da.switchMonth(month("2026-10-01")) });
      barsAlone(root, month("2026-10-01"));
    });

    it("in the list's full screen, a unit from the trail's list narrows the list, and full screen stays", async () => {
      const { app, root } = await open(FULL_LIST.slice(1));
      const october = month("2026-10-01");
      await click(app, getByRole(root, "button", { name: da.chooseMonth }));
      const units = getByRole(root, "group", { name: da.units });
      await click(app, getByRole(units, "button", { name: new RegExp(`^${october},`) }));
      expect(location.hash).toBe("#unit=2026-10-01&view=fixed&og=Faste+udgifter&full=list");
      listAlone(root, october);
      expect(getAllByRole(listRegion(root, october), "row")).toHaveLength(4);
    });
  });

  describe("the list in full screen (§3.3)", () => {
    it("has the object group's badge on its rows", async () => {
      const { root } = await open(FULL_LIST.slice(1));
      const rows = dataRows(listRegion(root));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) getByText(queryAllByRole(row, "cell")[1], "Faste udgifter");
    });
  });

  describe("the hash (§3.4)", () => {
    it("a load with full=list opens the list in full screen and leaves the focus alone", async () => {
      const { app, root } = await open(FULL_LIST.slice(1));
      expect(location.hash).toBe(FULL_LIST);
      listAlone(root);
      expect(app.shadowRoot?.activeElement ?? null).toBeNull();
    });

    it("leaving the view by the link drops full", async () => {
      const { app, root } = await open(FULL_BARS.slice(1));
      await click(app, leave(root));
      expect(location.hash).toBe("");
      inOverview(root);
      expect(getByRole(root, "button", { name: da.fullScreen }).getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("history, Escape and the link (§3.5)", () => {
    it("open, then Back, closes full screen and stays in the view", async () => {
      const { app, root } = await open(OPEN.slice(1));
      await click(app, fullButton(root, BARS));
      history.back();
      await hashBecomes(app, OPEN);
      bothCards(root);
    });

    it("open, then the button's close, then Back: full screen does not reopen, and Back leaves the view", async () => {
      const { app, root } = await fromOverview();
      const length = history.length;
      await click(app, fullButton(root, da.fixed.inPeriod));
      await click(app, fullButton(root, da.fixed.inPeriod));
      await hashBecomes(app, OPEN);
      expect(history.length).toBe(length + 1);
      bothCards(root);
      history.back();
      await hashBecomes(app, "");
      inOverview(root);
    });

    it("Escape closes full screen, and a second Escape leaves the view", async () => {
      const { app, root } = await fromOverview();
      await click(app, fullButton(root, BARS));
      fireEvent.keyDown(window, { key: "Escape" });
      await hashBecomes(app, OPEN);
      bothCards(root);
      fireEvent.keyDown(window, { key: "Escape" });
      await hashBecomes(app, "");
      inOverview(root);
    });

    it("with the trail's list open, the first Escape closes the list, and full screen stays", async () => {
      const { app, root } = await open(FULL_LIST.slice(1));
      const list = await openGroups(app, root, "Faste udgifter");
      fireEvent.keyDown(getAllByRole(list, "button")[0], { key: "Escape" });
      await settle(app);
      expect(queryByRole(root, "group", { name: da.objectGroups })).toBeNull();
      expect(location.hash).toBe(FULL_LIST);
      listAlone(root);
    });

    it("the link right after the view's open and full screen's open leaves the view, and Back does not reopen it", async () => {
      const { app, root } = await open("");
      await click(app, getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
      await click(app, link(root, FIXED_CARD));
      await click(app, fullButton(root, BARS));
      expect(location.hash).toBe("#card=postings&view=fixed&og=Faste+udgifter&full=bars");
      await click(app, leave(root));
      await hashBecomes(app, "#card=postings");
      getByRole(root, "region", { name: da.postingsTitle });
      history.back();
      await hashBecomes(app, "");
      inOverview(root);
    });

    it("a unit chosen in full screen, then Escape: the normal cards with the unit; Back lands in full screen without it", async () => {
      const { app, root } = await fromOverview();
      await click(app, fullButton(root, BARS));
      await click(app, barButtons(root)[9]);
      fireEvent.keyDown(window, { key: "Escape" });
      await settle(app);
      expect(location.hash).toBe("#unit=2026-10-01&view=fixed&og=Faste+udgifter");
      listRegion(root, month("2026-10-01"));
      barsRegion(root);
      expect(keyNumbers(root)).not.toBeNull();
      history.back();
      await hashBecomes(app, FULL_BARS);
      barsAlone(root);
    });

    it("a unit chosen in full screen, then the link: the overview; Back lands in full screen without it", async () => {
      const { app, root } = await fromOverview();
      await click(app, fullButton(root, BARS));
      await click(app, barButtons(root)[9]);
      await click(app, leave(root));
      expect(location.hash).toBe("#unit=2026-10-01");
      notInView(root);
      history.back();
      await hashBecomes(app, FULL_BARS);
      barsAlone(root);
    });

    it("the focus stays on the button after open and after close", async () => {
      const { app, root } = await fromOverview();
      const active = () => app.shadowRoot?.activeElement;
      const button = await press(app, fullButton(root, da.fixed.inPeriod));
      expect(active()).toBe(button);
      await click(app, button);
      await hashBecomes(app, OPEN);
      expect(fullButton(root, da.fixed.inPeriod)).toBe(button);
      expect(active()).toBe(button);
    });

    it("Escape from the list's full screen with the focus on its scroll region keeps the focus there", async () => {
      const { app, root } = await fromOverview();
      await click(app, fullButton(root, da.fixed.inPeriod));
      const scroll = getByRole(listRegion(root), "group", { name: da.fixed.inPeriod });
      scroll.focus();
      fireEvent.keyDown(window, { key: "Escape" });
      await hashBecomes(app, OPEN);
      bothCards(root);
      expect(app.shadowRoot?.activeElement).toBe(scroll);
    });

    it("a close by the button with the focus lost puts it on the heading of the list that filled the page", async () => {
      const { app, root } = await fromOverview();
      await click(app, fullButton(root, da.fixed.inPeriod));
      (app.shadowRoot?.activeElement as HTMLElement | null)?.blur();
      await click(app, fullButton(root, da.fixed.inPeriod));
      await hashBecomes(app, OPEN);
      bothCards(root);
      expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: da.fixed.inPeriod }));
    });

    it("a close by Back with the focus lost puts it on the heading of the list that filled the page", async () => {
      const { app, root } = await fromOverview();
      await click(app, fullButton(root, da.fixed.inPeriod));
      (app.shadowRoot?.activeElement as HTMLElement | null)?.blur();
      history.back();
      await hashBecomes(app, OPEN);
      bothCards(root);
      expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: da.fixed.inPeriod }));
    });

    it("the focus in the list, then Forward onto the bars' full screen: the focus is on the bars' heading", async () => {
      const { app, root } = await fromOverview();
      await click(app, fullButton(root, BARS));
      history.back();
      await hashBecomes(app, OPEN);
      getByRole(listRegion(root), "group", { name: da.fixed.inPeriod }).focus();
      history.forward();
      await hashBecomes(app, FULL_BARS);
      barsAlone(root);
      expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: BARS }));
    });

    it("Forward onto the list's full screen from the overview puts the focus on the list's heading", async () => {
      const { app, root } = await fromOverview();
      await click(app, fullButton(root, da.fixed.inPeriod));
      history.go(-2);
      await hashBecomes(app, "");
      history.go(2);
      await hashBecomes(app, FULL_LIST);
      listAlone(root);
      expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: da.fixed.inPeriod }));
    });
  });

  describe("loading and errors (§3.7)", () => {
    it("while loading with full=bars there is one placeholder region and no key numbers", async () => {
      const { root } = await open(FULL_BARS.slice(1), { answer: () => new Promise(() => {}) });
      const busy = getAllByRole(root, "region", { name: da.loading });
      expect(busy).toHaveLength(1);
      expect(busy[0].getAttribute("aria-busy")).toBe("true");
      expect(queryAllByRole(root, "group", { name: da.loading })).toEqual([]);
    });

    it("on an error shows the error line and no full-screen button", async () => {
      const { root } = await open(FULL_LIST.slice(1), { answer: () => json({ error: "unreachable" }, 502) });
      expect(getByRole(root, "alert").textContent).toContain(da.errors.unreachable);
      expect(queryByRole(root, "button", { name: new RegExp(`^${da.fullScreenOf("")}`) })).toBeNull();
    });
  });
});

describe("the Alle faste udgifter tab (spec §3)", () => {
  const ALL = `${OPEN}&tab=all`;
  /** Ended on 31 May: it ran in I år and in May, and not in June. */
  const ENDED = bill("b5", "Ugeblad", {
    start: "2025-01-15",
    end: "2026-05-31",
    amountMin: 5000,
    amountMax: 5000,
    lastPayment: { date: "2026-05-15", amount: 5000, category: "Husleje", account: "1" },
  });

  function tabs(root: HTMLElement, title = da.fixed.inPeriod): HTMLElement {
    return getByRole(listRegion(root, title), "group", { name: da.view });
  }

  function tab(root: HTMLElement, name: string, title?: string): HTMLElement {
    return getByRole(tabs(root, title), "button", { name });
  }

  function pressedTab(root: HTMLElement, title?: string): string[] {
    return getAllByRole(tabs(root, title), "button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => flat(b.textContent));
  }

  function detail(root: HTMLElement, name: string): HTMLElement | null {
    return queryByRole(root, "group", { name });
  }

  async function fromOverview(opts: MountOptions = {}) {
    const opened = await open("", opts);
    await click(opened.app, link(opened.root, FIXED_CARD));
    expect(location.hash).toBe(OPEN);
    return opened;
  }

  async function toAll(app: SpendingApp, root: HTMLElement, title?: string): Promise<void> {
    await click(app, tab(root, da.allFixed, title));
  }

  it("the card has the tabs Poster i perioden and Alle faste udgifter, Poster i perioden pressed", async () => {
    const { root } = await open(OPEN.slice(1));
    const buttons = getAllByRole(tabs(root), "button");
    expect(buttons.map((b) => flat(b.textContent))).toEqual([da.fixed.inPeriod, da.allFixed]);
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
  });

  it("the heading and the full-screen button's name follow the open tab", async () => {
    const { app, root } = await open(OPEN.slice(1));
    getByRole(listRegion(root), "heading", { level: 2, name: da.fixed.inPeriod });
    await toAll(app, root);
    const region = listRegion(root, da.allFixed);
    getByRole(region, "heading", { level: 2, name: da.allFixed });
    getByRole(region, "button", { name: da.fullScreenOf(da.allFixed) });
    expect(queryByRole(root, "region", { name: da.fixed.inPeriod })).toBeNull();
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    getByRole(region, "button", { name: "Husleje" });
  });

  it("a tab press writes tab=all after og and replaces the entry, so Escape then leaves the view in one step and Back lands before it", async () => {
    const { app, root } = await fromOverview();
    const length = history.length;
    await toAll(app, root);
    expect(location.hash).toBe(ALL);
    expect(history.length).toBe(length);
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "");
    inOverview(root);
    history.forward();
    await hashBecomes(app, ALL);
    listRegion(root, da.allFixed);
    history.back();
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("the tab stays when the object group, the period, the unit or the level changes, and in full screen", async () => {
    const { app, root } = await fromOverview();
    await toAll(app, root);
    const groups = await openGroups(app, root, "Faste udgifter");
    await click(app, getByRole(groups, "button", { name: /^Abonnementer,/ }));
    expect(location.hash).toBe("#view=fixed&og=Abonnementer&tab=all");
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    await click(app, barButtons(root, da.levelPer("Abonnementer", "month"))[9]);
    expect(location.hash).toBe("#unit=2026-10-01&view=fixed&og=Abonnementer&tab=all");
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    await click(app, getByRole(root, "button", { name: da.chooseMainGroup }));
    await click(app, getByRole(getByRole(root, "group", { name: da.mainGroups }), "button", { name: /^Bolig/ }));
    expect(location.hash).toBe("#group=Bolig&unit=2026-10-01&view=fixed&og=Abonnementer&tab=all");
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    await click(app, getByRole(root, "button", { name: new RegExp(`^${da.accounts}`) }));
    await click(app, getByRole(root, "checkbox", { name: "Kreditkort" }));
    expect(location.hash).toBe("#accounts=1&group=Bolig&unit=2026-10-01&view=fixed&og=Abonnementer&tab=all");
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    await click(app, getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await click(app, getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastYear }));
    expect(location.hash).toBe("#period=lastYear&accounts=1&group=Bolig&view=fixed&tab=all");
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    await click(app, getByRole(root, "button", { name: da.fullScreenOf(da.allFixed) }));
    expect(location.hash).toBe("#period=lastYear&accounts=1&group=Bolig&view=fixed&tab=all&full=list");
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    await click(app, tab(root, da.fixed.inPeriod, da.allFixed));
    await click(app, tab(root, da.allFixed));
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "#period=lastYear&accounts=1&group=Bolig&view=fixed&tab=all");
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
  });

  it("closing the list's full screen keeps a tab chosen in it", async () => {
    const { app, root } = await fromOverview();
    await click(app, getByRole(root, "button", { name: da.fullScreenOf(da.fixed.inPeriod) }));
    await toAll(app, root);
    expect(location.hash).toBe(`${ALL}&full=list`);
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, ALL);
    barsRegion(root);
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("a detail opened in the list's full screen, then ⤢: Escape leaves the view, and Back lands before it", async () => {
    const { app, root } = await open("");
    await click(app, getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
    await click(app, link(root, FIXED_CARD));
    await click(app, getByRole(root, "button", { name: da.fullScreenOf(da.fixed.inPeriod) }));
    await toAll(app, root);
    await click(app, getByRole(listRegion(root, da.allFixed), "button", { name: "Husleje" }));
    expect(location.hash).toBe("#card=postings&view=fixed&og=Faste+udgifter&tab=all&full=list&detail=s%3Ab1");
    await click(app, getByRole(root, "button", { name: da.fullScreenOf(da.allFixed) }));
    await hashBecomes(app, "#card=postings&view=fixed&og=Faste+udgifter&tab=all");
    barsRegion(root);
    expect(detail(root, "Husleje")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "#card=postings");
    getByRole(root, "region", { name: da.postingsTitle });
    history.back();
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("opening the view again starts on Poster i perioden", async () => {
    const { app, root } = await fromOverview();
    await toAll(app, root);
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "");
    await click(app, link(root, FIXED_CARD));
    expect(location.hash).toBe(OPEN);
    expect(pressedTab(root)).toEqual([da.fixed.inPeriod]);
  });

  it("the focus stays on the tab's button", async () => {
    const { app, root } = await open(OPEN.slice(1));
    const active = () => app.shadowRoot?.activeElement;
    const all = tab(root, da.allFixed);
    all.focus();
    await click(app, all);
    expect(tab(root, da.allFixed, da.allFixed)).toBe(all);
    expect(active()).toBe(all);
    const payments = tab(root, da.fixed.inPeriod, da.allFixed);
    payments.focus();
    await click(app, payments);
    expect(tab(root, da.fixed.inPeriod)).toBe(payments);
    expect(active()).toBe(payments);
  });

  it("a row opens its detail with detail=s:<id> after tab=all, and its ← goes back to the list with the focus on the row", async () => {
    const { app, root } = await fromOverview();
    await toAll(app, root);
    const length = history.length;
    await click(app, getByRole(listRegion(root, da.allFixed), "button", { name: "Husleje" }));
    expect(location.hash).toBe(`${ALL}&detail=s%3Ab1`);
    expect(history.length).toBe(length + 1);
    const region = listRegion(root, da.allFixed);
    expect(app.shadowRoot?.activeElement).toBe(getByRole(detail(root, "Husleje") as HTMLElement, "heading", { level: 3 }));
    expect(queryByRole(region, "button", { name: "Husleje" })).toBeNull();
    getByRole(region, "group", { name: da.view });
    await click(app, getByRole(region, "button", { name: da.backTo(da.allFixed) }));
    await hashBecomes(app, ALL);
    expect(detail(root, "Husleje")).toBeNull();
    expect(app.shadowRoot?.activeElement).toBe(getByRole(listRegion(root, da.allFixed), "button", { name: "Husleje" }));
  });

  it("the detail closes when the tab changes, and no detail entry is left: Back then leaves the view", async () => {
    const { app, root } = await fromOverview();
    await toAll(app, root);
    await click(app, getByRole(listRegion(root, da.allFixed), "button", { name: "Husleje" }));
    const payments = tab(root, da.fixed.inPeriod, da.allFixed);
    payments.focus();
    await click(app, payments);
    await hashBecomes(app, OPEN);
    expect(detail(root, "Husleje")).toBeNull();
    listRegion(root);
    expect(app.shadowRoot?.activeElement).toBe(payments);
    history.back();
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("the detail closes when a later month takes its row away", async () => {
    const { app, root } = await open(`${ALL}&detail=s%3Ab5`.slice(1), { answer: answer({ bills: [...BILLS, ENDED] }) });
    expect(detail(root, "Ugeblad")).not.toBeNull();
    await click(app, barButtons(root)[4]);
    expect(location.hash).toBe(`#unit=2026-05-01&view=fixed&og=Faste+udgifter&tab=all&detail=s%3Ab5`);
    expect(detail(root, "Ugeblad")).not.toBeNull();
    await click(app, barButtons(root)[5]);
    expect(location.hash).toBe("#unit=2026-06-01&view=fixed&og=Faste+udgifter&tab=all");
    expect(detail(root, "Ugeblad")).toBeNull();
    expect(queryByRole(listRegion(root, da.allFixed), "button", { name: "Ugeblad" })).toBeNull();
  });

  it("the detail's status reads as the row's in a past month", async () => {
    const { root } = await open("unit=2026-03-01&view=fixed&og=Faste+udgifter&tab=all&full=list&detail=s%3Ab1");
    const status = da.status.notSeen(shortDate("2026-03-01", TODAY));
    const row = getByRole(listRegion(root, da.allFixed), "row", { name: new RegExp("^Husleje ") });
    getByText(row, status);
    getByText(detail(root, "Husleje") as HTMLElement, status);
    expect(queryByText(detail(root, "Husleje") as HTMLElement, da.status.paid(shortDate("2026-10-01", TODAY)))).toBeNull();
  });

  it("Escape closes the detail, then full screen, then the view", async () => {
    const { app, root } = await fromOverview();
    await toAll(app, root);
    await click(app, getByRole(root, "button", { name: da.fullScreenOf(da.allFixed) }));
    await click(app, getByRole(listRegion(root, da.allFixed), "button", { name: "Husleje" }));
    expect(location.hash).toBe(`${ALL}&full=list&detail=s%3Ab1`);
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, `${ALL}&full=list`);
    expect(detail(root, "Husleje")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, ALL);
    barsRegion(root);
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "");
    inOverview(root);
  });

  it("in the list's full screen the tabs stay at its head and the detail stands beside the list", async () => {
    const { app, root } = await open(`${ALL}&full=list`.slice(1));
    await click(app, getByRole(listRegion(root, da.allFixed), "button", { name: "Husleje" }));
    const region = listRegion(root, da.allFixed);
    expect(pressedTab(root, da.allFixed)).toEqual([da.allFixed]);
    expect(detail(root, "Husleje")).not.toBeNull();
    getByRole(region, "button", { name: "Husleje" });
    expect(queryByRole(region, "button", { name: da.backTo(da.allFixed) })).toBeNull();
    getByRole(detail(root, "Husleje") as HTMLElement, "button", { name: da.close });
  });

  it("in I år an ended fixed expense's Om året carries why it is not in the sum", async () => {
    const { root } = await open(ALL.slice(1), { answer: answer({ bills: [...BILLS, ENDED] }) });
    const cell = getByTitle(listRegion(root, da.allFixed), da.notInSum(shortDate("2026-05-31", TODAY)));
    expect(flat(cell.textContent)).toBe(kr(60000));
  });
});
