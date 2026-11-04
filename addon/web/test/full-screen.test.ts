import { unitAt } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, queryAllByRole, queryByRole, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { tableDate, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { answerFor, LINK, SUBSCRIPTIONS, withSubscriptions } from "./fixture";
import { json, mount, type MountOptions, settle, unmount } from "./mount";

afterEach(unmount);

const KEY_LABEL = da.inPeriod("Faste udgifter");
const JULY = unitName(unitAt("2026-07-01", "month", "2026-10-30"), "month");

function answerWith(range: Parameters<typeof answerFor>[0]): Response {
  return json({ ...withSubscriptions(answerFor(range), SUBSCRIPTIONS), fireflyLinkUrl: LINK });
}

function mountWith(hash: string, answer?: MountOptions["answer"]) {
  return mount(hash, { answer: answer ?? ((range) => answerWith(range)) });
}

function fullScreen(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: da.fullScreen });
}

function pressed(root: HTMLElement): string | null {
  return fullScreen(root).getAttribute("aria-pressed");
}

async function press(app: SpendingApp, root: HTMLElement): Promise<HTMLElement> {
  const button = fullScreen(root);
  button.focus();
  fireEvent.click(button);
  await settle(app);
  return button;
}

async function hashBecomes(app: SpendingApp, hash: string): Promise<void> {
  await vi.waitFor(() => expect(location.hash).toBe(hash));
  await settle(app);
}

async function escape(app: SpendingApp, target: Element): Promise<void> {
  fireEvent.keyDown(target, { key: "Escape" });
  await settle(app);
}

function leftCard(root: HTMLElement): HTMLElement | null {
  return queryByRole(root, "region", { name: da.mainGroups });
}

function keyNumbers(root: HTMLElement): HTMLElement | null {
  return queryByRole(root, "group", { name: da.spendingInPeriod });
}

function subscriptionsKey(root: HTMLElement): HTMLElement | null {
  return queryByRole(root, "group", { name: KEY_LABEL });
}

function expectOn(root: HTMLElement): void {
  expect(pressed(root)).toBe("true");
  expect(leftCard(root)).toBeNull();
  expect(keyNumbers(root)).toBeNull();
}

function expectOff(root: HTMLElement): void {
  expect(pressed(root)).toBe("false");
  expect(leftCard(root)).not.toBeNull();
  expect(keyNumbers(root)).not.toBeNull();
}

function periodButton(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: new RegExp(`^${da.period}`) });
}

async function choosePreset(root: HTMLElement, app: SpendingApp, name: string) {
  fireEvent.click(periodButton(root));
  await app.updateComplete;
  fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name }));
  await settle(app);
}

describe("full screen in the hash", () => {
  const tab = (root: HTMLElement, name: string) =>
    getByRole(getByRole(root, "group", { name: da.view }), "button", { name });

  it("⤢ writes view=full in one new entry, and Back leaves it", async () => {
    const { app, root } = await mount("card=postings");
    const length = history.length;
    await press(app, root);
    expect(location.hash).toBe("#card=postings&view=full");
    expect(history.length).toBe(length + 1);
    expectOn(root);
    history.back();
    await hashBecomes(app, "#card=postings");
    expectOff(root);
  });

  it("a reload of view=full opens in full screen", async () => {
    const { root } = await mount("card=postings&view=full");
    expectOn(root);
    getByRole(root, "region", { name: da.postingsTitle });
  });

  it("⤡ goes back to the entry before ⤢", async () => {
    const { app, root } = await mount("card=postings");
    await press(app, root);
    await press(app, root);
    await hashBecomes(app, "#card=postings");
    expectOff(root);
    history.forward();
    await hashBecomes(app, "#card=postings&view=full");
    expectOn(root);
  });

  it("⤢, typing in the search, ⤡: not full screen, the search stays, and Back is not full screen", async () => {
    const { app, root } = await mount("");
    fireEvent.click(tab(root, da.postings));
    await settle(app);
    await press(app, root);
    const box = getByRole(root, "combobox", { name: da.searchLabel });
    fireEvent.input(box, { target: { value: "Netto" } });
    await settle(app);
    expect(location.hash).toBe("#card=postings&view=full&q=Netto");
    await press(app, root);
    await hashBecomes(app, "#card=postings&q=Netto");
    expectOff(root);
    expect((getByRole(root, "combobox", { name: da.searchLabel }) as HTMLInputElement).value).toBe("Netto");
    history.back();
    await hashBecomes(app, "");
    expectOff(root);
  });

  it("⤢, then Søjler, then ⤡ replaces the entry", async () => {
    const { app, root } = await mount("card=postings");
    await press(app, root);
    fireEvent.click(tab(root, da.bars));
    await settle(app);
    expect(location.hash).toBe("#view=full");
    const length = history.length;
    await press(app, root);
    expect(location.hash).toBe("");
    expect(history.length).toBe(length);
    expectOff(root);
  });
});

