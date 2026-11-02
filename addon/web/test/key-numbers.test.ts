import type { Period, Posting, Subscription } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryAllByRole, queryByRole, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import type { SpendingApp } from "../src/app";
import { count, kr } from "../src/format";
import { da } from "../src/i18n/da";
import { answerFor, SUBSCRIPTIONS, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

afterEach(unmount);

type Link = Posting["subscription"];

const FIXED = da.inPeriod("Faste udgifter");
const SUBS = da.inPeriod("Abonnementer");

function linkLine(n: number): string {
  return da.postingsLink(count(n));
}

function postingsLink(root: HTMLElement): HTMLElement {
  return getByRole(root, "link", { name: /posteringe?r? →$/ });
}

function params(href: string): URLSearchParams {
  return new URLSearchParams(href.slice(href.indexOf("#") + 1));
}

/** What a browser does when the link is followed: the hash changes and the app hears it. */
async function follow(app: SpendingApp, link: HTMLElement): Promise<void> {
  location.hash = link.getAttribute("href") ?? "";
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await settle(app);
}

function linking(links: (p: Posting) => Link, today = "2026-10-30", subscriptions: Subscription[] = SUBSCRIPTIONS) {
  return (range: Period) => {
    const answer = withSubscriptions(answerFor(range, today), subscriptions);
    return json({ ...answer, postings: answer.postings.map((p) => ({ ...p, subscription: links(p) })) });
  };
}

/** Husleje and Q8 paid through bills in Faste udgifter; Pizzeria Roma's first payment in Abonnementer. */
function bills(p: Posting): Link {
  if (p.text === "Husleje") return { name: "Husleje", objectGroup: "Faste udgifter" };
  if (p.text === "Q8") return { name: "Bilforsikring", objectGroup: "Faste udgifter" };
  if (p.text === "MOBILEPAY 1234" && p.date === "2026-09-20") return { name: "Pizzaabonnement", objectGroup: "Abonnementer" };
  return null;
}

const BILLS = linking(bills);

function objectCardNames(root: HTMLElement): string[] {
  return [...queryAllByRole(root, "button"), ...queryAllByRole(root, "group")]
    .map((el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim())
    .map((name) => /^.*? i perioden/.exec(name)?.[0] ?? "")
    .filter((name) => name !== "" && name !== da.spendingInPeriod);
}

function card(root: HTMLElement, label: string): HTMLElement {
  return getByRole(root, "button", { name: new RegExp(`^${label}`) });
}

function name(root: HTMLElement, label: string): string {
  return (card(root, label).textContent ?? "").replace(/\s+/g, " ").trim();
}

function line(perMonth: number | null, n: number): string {
  const bills = da.billCount(n);
  return perMonth === null ? bills : `${da.perMonth(kr(perMonth))} · ${bills}`;
}

describe("the first key number's link to Alle posteringer", () => {
  it("the first key number links to Alle posteringer with its count", async () => {
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

  it("the link opens Alle posteringer with the level, the accounts, the period and the unit, and no search or shop", async () => {
    const { app, root } = await mount(
      "period=lastYear&accounts=1&group=Mad&unit=2025-12-01&card=postings&q=roma&shop=Pizzeria+Roma",
    );
    const link = postingsLink(root);
    const p = params(link.getAttribute("href") ?? "");
    expect(p.get("view")).toBe("all-postings");
    expect(p.get("period")).toBe("lastYear");
    expect(p.get("accounts")).toBe("1");
    expect(p.get("group")).toBe("Mad");
    expect(p.get("unit")).toBe("2025-12-01");
    expect(p.has("q")).toBe(false);
    expect(p.has("shop")).toBe(false);
    expect(p.has("sort")).toBe(false);

    await follow(app, link);
    getByRole(root, "heading", { level: 1, name: da.allPostings });
    expect(params(location.hash).has("shop")).toBe(false);
    expect(params(location.hash).has("q")).toBe(false);
    expect((getByRole(root, "combobox", { name: da.searchLabel }) as HTMLInputElement).value).toBe("");
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

  it("the count matches Alle posteringer's summary after a search", async () => {
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
        p.text === "DK NETTO 4521" && p.date === "2026-09-10" ? { name: "Fitness", objectGroup: "Åbne aftaler" } : null,
      ),
    });
    expect(objectCardNames(root)).toEqual([SUBS, FIXED, da.inPeriod("Åbne aftaler")]);
  });

  it("the value is the period's linked payments", async () => {
    const { app, root } = await mount("", { answer: BILLS });
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(8090000)} ${line(812700, 2)}`);
    expect(name(root, SUBS)).toBe(`${SUBS} ${kr(70000)} ${line(7000, 1)}`);

    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    await settle(app);
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(800000)} ${line(811700, 1)}`);
    expect(name(root, SUBS)).toBe(`${SUBS} ${kr(70000)} ${line(71000, 1)}`);
    unmount();

    const bolig = await mount("group=Bolig", { answer: BILLS });
    expect(name(bolig.root, FIXED)).toBe(`${FIXED} ${kr(8000000)} ${line(803600, 1)}`);
    expect(name(bolig.root, SUBS)).toBe(`${SUBS} ${kr(0)} ${da.noPayments}`);
    unmount();

    const account = await mount("accounts=2", { answer: BILLS });
    expect(name(account.root, FIXED)).toBe(`${FIXED} ${kr(90000)} ${line(9000, 1)}`);
    unmount();

    for (const hash of ["unit=2026-07-01", "card=postings&q=Netto", "card=postings&shop=Q8"]) {
      const other = await mount(hash, { answer: BILLS });
      expect(name(other.root, FIXED)).toBe(`${FIXED} ${kr(8090000)} ${line(812700, 2)}`);
      unmount();
    }
  });

  it("n counts different bills, not payments", async () => {
    const { root } = await mount("period=custom&from=2026-09-01&to=2026-10-30", {
      answer: linking((p) => {
        if (p.text === "DK NETTO 4521") return { name: "Madkasse", objectGroup: "Abonnementer" };
        if (p.text === "Café Søde") return { name: "Kaffeklub", objectGroup: "Abonnementer" };
        return null;
      }),
    });
    expect(name(root, SUBS)).toMatch(new RegExp(`· ${da.billCount(2)}$`));
    expect(name(root, SUBS)).toContain(kr(631012));
  });

  it("an ended bill's group shows when the period holds its payments, not when only the range before it does", async () => {
    const answer = linking((p) =>
      p.text === "DK NETTO 4521" && p.date === "2026-09-10" ? { name: "Fitness", objectGroup: "Medlemskaber" } : null,
    );
    const { fetch, root } = await mount("period=thisMonth", { answer });
    expect(fetch).toHaveBeenCalledWith("api/data?start=2025-10-01&end=2026-10-30", expect.anything());
    expect(objectCardNames(root)).toEqual([SUBS, FIXED]);
    unmount();

    const again = await mount("period=last3Months", { answer });
    expect(name(again.root, da.inPeriod("Medlemskaber"))).toBe(
      `${da.inPeriod("Medlemskaber")} ${kr(300000)} ${line(99300, 1)}`,
    );
  });

  it("the sub-line has the sum per month and the count of bills", async () => {
    const { root } = await mount("", { answer: (range) => json(withSubscriptions(answerFor(range))) });
    getByText(card(root, SUBS), `${da.perMonth(kr(7000))} · ${da.billCount(1)}`);
  });

  it("under 28 days the line holds the count only", async () => {
    const { root } = await mount("period=thisMonth", {
      now: "2026-10-05T10:00:00Z",
      answer: linking(bills, "2026-10-05"),
    });
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(800000)} ${da.billCount(1)}`);
    expect(queryByText(card(root, FIXED), new RegExp(da.perMonth("")))).toBeNull();
  });

  it("a refund counts against", async () => {
    const { root } = await mount("", {
      answer: linking((p) =>
        p.text === "MOBILEPAY 1234" ? { name: "Pizzaabonnement", objectGroup: "Abonnementer" } : null,
      ),
    });
    expect(name(root, SUBS)).toBe(`${SUBS} ${kr(50000)} ${line(5000, 1)}`);
  });

  it("no payment: 0 kr. and ingen betalinger", async () => {
    const { root } = await mount("", { answer: (range) => json(withSubscriptions(answerFor(range))) });
    expect(name(root, FIXED)).toBe(`${FIXED} ${kr(0)} ${da.noPayments}`);
  });

  it("a click toggles Faste udgifter and every card is pressed", async () => {
    const { app, root } = await mount("", { answer: (range) => json(withSubscriptions(answerFor(range))) });
    const pressed = () => [SUBS, FIXED].map((label) => card(root, label).getAttribute("aria-pressed"));
    expect(pressed()).toEqual(["false", "false"]);

    fireEvent.click(card(root, SUBS));
    await settle(app);
    getByRole(root, "region", { name: da.subscriptions });
    expect(pressed()).toEqual(["true", "true"]);
    expect(location.hash).toBe("#card=subscriptions");

    fireEvent.click(card(root, FIXED));
    await settle(app);
    getByRole(root, "region", { name: da.per("month") });
    expect(pressed()).toEqual(["false", "false"]);
    expect(location.hash).toBe("");
  });

  it("no object group at all: three key numbers", async () => {
    const { root } = await mount("period=thisMonth");
    expect(objectCardNames(root)).toEqual([]);
    expect(getAllByRole(root, "group", { name: (n) => n !== da.view })).toHaveLength(3);
  });

  it("plain cards when the answer has no subscriptions but the postings have a group", async () => {
    const { root } = await mount("");
    const plain = getByRole(root, "group", { name: SUBS });
    getByText(plain, kr(70000));
    getByText(plain, line(7000, 1));
    expect(queryByRole(root, "button", { name: new RegExp(`^${SUBS}`) })).toBeNull();
  });
});
