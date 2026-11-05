import { type Period, type Posting, type Subscription, unitAt } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryAllByRole, queryByRole, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { count, kr, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { objectGroupCards, perMonth } from "../src/model/key-numbers";
import { parseHash } from "../src/state/view";
import {
  answerFor,
  billPayment,
  SUBSCRIPTIONS,
  TAB_POSTINGS,
  TAB_TODAY,
  tabBill,
  tabData,
  withSubscriptions,
} from "./fixture";
import { json, mount, settle, unmount } from "./mount";
import { cardNames, hasArrow } from "./text";

afterEach(unmount);

type Link = Posting["subscription"];

const FIXED = da.inPeriod("Faste udgifter");
const SUBS = da.inPeriod("Abonnementer");
const JULY = unitName(unitAt("2026-07-01", "month", "2026-10-30"), "month", false);
const JULY_FIXED = da.levelInUnit("Faste udgifter", JULY);
const JULY_SUBS = da.levelInUnit("Abonnementer", JULY);

function linkLine(n: number): string {
  return da.postingsLink(count(n));
}

function postingsLink(root: HTMLElement): HTMLElement {
  return getByRole(root, "link", { name: /posteringe?r? →$/ });
}

/** A press on the link; the app handles it, so a press that only followed the href would miss the history marks. */
async function follow(app: SpendingApp, link: HTMLElement): Promise<void> {
  fireEvent.click(link);
  await settle(app);
}

async function hashBecomes(app: SpendingApp, hash: string): Promise<void> {
  await vi.waitFor(() => expect(location.hash).toBe(hash));
  await settle(app);
}

function fullScreenButton(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: da.fullScreen });
}

function isFullScreen(root: HTMLElement): boolean {
  return fullScreenButton(root).getAttribute("aria-pressed") === "true";
}

function trailText(root: HTMLElement): string {
  return (getByRole(root, "navigation", { name: da.trail }).textContent ?? "").replace(/\s+/g, " ").trim();
}

function searchValue(root: HTMLElement): string {
  return (getByRole(root, "combobox", { name: da.searchLabel }) as HTMLInputElement).value;
}

function subscriptionsLink(root: HTMLElement, label: string): HTMLElement {
  return getByRole(objectCard(root, label), "link", { name: da.showSubscriptions });
}

function linking(links: (p: Posting) => Link, today = "2026-10-30", subscriptions: Subscription[] = SUBSCRIPTIONS) {
  return (range: Period) => {
    const answer = withSubscriptions(answerFor(range, today), subscriptions);
    return json({ ...answer, postings: answer.postings.map((p) => ({ ...p, subscription: links(p) })) });
  };
}

/** Husleje and Q8 paid through bills in Faste udgifter; Pizzeria Roma's first payment in Abonnementer. */
function bills(p: Posting): Link {
  if (p.text === "Husleje") return { id: "b1", name: "Husleje", objectGroup: "Faste udgifter" };
  if (p.text === "Q8") return { id: "b4", name: "Bilforsikring", objectGroup: "Faste udgifter" };
  if (p.text === "MOBILEPAY 1234" && p.date === "2026-09-20") return { id: "b7", name: "Pizzaabonnement", objectGroup: "Abonnementer" };
  return null;
}

const BILLS = linking(bills);

function objectCardNames(root: HTMLElement, unit: string | null = null): string[] {
  const suffix = unit === null ? " i perioden" : ` i ${unit.toLowerCase()}`;
  return queryAllByRole(root, "group")
    .map((el) => el.getAttribute("aria-label") ?? "")
    .filter((name) => name.endsWith(suffix) && name !== da.spendingInPeriod && name !== da.unitTotal(unit ?? ""));
}

function objectCard(root: HTMLElement, label: string): HTMLElement {
  return getByRole(root, "group", { name: label });
}

function card(root: HTMLElement, label: string): HTMLElement {
  return getByRole(root, "group", { name: label });
}

/** The card's label, value and sub-line, without its link line. */
function name(root: HTMLElement, label: string): string {
  const postings = new RegExp(` ([\\d.]+ (${da.postingMany}|${da.postingOne})|${da.showSubscriptions})( →)?`);
  return (card(root, label).textContent ?? "").replace(/\s+/g, " ").replace(postings, "").trim();
}

