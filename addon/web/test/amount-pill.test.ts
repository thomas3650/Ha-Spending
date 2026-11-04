import { fireEvent, getAllByRole, getByRole, getByText, queryAllByRole, queryByRole, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import "../src/components/amount-pill";
import type { AmountPill } from "../src/components/amount-pill";
import { da } from "../src/i18n/da";
import type { AmountFilter } from "../src/model/amount";

type Kind = AmountFilter["kind"];

async function render(amount: AmountFilter | null = null) {
  const el = document.createElement("hs-amount-pill") as AmountPill;
  el.amount = amount;
  const fired: (AmountFilter | null)[] = [];
  el.addEventListener("amount-change", (e) => fired.push((e as CustomEvent<AmountFilter | null>).detail));
  const outside = document.createElement("button");
  outside.textContent = "Elsewhere";
  document.body.append(el, outside);
  await el.updateComplete;
  return { el, fired };
}

function emptyButton(el: HTMLElement): HTMLElement {
  return getByRole(el, "button", { name: da.filterAmount });
}

function kindButton(el: HTMLElement): HTMLElement {
  return getByRole(el, "button", { name: da.amountKindButton });
}

function menu(el: HTMLElement): HTMLElement | null {
  return queryByRole(el, "group", { name: da.amountKindsLabel });
}

function field(el: HTMLElement, name: string): HTMLInputElement {
  return getByRole(el, "textbox", { name }) as HTMLInputElement;
}

async function press(el: AmountPill, button: HTMLElement) {
  button.focus();
  fireEvent.click(button);
  await settle(el);
}

async function settle(el: AmountPill) {
  for (let i = 0; i < 3; i++) {
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve));
  }
}

/** Opens the dropdown from either look of the pill and chooses a kind. */
async function choose(el: AmountPill, kind: Kind) {
  const opener = queryByRole(el, "button", { name: da.amountKindButton }) ?? emptyButton(el);
  await press(el, opener);
  const list = menu(el);
  if (list === null) throw new Error("the kinds did not open");
  await press(el, getByRole(list, "button", { name: da.amountKinds[kind] }));
}

async function type(el: AmountPill, input: HTMLInputElement, text: string) {
  input.focus();
  fireEvent.input(input, { target: { value: text } });
  await el.updateComplete;
}

async function enter(el: AmountPill, input: HTMLInputElement) {
  fireEvent.keyDown(input, { key: "Enter" });
  await settle(el);
}

async function leave(el: AmountPill) {
  getByRole(document.body, "button", { name: "Elsewhere" }).focus();
  await settle(el);
}

/**
 * Chrome fires focusout when it removes the focused element; happy-dom does not. This does, so a choice that
 * re-renders the pill under the focus is tested as Chrome runs it.
 */
function blurOnRemoval(el: AmountPill): MutationObserver {
  let focused: Element | null = null;
  el.addEventListener("focusin", (e) => (focused = e.target as Element));
  const observer = new MutationObserver((records) => {
    const gone = records.some((r) => [...r.removedNodes].some((n) => focused !== null && n.contains(focused)));
    if (!gone) return;
    focused = null;
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
  });
  observer.observe(el, { childList: true, subtree: true });
  return observer;
}

/**
 * A browser's mousedown: unless the page prevents it, the focus goes to the nearest focusable element under the
 * pointer, or to the body. Safari does not focus a button on a click, so it skips buttons.
 */
function mouseDown(target: Element, opts: { safari?: boolean } = {}) {
  if (!fireEvent.mouseDown(target)) return;
  for (let node: Element | null = target; node !== null; node = node.parentElement) {
    const focusable =
      node.hasAttribute("tabindex") || node instanceof HTMLInputElement || (!opts.safari && node instanceof HTMLButtonElement);
    if (focusable) {
      (node as HTMLElement).focus();
      return;
    }
  }
  (document.activeElement as HTMLElement | null)?.blur();
}

async function click(el: AmountPill, target: Element, opts: { safari?: boolean } = {}) {
  mouseDown(target, opts);
  fireEvent.click(target);
  await settle(el);
}

