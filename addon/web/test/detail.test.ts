import type { Period, Posting, SpendingData, Subscription } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, queryByRole, within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import type { SpendingApp } from "../src/app";
import { count, rangeText, tableDate, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { subscriptionRows } from "../src/model/subscriptions";
import { DEFAULT_STATE } from "../src/state/view";
import { answerFor, LINK, SUBSCRIPTIONS, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

afterEach(unmount);

const TODAY = "2026-10-30";
const THIS_YEAR: Period = { start: "2026-01-01", end: TODAY };

const PIZZA: Subscription = {
  id: "b7",
  name: "Pizzaabonnement",
  objectGroup: "Abonnementer",
  repeat: "monthly",
  skip: 0,
  start: "2026-01-20",
  end: null,
  amountMin: 70000,
  amountMax: 70000,
  lastPayment: { date: "2026-09-20", amount: 70000, category: "Café", account: "2" },
};

/** The fixture's rent postings linked to the Husleje bill, and the pizza bill known. */
function linked(range: Period, link: string | null = LINK): SpendingData {
  const answer = answerFor(range);
  const postings = answer.postings.map(
    (p): Posting =>
      p.text === "Husleje" ? { ...p, subscription: { id: "b1", name: "Husleje", objectGroup: "Faste udgifter" } } : p,
  );
  return { ...withSubscriptions({ ...answer, postings }, [...SUBSCRIPTIONS, PIZZA]), fireflyLinkUrl: link };
}

function mountLinked(hash: string, link: string | null = LINK) {
  return mount(hash, { answer: (range) => json(linked(range, link)) });
}

function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function region(root: HTMLElement, title: string): HTMLElement {
  return getByRole(root, "region", { name: title });
}

function detail(root: HTMLElement, title: string): HTMLElement {
  return getByRole(root, "group", { name: title });
}

function focused(app: SpendingApp): Element | null {
  return app.shadowRoot?.activeElement ?? null;
}

/** The row of a list that holds both the date and a button with that name. */
function rowButton(container: HTMLElement, name: string, date?: string): HTMLElement {
  const rows = getAllByRole(container, "row").filter(
    (r) => (date === undefined || text(r).includes(tableDate(date))) && within(r).queryByRole("button", { name }),
  );
  if (rows.length !== 1) throw new Error(`${rows.length} rows with ${name} ${date ?? ""}`);
  return within(rows[0]).getByRole("button", { name });
}

async function click(app: SpendingApp, el: HTMLElement): Promise<void> {
  fireEvent.click(el);
  await settle(app);
}

function boxes(d: HTMLElement): string[] {
  return getAllByRole(d, "term").map((t) => `${text(t)} = ${text(t.nextElementSibling as Element)}`);
}

function detailRows(d: HTMLElement): HTMLElement[] {
  return getAllByRole(getByRole(d, "table"), "row");
}

describe("the detail on the normal page", () => {
  it("a Faste udgifter row opens its detail and the focus is on its heading", async () => {
    const { app, root } = await mountLinked("card=subscriptions");
    await click(app, rowButton(region(root, da.subscriptions), "Husleje"));
    expect(location.hash).toBe("#card=subscriptions&detail=s%3Ab1");

    const card = region(root, da.subscriptions);
    const heading = getByRole(card, "heading", { level: 3, name: "Husleje" });
    expect(focused(app)).toBe(heading);
    const d = detail(card, "Husleje");
    expect(text(d)).toContain("Bolig · Faste udgifter");
    const ctx = viewContext(linked(THIS_YEAR), { ...DEFAULT_STATE, card: "subscriptions" }, TODAY);
    const status = subscriptionRows(ctx).find((r) => r.name === "Husleje")?.status.text ?? "";
    expect(status).not.toBe("");
    expect(text(d)).toContain(status);
    expect(boxes(d)).toEqual([
      `${da.detailInPeriod(rangeText(THIS_YEAR))} = 80.000 kr. · ${count(10)}`,
      `${da.subscriptionColumns.perYear} = 96.000 kr.`,
      `${da.columns.account} = Fælleskonto`,
    ]);
    const rows = detailRows(d);
    expect(rows.map(text)).toEqual(
      ["10", "09", "08", "07", "06", "05", "04", "03", "02", "01"].map(
        (m) => `${tableDate(`2026-${m}-01`)} Fælleskonto -8.000,00 kr.`,
      ),
    );
    expect(rows.some((r) => r.getAttribute("aria-current") === "true")).toBe(false);
    expect(queryByRole(card, "table", { name: da.subscriptions })).toBeNull();
    expect(queryByRole(card, "button", { name: "Husleje" })).toBeNull();
  });

  it("Tilbage til Faste udgifter closes it and the focus is back on the row's button", async () => {
    const { app, root } = await mountLinked("card=subscriptions");
    await click(app, rowButton(region(root, da.subscriptions), "Husleje"));
    const card = region(root, da.subscriptions);
    await click(app, getByRole(card, "button", { name: da.backTo(da.subscriptions) }));
    expect(location.hash).toBe("#card=subscriptions");
    expect(queryByRole(root, "heading", { level: 3, name: "Husleje" })).toBeNull();
    expect(focused(app)).toBe(rowButton(region(root, da.subscriptions), "Husleje"));
  });

  it("a row in a fold opened by hand gets the focus back after a close", async () => {
    const { app, root } = await mountLinked("card=postings");
    const february = unitName(viewContext(linked(THIS_YEAR), DEFAULT_STATE, TODAY).units[1], "month");
    await click(app, getByRole(region(root, da.postingsTitle), "button", { name: new RegExp(`^${february},`), expanded: false }));
    await click(app, rowButton(region(root, da.postingsTitle), "Kiosken"));
    getByRole(root, "heading", { level: 3, name: "Kiosken" });
    await click(app, getByRole(root, "button", { name: da.backTo(da.postingsTitle) }));
    expect(focused(app)).toBe(rowButton(region(root, da.postingsTitle), "Kiosken"));
  });

  it("a link with a detail opens it and leaves the focus where it was", async () => {
    const { app, root } = await mountLinked("card=postings&detail=p%3Ap25");
    getByRole(root, "heading", { level: 3, name: "Pizzeria Roma" });
    expect(focused(app)).toBeNull();
  });

  it("keeps the view switch and the full-screen button, and hides the chips, while open", async () => {
    const { app, root } = await mountLinked("group=Bolig&category=Husleje&card=postings");
    const title = da.postingsOf("Husleje");
    getByRole(region(root, title), "button", { name: da.remove("Husleje") });
    await click(app, rowButton(region(root, title), "Husleje", "2026-10-01"));
    const card = region(root, title);
    expect(queryByRole(card, "button", { name: da.remove("Husleje") })).toBeNull();
    getByRole(card, "group", { name: da.view });
    getByRole(card, "button", { name: da.fullScreen });
    getByRole(card, "button", { name: da.backTo(title) });
    expect(queryByRole(card, "combobox")).toBeNull();
    expect(queryByRole(card, "button", { name: da.showAll })).toBeNull();
  });

  it("a Posteringer row of a linked posting opens the subscription, with the row marked", async () => {
    const { app, root } = await mountLinked("card=postings");
    await click(app, rowButton(region(root, da.postingsTitle), "Pizzeria Roma", "2026-09-20"));
    const d = detail(region(root, da.postingsTitle), "Pizzaabonnement");
    expect(text(d)).toContain("Mad · Abonnementer");
    const marked = detailRows(d).filter((r) => r.getAttribute("aria-current") === "true");
    expect(marked.map(text)).toEqual([`${tableDate("2026-09-20")} Kreditkort -700,00 kr.`]);
  });

  it("another posting opens its shop; Kiosken opens the rows with no shop and its text", async () => {
    const { app, root } = await mountLinked("card=postings");
    await click(app, rowButton(region(root, da.postingsTitle), "Pizzeria Roma", "2026-09-22"));
    let d = detail(region(root, da.postingsTitle), "Pizzeria Roma");
    expect(text(d)).toContain(da.shopContext);
    expect(text(d)).toContain(`${tableDate("2026-09-22")} · MOBILEPAY 1234`);
    expect(boxes(d)).toEqual([
      `${da.detailInPeriod(rangeText(THIS_YEAR))} = 500 kr. · ${count(2)}`,
      `${da.columns.account} = Kreditkort`,
      `${da.columns.category} = Café`,
    ]);
    expect(detailRows(d).map((r) => [text(r), r.getAttribute("aria-current")])).toEqual([
      [`${tableDate("2026-09-22")} Kreditkort +200,00 kr.`, "true"],
      [`${tableDate("2026-09-20")} Kreditkort -700,00 kr.`, null],
    ]);

    await click(app, getByRole(root, "button", { name: da.backTo(da.postingsTitle) }));
    const card = region(root, da.postingsTitle);
    const february = unitName(viewContext(linked(THIS_YEAR), DEFAULT_STATE, TODAY).units[1], "month");
    await click(app, getByRole(card, "button", { name: new RegExp(`^${february},`), expanded: false }));
    await click(app, rowButton(region(root, da.postingsTitle), "Kiosken"));
    d = detail(region(root, da.postingsTitle), "Kiosken");
    expect(text(d)).toContain(da.shopContext);
    expect(text(d)).toContain(tableDate("2026-02-14"));
    expect(text(d)).not.toContain(" · Kiosken");
    expect(detailRows(d).map(text)).toEqual([`${tableDate("2026-02-14")} Fælleskonto -150,00 kr.`]);
  });

  it("a refund reads with a plus in the head and in its row, as Posteringer writes it", async () => {
    const { app, root } = await mountLinked("card=postings");
    await click(app, rowButton(region(root, da.postingsTitle), "Pizzeria Roma", "2026-09-22"));
    const d = detail(region(root, da.postingsTitle), "Pizzeria Roma");
    const heading = getByRole(d, "heading", { level: 3 });
    expect(text(heading.nextElementSibling as Element)).toContain("+200,00 kr.");
    const marked = detailRows(d).find((r) => r.getAttribute("aria-current") === "true");
    expect(text(marked as HTMLElement)).toContain("+200,00 kr.");
  });

  it("the bars' text alternatives name each unit and its sum", async () => {
    const { app, root } = await mountLinked("card=subscriptions");
    await click(app, rowButton(region(root, da.subscriptions), "Husleje"));
    const d = detail(root, "Husleje");
    const bars = getByRole(d, "list", { name: da.detailPer("month") });
    const units = viewContext(linked(THIS_YEAR), DEFAULT_STATE, TODAY).units;
    expect(units).toHaveLength(10);
    const items = getAllByRole(bars, "listitem");
    expect(items).toHaveLength(units.length);
    units.forEach((u, i) => within(items[i]).getByText(`${unitName(u, "month")}: 8.000 kr.`));
  });

  it("10 rows and Vis alle N, then Vis færre", async () => {
    const extra = (i: number): Posting => ({
      id: `x${i}`,
      groupId: `gx${i}`,
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      text: "BAGERIET",
      account: "1",
      category: "Dagligvarer",
      shop: "Bageriet",
      kind: "spending",
      amount: 2500,
      subscription: null,
    });
    const { app, root } = await mount("card=postings", {
      answer: (range) => {
        const a = answerFor(range);
        return json({ ...a, postings: [...Array.from({ length: 12 }, (_, i) => extra(i)), ...a.postings] });
      },
    });
    await click(app, rowButton(region(root, da.postingsTitle), "Bageriet", "2026-10-12"));
    const d = detail(root, "Bageriet");
    expect(detailRows(d)).toHaveLength(10);
    await click(app, getByRole(d, "button", { name: da.showAllShops(12) }));
    expect(detailRows(d)).toHaveLength(12);
    await click(app, getByRole(d, "button", { name: da.showFewer }));
    expect(detailRows(d)).toHaveLength(10);
    getByRole(d, "button", { name: da.showAllShops(12) });
  });

  it("Ingen posteringer i perioden for a subscription not paid in the period, and 0 kr. in the first box", async () => {
    const { app, root } = await mountLinked("card=subscriptions");
    await click(app, rowButton(region(root, da.subscriptions), "Avis"));
    const d = detail(root, "Avis");
    expect(text(d)).toContain(da.noDetailRows);
    expect(queryByRole(d, "table")).toBeNull();
    expect(boxes(d)[0]).toBe(`${da.detailInPeriod(rangeText(THIS_YEAR))} = 0 kr. · ${count(0)}`);
  });

  it("Konto reads – with no last payment", async () => {
    const { app, root } = await mountLinked("card=subscriptions");
    await click(app, rowButton(region(root, da.subscriptions), "Avis"));
    const d = detail(root, "Avis");
    expect(boxes(d)[2]).toBe(`${da.columns.account} = ${da.noAccount}`);
    expect(text(d)).toContain("Faste udgifter");
    expect(text(d)).not.toContain(" · Faste udgifter");
  });

  it("Åbn i Firefly III links the bill or the posting, and is absent without fireflyLinkUrl", async () => {
    const { app, root } = await mountLinked("card=subscriptions&detail=s%3Ab1");
    const bill = getByRole(detail(root, "Husleje"), "link", { name: da.openInFirefly });
    expect(bill.getAttribute("href")).toBe(`${LINK}/bills/show/b1`);
    expect(bill.getAttribute("target")).toBe("_blank");
    expect(bill.getAttribute("rel")).toBe("noopener noreferrer");
    await click(app, getByRole(root, "button", { name: da.backTo(da.subscriptions) }));
    expect(queryByRole(region(root, da.subscriptions), "link")).toBeNull();
    unmount();

    const shop = await mountLinked("card=postings&detail=p%3Ap25");
    expect(getByRole(detail(shop.root, "Pizzeria Roma"), "link", { name: da.openInFirefly }).getAttribute("href")).toBe(
      `${LINK}/transactions/show/g25`,
    );
    expect(queryByRole(region(shop.root, da.postingsTitle), "link", { name: "Pizzeria Roma" })).toBeNull();
    unmount();

    const none = await mountLinked("card=subscriptions&detail=s%3Ab1", null);
    expect(queryByRole(detail(none.root, "Husleje"), "link")).toBeNull();
    unmount();

    const unsafe = await mountLinked("card=postings&detail=p%3Ap25", "javascript:alert(1)");
    expect(queryByRole(detail(unsafe.root, "Pizzeria Roma"), "link")).toBeNull();
  });

  it("each row in the detail links to its posting in Firefly III, and a click on the row opens it once", async () => {
    const opened: string[] = [];
    const original = window.open;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
    try {
      const { app, root } = await mountLinked("card=postings&detail=p%3Ap25");
      const rows = detailRows(detail(root, "Pizzeria Roma"));
      const dates = rows.map((r) => within(r).getByRole("link"));
      expect(dates.map((a) => a.getAttribute("href"))).toEqual([
        `${LINK}/transactions/show/g25`,
        `${LINK}/transactions/show/g24`,
      ]);
      expect(dates.every((a) => a.getAttribute("target") === "_blank")).toBe(true);
      fireEvent.click(rows[1], { detail: 1 });
      fireEvent.click(rows[1], { detail: 2 });
      fireEvent.dblClick(rows[1]);
      await settle(app);
      expect(opened).toEqual([`${LINK}/transactions/show/g24`]);
      unmount();

      const none = await mountLinked("card=postings&detail=p%3Ap25", null);
      expect(within(getByRole(detail(none.root, "Pizzeria Roma"), "table")).queryByRole("link")).toBeNull();
    } finally {
      window.open = original;
    }
  });

  it("a row's button opens, Escape closes, the focus is back on the button", async () => {
    const { app, root } = await mountLinked("card=postings");
    const button = rowButton(region(root, da.postingsTitle), "Café Søde", "2026-10-26");
    button.focus();
    expect(focused(app)).toBe(button);
    await click(app, button);
    const heading = getByRole(root, "heading", { level: 3, name: "Café Søde" });
    expect(focused(app)).toBe(heading);
    fireEvent.keyDown(heading, { key: "Escape" });
    await settle(app);
    expect(queryByRole(root, "heading", { level: 3 })).toBeNull();
    expect(focused(app)).toBe(rowButton(region(root, da.postingsTitle), "Café Søde", "2026-10-26"));
  });

  it("a click elsewhere on the row opens it once", async () => {
    const { app, root } = await mountLinked("card=postings");
    const length = history.length;
    const row = rowButton(region(root, da.postingsTitle), "Café Søde", "2026-10-26").closest("tr") as HTMLElement;
    await click(app, within(row).getByText("Kreditkort"));
    getByRole(root, "heading", { level: 3, name: "Café Søde" });
    expect(history.length).toBe(length + 1);
  });

  it("unticking the account of the open shop's postings closes the detail", async () => {
    const { app, root } = await mountLinked("card=postings&detail=p%3Ap25");
    getByRole(root, "heading", { level: 3, name: "Pizzeria Roma" });
    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.accounts}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(root, "checkbox", { name: "Kreditkort" }));
    await settle(app);
    expect(queryByRole(root, "heading", { level: 3 })).toBeNull();
    expect(location.hash).not.toContain("detail");
  });

  it("the period and the accounts change the sums; the search does not", async () => {
    const { app, root } = await mountLinked("card=subscriptions&detail=s%3Ab1");
    expect(boxes(detail(root, "Husleje"))[0]).toContain(`80.000 kr. · ${count(10)}`);
    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    await settle(app);
    expect(boxes(detail(root, "Husleje"))[0]).toContain(`8.000 kr. · ${count(1)}`);
    unmount();

    const ticked = await mountLinked("accounts=2&card=subscriptions&detail=s%3Ab1");
    expect(boxes(detail(ticked.root, "Husleje"))[0]).toContain(`0 kr. · ${count(0)}`);
    unmount();

    const plain = await mountLinked("card=postings&detail=p%3Ap25");
    const before = boxes(detail(plain.root, "Pizzeria Roma"));
    unmount();
    const searched = await mountLinked("card=postings&q=Netto&detail=p%3Ap25");
    expect(boxes(detail(searched.root, "Pizzeria Roma"))).toEqual(before);
  });
});