function line(perMonth: number | null, n: number): string {
  const bills = da.billCount(n);
  return perMonth === null ? bills : `${da.perMonth(kr(perMonth))} · ${bills}`;
}

describe("a one-unit period has no comparison", () => {
  it("shows the period's sum and average only", async () => {
    const { root } = await mount("period=thisMonth");
    expect(cardNames(root)).toEqual([da.spendingInPeriod, da.averagePer("month")]);
    expect(hasArrow(root)).toBe(false);
  });
});

describe("the first key number's link to Posteringer in full screen", () => {
  it("the first key number links with its count", async () => {
    const { root } = await mount("");
    const first = getByRole(root, "group", { name: da.spendingInPeriod });
    const link = getByRole(first, "link", { name: linkLine(28) });
    expect(link.textContent?.trim()).toBe(linkLine(28));
  });

  it("one posting reads 1 postering", async () => {
    const { root } = await mount("", {
      answer: (range) => {
        const answer = answerFor(range);
        return json({ ...answer, postings: answer.postings.slice(0, 1) });
      },
    });
    getByRole(getByRole(root, "group", { name: da.spendingInPeriod }), "link", { name: "1 postering →" });
  });

  it("its href is full-screen Posteringer with the top filter and no quick filter", async () => {
    const { root } = await mount(
      "period=lastYear&accounts=1&group=Mad&unit=2025-12-01&q=roma&shop=Pizzeria+Roma&min=5",
    );
    expect(postingsLink(root).getAttribute("href")).toBe(
      "#period=lastYear&accounts=1&group=Mad&unit=2025-12-01&card=postings&view=full",
    );
  });

  it("opens Posteringer in full screen in one entry, the trail unchanged and the quick filter empty", async () => {
    const { app, root } = await mount(
      "period=lastYear&accounts=1&group=Mad&unit=2025-12-01&q=roma&shop=Pizzeria+Roma",
    );
    const trail = trailText(root);
    const length = history.length;
    await follow(app, postingsLink(root));
    expect(location.hash).toBe("#period=lastYear&accounts=1&group=Mad&unit=2025-12-01&card=postings&view=full");
    expect(history.length).toBe(length + 1);
    expect(isFullScreen(root)).toBe(true);
    expect(trailText(root)).toBe(trail);
    getByRole(root, "region", { name: da.postingsOf("Mad") });
    expect(searchValue(root)).toBe("");
    expect(queryByRole(root, "button", { name: da.remove(da.shopChip("Pizzeria Roma")) })).toBeNull();

    history.back();
    await hashBecomes(app, "#period=lastYear&accounts=1&group=Mad&unit=2025-12-01&q=roma&shop=Pizzeria+Roma");
    expect(isFullScreen(root)).toBe(false);
  });

  it("closes an open detail", async () => {
    const { app, root } = await mount("card=postings&detail=p%3Ap26");
    getByRole(root, "group", { name: "Café Søde" });
    await follow(app, postingsLink(root));
    expect(location.hash).toBe("#card=postings&view=full");
    expect(queryByRole(root, "group", { name: "Café Søde" })).toBeNull();
  });

  /** Mounts on the overview and pushes Posteringer, so the entry before the link is a known one. */
  async function linkFromPostings(): Promise<{ app: SpendingApp; root: HTMLElement }> {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
    await settle(app);
    expect(location.hash).toBe("#card=postings");
    await follow(app, postingsLink(root));
    expect(location.hash).toBe("#card=postings&view=full");
    return { app, root };
  }

  async function openRow(app: SpendingApp, root: HTMLElement): Promise<void> {
    fireEvent.click(getAllByRole(root, "button", { name: "Café Søde" })[0]);
    await settle(app);
    getByRole(root, "group", { name: "Café Søde" });
  }

  /** Lands on the entry before the link, which the next Back leaves for the page's first entry. */
  async function expectLandedBeforeLink(app: SpendingApp, root: HTMLElement): Promise<void> {
    await hashBecomes(app, "#card=postings");
    expect(isFullScreen(root)).toBe(false);
    history.back();
    await hashBecomes(app, "");
    expect(isFullScreen(root)).toBe(false);
  }

  it("⤡ after the link goes back to the entry before it, so Back does not open full screen again", async () => {
    const { app, root } = await linkFromPostings();
    fireEvent.click(fullScreenButton(root));
    await hashBecomes(app, "#card=postings");
    history.forward();
    await hashBecomes(app, "#card=postings&view=full");
    history.back();
    await expectLandedBeforeLink(app, root);
  });

  it("⤡ after the link and a row leaves full screen, and Back does not open it again", async () => {
    const { app, root } = await linkFromPostings();
    await openRow(app, root);
    fireEvent.click(fullScreenButton(root));
    await expectLandedBeforeLink(app, root);
  });

  it("Escape after the link goes back to the entry before it, so Back does not open full screen again", async () => {
    const { app, root } = await linkFromPostings();
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "#card=postings");
    history.forward();
    await hashBecomes(app, "#card=postings&view=full");
    history.back();
    await expectLandedBeforeLink(app, root);
  });

  it("after the link and a row, the first Escape closes the detail and the second leaves full screen for good", async () => {
    const { app, root } = await linkFromPostings();
    await openRow(app, root);
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "#card=postings&view=full");
    expect(queryByRole(root, "group", { name: "Café Søde" })).toBeNull();
    expect(isFullScreen(root)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    await expectLandedBeforeLink(app, root);
  });

  it("⤡ after the link brings back the search from before it", async () => {
    const { app, root } = await mount("card=postings&q=Netto");
    await follow(app, postingsLink(root));
    expect(searchValue(root)).toBe("");
    fireEvent.click(fullScreenButton(root));
    await hashBecomes(app, "#card=postings&q=Netto");
    expect(isFullScreen(root)).toBe(false);
    expect(searchValue(root)).toBe("Netto");
  });

  it("clears the amount, and ⤡ brings it back", async () => {
    const under = da.amountName({ kind: "under", value: 450_000 });
    const { app, root } = await mount("card=postings&under=4500");
    getByRole(root, "group", { name: under });
    await follow(app, postingsLink(root));
    expect(location.hash).toBe("#card=postings&view=full");
    expect(queryByRole(root, "group", { name: under })).toBeNull();
    fireEvent.click(fullScreenButton(root));
    await hashBecomes(app, "#card=postings&under=4500");
    expect(isFullScreen(root)).toBe(false);
    getByRole(root, "group", { name: under });
  });

  it("⤡ after the link keeps an amount set in full screen", async () => {
    const { app, root } = await mount("card=postings&under=4500");
    await follow(app, postingsLink(root));
    const pill = getByRole(root, "button", { name: da.filterAmount });
    fireEvent.click(pill as HTMLElement);
    await settle(app);
    const kinds = getByRole(root, "group", { name: da.amountKindsLabel });
    fireEvent.click(getByRole(kinds, "button", { name: da.amountKinds.over }));
    await settle(app);
    const input = getByRole(root, "textbox", { name: da.amountKinds.over });
    fireEvent.input(input, { target: { value: "500" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await settle(app);
    expect(location.hash).toBe("#card=postings&view=full&over=500");
    fireEvent.click(fullScreenButton(root));
    await hashBecomes(app, "#card=postings&over=500");
    getByRole(root, "group", { name: da.amountName({ kind: "over", value: 50_000 }) });
  });

  it("⤡ after the link, a row and a search keeps the search typed in full screen", async () => {
    const { app, root } = await mount("card=postings&q=Netto");
    await follow(app, postingsLink(root));
    fireEvent.click(getAllByRole(root, "button", { name: "Café Søde" })[0]);
    await settle(app);
    fireEvent.input(getByRole(root, "combobox", { name: da.searchLabel }), { target: { value: "Café" } });
    await settle(app);
    fireEvent.click(fullScreenButton(root));
    await hashBecomes(app, "#card=postings&q=Caf%C3%A9");
    expect(searchValue(root)).toBe("Café");
  });

  it("a main group's and a category's counts are that level's", async () => {
    const { root } = await mount("group=Mad");
    getByRole(getByRole(root, "group", { name: da.inPeriod("Mad") }), "link", { name: linkLine(14) });
    unmount();
    const again = await mount("group=Mad&category=Caf%C3%A9");
    getByRole(getByRole(again.root, "group", { name: da.inPeriod("Café") }), "link", { name: linkLine(4) });
  });

  it("a chosen unit's count is the unit's", async () => {
    const { root } = await mount("unit=2026-07-01");
    getByRole(root, "link", { name: linkLine(5) });
    unmount();
    const again = await mount("group=Mad&unit=2026-07-01");
    getByRole(again.root, "link", { name: linkLine(2) });
  });

  it("no postings, no link", async () => {
    const { root } = await mount("period=custom&from=2025-01-01&to=2025-01-31");
    const first = getByRole(root, "group", { name: da.spendingInPeriod });
    getByText(first, count(0));
    expect(queryByRole(first, "link")).toBeNull();
  });

  it("the count matches the list's summary after a search", async () => {
    const { app, root } = await mount("group=Mad&card=postings&q=roma");
    const link = getByRole(root, "link", { name: linkLine(14) });
    await follow(app, link);
    getByText(root, da.summary(count(14), kr(3281012)));
  });
});

describe("the key numbers of the object groups", () => {
  it("one key number per object group, by name", async () => {
    const { root } = await mount("", {
      answer: linking((p) =>
        p.text === "DK NETTO 4521" && p.date === "2026-09-10" ? { id: "b8", name: "Fitness", objectGroup: "Åbne aftaler" } : null,
      ),
    });
    expect(objectCardNames(root)).toEqual([SUBS, FIXED, da.inPeriod("Åbne aftaler")]);
  });

  it("the value is the period's linked payments", async () => {
    const { app, root } = await mount("", { answer: BILLS });
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(8090000)} ${line(812700, 4)}`);
    expect(name(root, SUBS)).toBe(`${SUBS} ${kr(70000)} ${line(7000, 2)}`);

    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    await settle(app);
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(800000)} ${line(811700, 3)}`);
    expect(name(root, SUBS)).toBe(`${SUBS} ${kr(70000)} ${line(71000, 2)}`);
    unmount();

    const bolig = await mount("group=Bolig", { answer: BILLS });
    expect(name(bolig.root, FIXED)).toBe(`${FIXED} ${kr(8000000)} ${line(803600, 2)}`);
    expect(name(bolig.root, SUBS)).toBe(`${SUBS} ${kr(0)} ${da.noPayments}`);
    unmount();

    const account = await mount("accounts=2", { answer: BILLS });
    expect(name(account.root, FIXED)).toBe(`${FIXED} ${kr(90000)} ${line(9000, 2)}`);
    unmount();

    for (const hash of ["card=postings&q=Netto", "card=postings&shop=Q8"]) {
      const other = await mount(hash, { answer: BILLS });
      expect(name(other.root, FIXED)).toBe(`${FIXED} ${kr(8090000)} ${line(812700, 4)}`);
      unmount();
    }
  });

  it("names the chosen unit without its year with I år", async () => {
    const { root } = await mount("unit=2026-07-01", { answer: BILLS });
    expect(objectCardNames(root, "Juli")).toContain("Faste udgifter i juli");
  });

  it("names the chosen unit with its year when the bars cross a new year", async () => {
    const answer = linking(bills, "2026-11-04");
    const { root } = await mount("period=last12Months&unit=2026-07-01", { answer, now: "2026-11-04T10:00:00Z" });
    expect(objectCardNames(root, "Juli 2026")).toContain(da.levelInUnit("Faste udgifter", "Juli 2026"));
  });

  it("with a chosen unit the value is that unit's payments, and a group with none keeps its card", async () => {
    const { root } = await mount("unit=2026-07-01", { answer: BILLS });
    expect(objectCardNames(root, JULY)).toEqual([JULY_SUBS, JULY_FIXED]);
    expect(name(root, JULY_FIXED)).toBe(`${JULY_FIXED} ${kr(890000)} ${da.billCount(3)}`);
    expect(name(root, JULY_SUBS)).toBe(`${JULY_SUBS} ${kr(0)} ${da.noPaymentsCount(2)}`);
  });

  it("n counts the tab's rows, not the bills among the payments", async () => {
    const { root } = await mount("period=custom&from=2026-09-01&to=2026-10-30", {
      answer: linking((p) => {
        if (p.text === "DK NETTO 4521") return { id: "b9", name: "Madkasse", objectGroup: "Abonnementer" };
        if (p.text === "Café Søde") return { id: "b10", name: "Kaffeklub", objectGroup: "Abonnementer" };
        return null;
      }),
    });
    // Madkasse and Kaffeklub are paid but not bills; Streaming and Tennisklub are the rows.
    expect(name(root, SUBS)).toMatch(new RegExp(`· ${da.billCount(2)}$`));
    expect(name(root, SUBS)).toContain(kr(631012));
    unmount();

    const many = await mount("period=custom&from=2026-09-01&to=2026-10-30", {
      answer: linking((p) => (p.text === "Husleje" ? bills(p) : null)),
    });
    expect(name(many.root, FIXED)).toMatch(new RegExp(`· ${da.billCount(3)}$`));
  });

  it("an ended bill's group shows when the period holds its payments, not when only the range before it does", async () => {
    const answer = linking((p) =>
      p.text === "DK NETTO 4521" && p.date === "2026-09-10" ? { id: "b8", name: "Fitness", objectGroup: "Medlemskaber" } : null,
    );
    const { fetch, root } = await mount("period=thisMonth", { answer });
    expect(fetch).toHaveBeenCalledWith("api/data?start=2025-10-01&end=2026-10-30", expect.anything());
    expect(objectCardNames(root)).toEqual([SUBS, FIXED]);
    unmount();

    const again = await mount("period=last3Months", { answer });
    expect(name(again.root, da.inPeriod("Medlemskaber"))).toBe(
      `${da.inPeriod("Medlemskaber")} ${kr(300000)} ${da.perMonth(kr(99300))}`,
    );
  });

  it("the sub-line has the sum per month and the count of bills", async () => {
    const { root } = await mount("", { answer: (range) => json(withSubscriptions(answerFor(range))) });
    getByText(card(root, SUBS), `${da.perMonth(kr(7000))} · ${da.billCount(2)}`);
  });

  it("under 28 days the line holds the count only", async () => {
    const { root } = await mount("period=thisMonth", {
      now: "2026-10-05T10:00:00Z",
      answer: linking(bills, "2026-10-05"),
    });
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(800000)} ${da.billCount(3)}`);
    expect(queryByText(card(root, FIXED), new RegExp(da.perMonth("")))).toBeNull();
  });

  it("a refund counts against", async () => {
    const { root } = await mount("", {
      answer: linking((p) =>
        p.text === "MOBILEPAY 1234" ? { id: "b7", name: "Pizzaabonnement", objectGroup: "Abonnementer" } : null,
      ),
    });
    expect(name(root, SUBS)).toBe(`${SUBS} ${kr(50000)} ${line(5000, 2)}`);
  });

  it("no payment: 0 kr., ingen betalinger and the rows' count", async () => {
    const { root } = await mount("", { answer: (range) => json(withSubscriptions(answerFor(range))) });
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(0)} ${da.noPaymentsCount(4)}`);
  });

  it("no object group at all: two key numbers", async () => {
    const { root } = await mount("period=thisMonth");
    expect(objectCardNames(root)).toEqual([]);
    expect(getAllByRole(root, "group", { name: (n) => n !== da.view })).toHaveLength(2);
  });

  it("plain cards when the answer has no subscriptions but the postings have a group", async () => {
    const { root } = await mount("");
    const plain = getByRole(root, "group", { name: SUBS });
    getByText(plain, kr(70000));
    getByText(plain, da.perMonth(kr(7000)));
    expect(queryByRole(root, "button", { name: new RegExp(`^${SUBS}`) })).toBeNull();
  });
});