/** The element a Tab moves to: the next button or field in the page's order. */
function nextByTab(): Element | undefined {
  const order = [...queryAllByRole(document.body, "button"), ...queryAllByRole(document.body, "textbox")].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
  return order[order.indexOf(document.activeElement as HTMLElement) + 1];
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("the empty pill", () => {
  it("is a button named Filtrér på beløb that opens the kinds", async () => {
    const { el } = await render();
    const button = emptyButton(el);
    expect(button.textContent).toContain(da.kr);
    expect(button.getAttribute("aria-haspopup")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(menu(el)).toBeNull();

    await press(el, button);
    expect(emptyButton(el).getAttribute("aria-expanded")).toBe("true");
    expect(menu(el)).not.toBeNull();
  });

  it("lists the four kinds in order, with the hints for Omkring and Mellem", async () => {
    const { el } = await render();
    await press(el, emptyButton(el));
    const list = menu(el) as HTMLElement;
    const kinds = getAllByRole(list, "button");
    expect(kinds.map((k) => k.getAttribute("aria-label"))).toEqual([
      da.amountKinds.about,
      da.amountKinds.under,
      da.amountKinds.over,
      da.amountKinds.between,
    ]);
    expect(kinds[0].textContent).toContain(da.amountHints.about);
    expect(kinds[3].textContent).toContain(da.amountHints.between);
  });

  it("closes the kinds on Escape and gives the focus back to the button", async () => {
    const { el } = await render();
    await press(el, emptyButton(el));
    fireEvent.keyDown(getByRole(menu(el) as HTMLElement, "button", { name: da.amountKinds.under }), { key: "Escape" });
    await settle(el);
    expect(menu(el)).toBeNull();
    expect(document.activeElement).toBe(emptyButton(el));
  });
});

describe("choosing a kind", () => {
  it("closes the kinds and puts the focus in the number", async () => {
    const { el, fired } = await render();
    await choose(el, "about");
    expect(menu(el)).toBeNull();
    expect(document.activeElement).toBe(field(el, da.amountKinds.about));
    expect(kindButton(el).getAttribute("aria-haspopup")).toBeNull();
    expect(kindButton(el).getAttribute("aria-expanded")).toBe("false");
    expect(fired).toEqual([]);
  });

  it("marks the kind button expanded while its kinds are open", async () => {
    const { el } = await render();
    await choose(el, "about");
    await press(el, kindButton(el));
    expect(menu(el)).not.toBeNull();
    expect(kindButton(el).getAttribute("aria-expanded")).toBe("true");
  });

  it("applies the number on Enter, once", async () => {
    const { el, fired } = await render();
    await choose(el, "about");
    const input = field(el, da.amountKinds.about);
    await type(el, input, "800");
    await enter(el, input);
    expect(fired).toEqual([{ kind: "about", value: 80_000 }]);

    await leave(el);
    expect(fired).toHaveLength(1);
  });

  it("applies the number when the focus leaves the pill", async () => {
    const { el, fired } = await render();
    await choose(el, "under");
    await type(el, field(el, da.amountKinds.under), "4.000");
    expect(fired).toEqual([]);
    await leave(el);
    expect(fired).toEqual([{ kind: "under", value: 400_000 }]);
  });

  it("reads a Danish number with decimals", async () => {
    const { el, fired } = await render();
    await choose(el, "over");
    const input = field(el, da.amountKinds.over);
    await type(el, input, "1.000,5");
    await enter(el, input);
    expect(fired).toEqual([{ kind: "over", value: 100_050 }]);
  });

  it("shows the error for a number that does not parse, and applies nothing", async () => {
    const { el, fired } = await render();
    await choose(el, "over");
    const input = field(el, da.amountKinds.over);
    await type(el, input, "12,345");
    await enter(el, input);
    expect(queryByText(el, da.amountInvalid)).not.toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await leave(el);
    expect(fired).toEqual([]);

    await type(el, input, "12,34");
    expect(queryByText(el, da.amountInvalid)).toBeNull();
  });

  it("keeps the chosen kind when the focused option is removed under the focus", async () => {
    const { el, fired } = await render();
    const observer = blurOnRemoval(el);
    await choose(el, "about");
    expect(document.activeElement).toBe(field(el, da.amountKinds.about));
    await press(el, kindButton(el));
    const over = getByRole(menu(el) as HTMLElement, "button", { name: da.amountKinds.over });
    over.focus();
    fireEvent.keyDown(over, { key: "Escape" });
    await settle(el);
    expect(document.activeElement).toBe(kindButton(el));
    observer.disconnect();
    expect(fired).toEqual([]);
  });

  it("goes back to empty when the kind is left with no number", async () => {
    const { el, fired } = await render();
    await choose(el, "about");
    await leave(el);
    expect(fired).toEqual([]);
    expect(emptyButton(el)).toBeDefined();
    expect(queryByRole(el, "textbox")).toBeNull();
  });
});

describe("Mellem", () => {
  it("does not apply when the focus moves between its two fields", async () => {
    const { el, fired } = await render();
    await choose(el, "between");
    const first = field(el, da.amountMin);
    expect(document.activeElement).toBe(first);
    await type(el, first, "800");
    await type(el, field(el, da.amountMax), "1.200");
    expect(fired).toEqual([]);
    await leave(el);
    expect(fired).toEqual([{ kind: "between", min: 80_000, max: 120_000 }]);
  });

  it("needs both numbers, and Enter moves on to the empty one", async () => {
    const { el, fired } = await render();
    await choose(el, "between");
    const first = field(el, da.amountMin);
    await type(el, first, "800");
    await enter(el, first);
    expect(fired).toEqual([]);
    expect(document.activeElement).toBe(field(el, da.amountMax));
    await leave(el);
    expect(fired).toEqual([]);
    expect(emptyButton(el)).toBeDefined();
  });

  it("swaps bounds given in reverse", async () => {
    const { el, fired } = await render();
    await choose(el, "between");
    await type(el, field(el, da.amountMin), "1.200");
    const second = field(el, da.amountMax);
    await type(el, second, "800");
    await enter(el, second);
    expect(fired).toEqual([{ kind: "between", min: 80_000, max: 120_000 }]);
    expect(field(el, da.amountMin).value).toBe("800");
    expect(field(el, da.amountMax).value).toBe("1.200");
  });
});

describe("clicks inside the pill", () => {
  it("keeps a half-typed Mellem when the pill's own background is clicked", async () => {
    const { el, fired } = await render();
    await choose(el, "between");
    await type(el, field(el, da.amountMin), "800");
    await click(el, getByText(el, "–"));
    await click(el, getByText(el, da.kr));
    expect(fired).toEqual([]);
    expect(field(el, da.amountMin).value).toBe("800");
  });

  it("fires one null for Fjern beløb while a new number is typed, in Safari too", async () => {
    for (const safari of [false, true]) {
      const { el, fired } = await render({ kind: "over", value: 50_000 });
      await type(el, field(el, da.amountKinds.over), "700");
      await click(el, getByRole(el, "button", { name: da.removeAmount }), { safari });
      expect(fired).toEqual([null]);
      document.body.replaceChildren();
    }
  });

  it("opens the kinds without applying a typed number, in Safari too", async () => {
    for (const safari of [false, true]) {
      const { el, fired } = await render({ kind: "over", value: 50_000 });
      await type(el, field(el, da.amountKinds.over), "700");
      await click(el, kindButton(el), { safari });
      expect(menu(el)).not.toBeNull();
      expect(fired).toEqual([]);
      document.body.replaceChildren();
    }
  });
});

describe("the filled pill", () => {
  it("reaches the first kind with the first Tab after opening the kinds", async () => {
    const { el } = await render({ kind: "over", value: 50_000 });
    await press(el, kindButton(el));
    expect(nextByTab()).toBe(getByRole(menu(el) as HTMLElement, "button", { name: da.amountKinds.about }));
  });

  it("keeps the error while the number is still invalid after a switch", async () => {
    const { el, fired } = await render({ kind: "over", value: 50_000 });
    const input = field(el, da.amountKinds.over);
    await type(el, input, "abc");
    await enter(el, input);
    await choose(el, "under");
    expect(fired).toEqual([]);
    expect(queryByText(el, da.amountInvalid)).not.toBeNull();
    expect(field(el, da.amountKinds.under).getAttribute("aria-invalid")).toBe("true");
  });

  it("is named by its filter and shows its number", async () => {
    const { el } = await render({ kind: "about", value: 80_000 });
    const pill = getByRole(el, "group", { name: "Beløb: omkring 800 kr." });
    expect(field(pill, da.amountKinds.about).value).toBe("800");
    expect(pill.textContent).toContain(da.kr);
    expect(queryByRole(el, "button", { name: da.filterAmount })).toBeNull();
  });

  it("shows Mellem's two numbers", async () => {
    const { el } = await render({ kind: "between", min: 80_000, max: 120_000 });
    getByRole(el, "group", { name: "Beløb: 800–1.200 kr." });
    expect(field(el, da.amountMin).value).toBe("800");
    expect(field(el, da.amountMax).value).toBe("1.200");
  });

  it("switches an applied kind and keeps the number", async () => {
    const { el, fired } = await render({ kind: "about", value: 80_000 });
    await choose(el, "under");
    expect(fired).toEqual([{ kind: "under", value: 80_000 }]);
    expect(field(el, da.amountKinds.under).value).toBe("800");
    expect(document.activeElement).toBe(field(el, da.amountKinds.under));
  });

  it("makes the number Mellem's first bound and waits for the second", async () => {
    const { el, fired } = await render({ kind: "under", value: 80_000 });
    await choose(el, "between");
    expect(fired).toEqual([]);
    expect(field(el, da.amountMin).value).toBe("800");
    const second = field(el, da.amountMax);
    expect(second.value).toBe("");
    expect(document.activeElement).toBe(second);
    await type(el, second, "1.200");
    await enter(el, second);
    expect(fired).toEqual([{ kind: "between", min: 80_000, max: 120_000 }]);
  });

  it("goes back to the applied filter when Mellem is left with one number", async () => {
    const { el, fired } = await render({ kind: "under", value: 80_000 });
    await choose(el, "between");
    await leave(el);
    expect(fired).toEqual([]);
    const pill = getByRole(el, "group", { name: "Beløb: under 800 kr." });
    expect(field(pill, da.amountKinds.under).value).toBe("800");
  });

  it("keeps Mellem's first bound when it switches away", async () => {
    const { el, fired } = await render({ kind: "between", min: 80_000, max: 120_000 });
    await choose(el, "over");
    expect(fired).toEqual([{ kind: "over", value: 80_000 }]);
    expect(field(el, da.amountKinds.over).value).toBe("800");
  });

  it("marks the current kind in the list", async () => {
    const { el } = await render({ kind: "over", value: 50_000 });
    await press(el, kindButton(el));
    const list = menu(el) as HTMLElement;
    expect(getByRole(list, "button", { name: da.amountKinds.over }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole(list, "button", { name: da.amountKinds.under }).getAttribute("aria-pressed")).toBe("false");
  });

  it("clears when its number is removed", async () => {
    const { el, fired } = await render({ kind: "under", value: 400_000 });
    await type(el, field(el, da.amountKinds.under), "");
    await leave(el);
    expect(fired).toEqual([null]);
    expect(emptyButton(el)).toBeDefined();
  });

  it("clears on Fjern beløb and keeps the focus in the pill", async () => {
    const { el, fired } = await render({ kind: "over", value: 50_000 });
    await press(el, getByRole(el, "button", { name: da.removeAmount }));
    expect(fired).toEqual([null]);
    expect(document.activeElement).toBe(emptyButton(el));
    await leave(el);
    expect(fired).toEqual([null]);
  });

  it("follows a new amount from outside", async () => {
    const { el } = await render({ kind: "over", value: 50_000 });
    await type(el, field(el, da.amountKinds.over), "7");
    el.amount = { kind: "about", value: 10_000 };
    await settle(el);
    expect(field(el, da.amountKinds.about).value).toBe("100");
    el.amount = null;
    await settle(el);
    expect(emptyButton(el)).toBeDefined();
  });
});
