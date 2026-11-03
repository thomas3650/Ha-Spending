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
  return queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) });
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

  it("leaves out the left card and the key numbers, keeps the focus, and touches no history", async () => {
    const { app, root } = await mountWith("");
    const hash = location.hash;
    const push = vi.spyOn(history, "pushState");
    const replace = vi.spyOn(history, "replaceState");
    expect(subscriptionsKey(root)).not.toBeNull();

    const button = await press(app, root);
    expectOn(root);
    expect(subscriptionsKey(root)).toBeNull();
    expect(app.shadowRoot?.activeElement).toBe(button);
    expect(fullScreen(root)).toBe(button);
    expect(location.hash).toBe(hash);

    fireEvent.click(button);
    await settle(app);
    expectOff(root);
    expect(subscriptionsKey(root)).not.toBeNull();
    expect(app.shadowRoot?.activeElement).toBe(button);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("turns off on Escape on the overview", async () => {
    const { app, root } = await mount("");
    const button = await press(app, root);
    await escape(app, button);
    expectOff(root);
  });

  it("does nothing on Escape on Alle posteringer, and is still on when coming back", async () => {
    const { app, root } = await mount("card=postings");
    await press(app, root);
    fireEvent.click(getByRole(root, "button", { name: da.showAll }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: da.allPostings });
    await escape(app, document.body);
    fireEvent.click(getByRole(getByRole(root, "navigation", { name: da.trail }), "link", { name: da.allSpending }));
    await settle(app);
    expectOn(root);
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
    expect(location.hash).toBe("#unit=2026-07-01&card=postings");
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
    expect(location.hash).toBe("#card=postings");
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