describe("Posteringer in full screen", () => {
  const card = (root: HTMLElement) => getByRole(root, "region", { name: da.postingsTitle });
  const postingRows = (root: HTMLElement) => getAllByRole(card(root), "row").filter((r) => within(r).queryAllByRole("cell").length > 0);
  const firstRow = (root: HTMLElement) => postingRows(root)[0].textContent ?? "";

  it("shows the Kategori column with each row's category, and the normal card does not", async () => {
    const { app, root } = await mountWith("card=postings");
    expect(queryByRole(card(root), "columnheader", { name: da.columns.category })).toBeNull();
    await press(app, root);
    getByRole(card(root), "columnheader", { name: da.columns.category });
    expect(getAllByRole(card(root), "cell", { name: /Café/ }).length).toBeGreaterThan(0);
  });

  it("has no Kategori column in full screen below 600 px, and no sort by it", async () => {
    const happy = (window as unknown as { happyDOM: { setViewport(s: { width: number; height: number }): void } }).happyDOM;
    happy.setViewport({ width: 420, height: 768 });
    try {
      const { app, root } = await mountWith("card=postings");
      await press(app, root);
      expect(queryByRole(card(root), "columnheader", { name: da.columns.category })).toBeNull();
    } finally {
      happy.setViewport({ width: 1024, height: 768 });
    }
  });

  it("has no Vis alle, in full screen or in the normal card", async () => {
    const { app, root } = await mountWith("card=postings");
    expect(queryByRole(root, "button", { name: "Vis alle" })).toBeNull();
    await press(app, root);
    expect(queryByRole(root, "button", { name: "Vis alle" })).toBeNull();
  });

  it("falls back to the newest first when Kategori was the sort and full screen ends", async () => {
    const { app, root } = await mountWith("card=postings");
    await press(app, root);
    fireEvent.click(getByRole(card(root), "button", { name: da.columns.category }));
    await settle(app);
    expect(getByRole(card(root), "columnheader", { name: da.columns.category }).getAttribute("aria-sort")).not.toBeNull();
    expect(firstRow(root)).not.toContain("Café Søde");
    await press(app, root);
    expect(firstRow(root)).toContain("Café Søde");
    await press(app, root);
    expect(getByRole(card(root), "columnheader", { name: da.columns.category }).getAttribute("aria-sort")).not.toBeNull();
  });
});