describe("the link on each object group's key number", () => {
  it("each object group's key number links to the fixed-expenses view on its own group", async () => {
    const { root } = await mount("", { answer: BILLS });
    for (const [label, hash] of [
      [FIXED, "#view=fixed&og=Faste+udgifter"],
      [SUBS, "#view=fixed&og=Abonnementer"],
    ]) {
      const link = subscriptionsLink(root, label);
      expect(link.textContent?.replace(/\s+/g, " ").trim()).toBe(`${da.showSubscriptions} →`);
      expect(link.getAttribute("href")).toBe(hash);
    }
  });

  it("opens the fixed-expenses view in one entry, and Back returns to the card before", async () => {
    const { app, root } = await mount("card=postings&q=Netto", { answer: BILLS });
    const length = history.length;
    await follow(app, subscriptionsLink(root, FIXED));
    expect(location.hash).toBe("#card=postings&view=fixed&og=Faste+udgifter&q=Netto");
    expect(history.length).toBe(length + 1);
    getByRole(root, "button", { name: da.switchObjectGroup("Faste udgifter") });
    history.back();
    await hashBecomes(app, "#card=postings&q=Netto");
    getByRole(root, "region", { name: da.postingsTitle });
  });

  it("closes an open detail on another card", async () => {
    const { app, root } = await mount("card=postings&detail=p%3Ap26", { answer: BILLS });
    await follow(app, subscriptionsLink(root, FIXED));
    expect(location.hash).toBe("#card=postings&view=fixed&og=Faste+udgifter");
    expect(queryByRole(root, "group", { name: "Café Søde" })).toBeNull();
  });

  it("links also when the group has no payment in the period", async () => {
    const { root } = await mount("group=Bolig", { answer: BILLS });
    getByText(objectCard(root, SUBS), da.noPayments);
    subscriptionsLink(root, SUBS);
  });

  it("no key-number card holds a button, and a click on a label changes nothing", async () => {
    const { app, root } = await mount("", { answer: BILLS });
    const kpis = getByRole(root, "group", { name: FIXED }).parentElement as HTMLElement;
    expect(queryAllByRole(kpis, "button")).toEqual([]);
    const before = location.hash;
    fireEvent.click(getByText(card(root, FIXED), FIXED));
    await settle(app);
    expect(location.hash).toBe(before);
    getByRole(root, "region", { name: da.per("month") });
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(8090000)} ${line(812700, 4)}`);
  });

  it("a plain card has no link, as there is no fixed-expenses view", async () => {
    const { root } = await mount("");
    expect(getAllByRole(root, "group", { name: SUBS })).toHaveLength(1);
    expect(queryByRole(objectCard(root, SUBS), "link")).toBeNull();
  });
});

describe("the object-group card's line", () => {
  /** Payments linked to a bill Firefly III no longer gives, as for an inactive one without an end date. */
  const inactive = tabBill("t11", "Gammel aftale", {
    objectGroup: "Medlemskaber",
    lastPayment: { date: "2026-10-01", amount: 10000, category: "Husleje", account: "1" },
  });
  const data = tabData(undefined, [
    ...TAB_POSTINGS,
    ...["2026-09-01", "2026-10-01"].map((d) => billPayment(inactive, d)),
  ]);

  function sub(hash: string, group: string): string {
    const ctx = viewContext(data, parseHash(hash), TAB_TODAY);
    const found = objectGroupCards(ctx, (g) => g).find((c) => c.label.startsWith(group));
    if (found === undefined) throw new Error(`no card ${group}`);
    return found.sub;
  }

  it("with payments and rows: the sum per month and the rows' count, or the count alone in a unit", () => {
    const year = viewContext(data, parseHash(""), TAB_TODAY).timeline.period;
    const paid = 11 * 800000 + 5 * 15000;
    expect(sub("", "Faste udgifter")).toBe(`${da.perMonth(kr(perMonth(paid, year) ?? 0))} · ${da.billCount(4)}`);
    expect(sub("unit=2026-05-01", "Faste udgifter")).toBe(da.billCount(3));
  });

  it("with no payments and rows: ingen betalinger and the rows' count", () => {
    expect(sub("period=lastMonth", "Bil")).toBe(da.noPaymentsCount(1));
  });

  it("with payments and no rows: the sum per month without stk., or nothing in a unit", () => {
    const year = viewContext(data, parseHash(""), TAB_TODAY).timeline.period;
    expect(sub("", "Medlemskaber")).toBe(da.perMonth(kr(perMonth(20000, year) ?? 0)));
    expect(sub("unit=2026-10-01", "Medlemskaber")).toBe("");
  });

  it("with no payments and no rows: ingen betalinger", () => {
    expect(sub("unit=2026-10-01", "Abonnementer")).toBe(da.noPayments);
  });
});