describe("the right card in full screen", () => {
  it.each([
    ["Søjler", "", da.per("month")],
    ["Posteringer", "card=postings", da.postingsTitle],
    ["Faste udgifter", "card=subscriptions", da.subscriptions],
  ])("offers the button in the right card on %s", async (_, hash, title) => {
    const { root } = await mountWith(hash);
    const card = getByRole(root, "region", { name: title });
    const button = within(card).getByRole("button", { name: da.fullScreen });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    const viewSwitch = getByRole(card, "group", { name: da.view });
    expect(within(viewSwitch).queryByRole("button", { name: da.fullScreen })).toBeNull();
  });

  it("leaves out the left card and the key numbers, and keeps the focus on the same button", async () => {
    const { app, root } = await mountWith("");
    expect(subscriptionsKey(root)).not.toBeNull();

    const button = await press(app, root);
    expectOn(root);
    expect(subscriptionsKey(root)).toBeNull();
    expect(app.shadowRoot?.activeElement).toBe(button);
    expect(fullScreen(root)).toBe(button);

    fireEvent.click(button);
    await settle(app);
    expectOff(root);
    expect(subscriptionsKey(root)).not.toBeNull();
    expect(app.shadowRoot?.activeElement).toBe(button);
  });

  it("turns off on Escape on the overview", async () => {
    const { app, root } = await mount("");
    const button = await press(app, root);
    await escape(app, button);
    expectOff(root);
    expect(location.hash).toBe("");
  });

  it("an old link to Alle posteringer opens Posteringer in full screen, newest first, and Escape leaves it", async () => {
    const { app, root } = await mount("view=all-postings&sort=oldest&og=Abonnementer");
    expectOn(root);
    const card = getByRole(root, "region", { name: da.postingsTitle });
    expect(queryByRole(root, "heading", { level: 1, name: /Alle posteringer/ })).toBeNull();
    const date = getByRole(card, "columnheader", { name: da.columns.unitAndDate("month") });
    expect(date.getAttribute("aria-sort")).toBe("descending");
    await escape(app, document.body);
    expect(location.hash).toBe("#card=postings");
    expectOff(root);
  });

  it("keeps full screen when Escape closes the search's suggestions", async () => {
    const { app, root } = await mount("card=postings");
    await press(app, root);
    const box = getByRole(root, "combobox", { name: da.searchLabel });
    box.focus();
    fireEvent.input(box, { target: { value: "n" } });
    await settle(app);
    getByRole(root, "listbox", { name: da.suggestions });
    await escape(app, box);
    expect(queryByRole(root, "listbox", { name: da.suggestions })).toBeNull();
    expectOn(root);
  });

  it("keeps full screen when Escape closes a dropdown", async () => {
    const { app, root } = await mount("");
    await press(app, root);
    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.accounts}`) }));
    await app.updateComplete;
    const box = getByRole(root, "checkbox", { name: da.allAccounts });
    box.focus();
    await escape(app, box);
    expect(queryByRole(root, "checkbox", { name: da.allAccounts })).toBeNull();
    expectOn(root);
  });

  it("stays on after a bar click", async () => {
    const { app, root } = await mount("");
    await press(app, root);
    const bars = getByRole(root, "region", { name: da.per("month") });
    fireEvent.click(getByRole(bars, "button", { name: new RegExp(`^${JULY},`) }));
    await settle(app);
    expect(location.hash).toBe("#unit=2026-07-01&card=postings&view=full");
    expectOn(root);
  });

  it("stays on, with the same button, when the card's view changes", async () => {
    const { app, root } = await mountWith("card=subscriptions");
    const button = await press(app, root);
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.bars }));
    await settle(app);
    getByRole(root, "region", { name: da.per("month") });
    expect(fullScreen(root)).toBe(button);
    expectOn(root);
  });

  it("stays on through a period change, with one placeholder while loading", async () => {
    let release: () => void = () => {};
    const { app, root } = await mount("", {
      answer: (range, n) =>
        n === 1
          ? json(answerFor(range))
          : new Promise<Response>((resolve) => {
              release = () => resolve(json(answerFor(range)));
            }),
    });
    await press(app, root);
    await choosePreset(root, app, da.presets.lastYear);
    const busy = getAllByRole(root, "region", { name: da.loading });
    expect(busy).toHaveLength(1);
    expect(busy[0].getAttribute("aria-busy")).toBe("true");
    expect(queryAllByRole(root, "group", { name: da.loading })).toEqual([]);
    release();
    await settle(app);
    expectOn(root);
  });

  it("stays on after a failed load and the next good one", async () => {
    const { app, root } = await mountWith("", (range, n) =>
      n === 2 ? json({ error: "failed" }, 500) : answerWith(range),
    );
    await press(app, root);
    await choosePreset(root, app, da.presets.lastYear);
    getByRole(root, "alert");
    await choosePreset(root, app, da.presets.lastMonth);
    expectOn(root);
    expect(subscriptionsKey(root)).toBeNull();
  });
});

describe("the detail in full screen", () => {
  function postingsCard(root: HTMLElement): HTMLElement {
    return getByRole(root, "region", { name: da.postingsTitle });
  }

  /** The list's row with that date and a button with that name. */
  function rowButton(root: HTMLElement, name: string, date: string): HTMLElement {
    const rows = getAllByRole(postingsCard(root), "row").filter(
      (r) => (r.textContent ?? "").includes(tableDate(date)) && within(r).queryByRole("button", { name }),
    );
    if (rows.length !== 1) throw new Error(`${rows.length} rows with ${name} ${date}`);
    return within(rows[0]).getByRole("button", { name });
  }

  function current(button: HTMLElement): string | null {
    return (button.closest("tr") as HTMLElement).getAttribute("aria-current");
  }

  it("in full screen the list and the detail are both shown, the row is aria-current, another row changes the detail, and Luk closes it", async () => {
    const { app, root } = await mountWith("card=postings");
    await press(app, root);
    fireEvent.click(rowButton(root, "Café Søde", "2026-10-26"));
    await settle(app);
    const card = postingsCard(root);
    const cafe = getByRole(card, "group", { name: "Café Søde" });
    expect(app.shadowRoot?.activeElement).toBe(getByRole(cafe, "heading", { level: 3 }));
    getByRole(card, "combobox", { name: da.searchLabel });
    expect(current(rowButton(root, "Café Søde", "2026-10-26"))).toBe("true");
    expect(queryByRole(card, "button", { name: da.backTo(da.postingsTitle) })).toBeNull();

    fireEvent.click(rowButton(root, "Pizzeria Roma", "2026-09-22"));
    await settle(app);
    const roma = getByRole(card, "group", { name: "Pizzeria Roma" });
    expect(queryByRole(card, "group", { name: "Café Søde" })).toBeNull();
    expect(app.shadowRoot?.activeElement).toBe(getByRole(roma, "heading", { level: 3 }));
    expect(current(rowButton(root, "Pizzeria Roma", "2026-09-22"))).toBe("true");
    expect(current(rowButton(root, "Café Søde", "2026-10-26"))).toBeNull();

    fireEvent.click(getByRole(roma, "button", { name: da.close }));
    await settle(app);
    expect(location.hash).toBe("#card=postings&view=full");
    expect(queryByRole(root, "heading", { level: 3 })).toBeNull();
    expect(app.shadowRoot?.activeElement).toBe(rowButton(root, "Pizzeria Roma", "2026-09-22"));
    expectOn(root);
  });

  it("turning full screen off and on keeps the detail", async () => {
    const { app, root } = await mountWith("card=postings&detail=p%3Ap25");
    const shown = (): number => queryAllByRole(postingsCard(root), "button", { name: "Café Søde" }).length;
    getByRole(postingsCard(root), "group", { name: "Pizzeria Roma" });
    expect(shown()).toBe(0);

    const button = await press(app, root);
    expectOn(root);
    getByRole(postingsCard(root), "group", { name: "Pizzeria Roma" });
    expect(shown()).toBeGreaterThan(0);
    expect(app.shadowRoot?.activeElement).toBe(button);

    await press(app, root);
    expectOff(root);
    getByRole(postingsCard(root), "group", { name: "Pizzeria Roma" });
    expect(shown()).toBe(0);
    expect(app.shadowRoot?.activeElement).toBe(button);
    expect(location.hash).toBe("#card=postings&detail=p%3Ap25");
  });

  it("with a detail open, the list has no Konto column, and it comes back when the detail closes", async () => {
    const { app, root } = await mountWith("card=postings");
    await press(app, root);
    getByRole(postingsCard(root), "columnheader", { name: da.columns.account });
    fireEvent.click(rowButton(root, "Café Søde", "2026-10-26"));
    await settle(app);
    const card = postingsCard(root);
    getByRole(card, "group", { name: "Café Søde" });
    expect(queryByRole(card, "columnheader", { name: da.columns.account })).toBeNull();
    const tables = getAllByRole(card, "table");
    const list = tables.find((t) => queryByRole(t, "columnheader", { name: da.columns.category }));
    if (list === undefined) throw new Error("no table with Kategori");
    expect(queryAllByRole(list, "cell", { name: "Kreditkort" })).toEqual([]);
    fireEvent.click(getByRole(getByRole(card, "group", { name: "Café Søde" }), "button", { name: da.close }));
    await settle(app);
    getByRole(postingsCard(root), "columnheader", { name: da.columns.account });
  });

  it("a sort by Konto falls back to the date while the detail hides the column, and returns after", async () => {
    const { app, root } = await mountWith("card=postings");
    await press(app, root);
    fireEvent.click(getByRole(postingsCard(root), "button", { name: da.columns.account }));
    await settle(app);
    const sortOf = (name: string) => getByRole(postingsCard(root), "columnheader", { name }).getAttribute("aria-sort");
    expect(sortOf(da.columns.account)).not.toBeNull();
    fireEvent.click(getAllByRole(postingsCard(root), "button", { name: "Café Søde" })[0]);
    await settle(app);
    expect(sortOf(da.columns.unitAndDate("month"))).toBe("descending");
    fireEvent.click(getByRole(getByRole(postingsCard(root), "group", { name: "Café Søde" }), "button", { name: da.close }));
    await settle(app);
    expect(sortOf(da.columns.account)).not.toBeNull();
  });

  it("closing with the row filtered out puts the focus on the card's heading", async () => {
    const { app, root } = await mountWith("card=postings");
    await press(app, root);
    fireEvent.click(rowButton(root, "Café Søde", "2026-10-26"));
    await settle(app);
    const box = getByRole(postingsCard(root), "combobox", { name: da.searchLabel });
    fireEvent.input(box, { target: { value: "netto" } });
    await settle(app);
    const cafe = getByRole(postingsCard(root), "group", { name: "Café Søde" });
    expect(queryAllByRole(postingsCard(root), "button", { name: "Café Søde" })).toEqual([]);
    fireEvent.click(getByRole(cafe, "button", { name: da.close }));
    await settle(app);
    const heading = getByRole(postingsCard(root), "heading", { level: 2, name: da.postingsTitle });
    expect(app.shadowRoot?.activeElement).toBe(heading);
  });

  it("toggling full screen with a detail opened by a row leaves the focus on the button", async () => {
    const { app, root } = await mountWith("card=postings");
    fireEvent.click(rowButton(root, "Café Søde", "2026-10-26"));
    await settle(app);
    const button = await press(app, root);
    getByRole(postingsCard(root), "group", { name: "Café Søde" });
    expect(app.shadowRoot?.activeElement).toBe(button);
    await press(app, root);
    expect(app.shadowRoot?.activeElement).toBe(button);
  });
});

describe("leaving full screen", () => {
  it("puts the focus on the right card's heading when the opening link is gone", async () => {
    const { app, root } = await mountWith("");
    fireEvent.click(getAllByRole(root, "link", { name: /posteringer →$/ })[0] as HTMLElement);
    await settle(app);
    expect(pressed(root)).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    await settle(app, 5);
    expect(pressed(root)).toBe("false");
    expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 2, name: da.per("month") }));
  });
});
