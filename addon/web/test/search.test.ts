import { fireEvent, getAllByRole, getByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import "../src/components/search";
import type { Search } from "../src/components/search";
import { kr, postingAmount } from "../src/format";
import { da } from "../src/i18n/da";
import type { ShopSuggestion } from "../src/model/filter";

const SUGGESTIONS: ShopSuggestion[] = [
  { name: "Netto", sum: 315000 },
  { name: "Nordisk Café", sum: 4500 },
  { name: "Nørrebro Cykler", sum: -20000 },
];

interface Fired {
  name: string;
  detail: unknown;
}

async function render(props: { search?: string; shop?: string | null; suggestions?: ShopSuggestion[] } = {}) {
  const el = document.createElement("hs-search") as Search;
  el.search = props.search ?? "n";
  el.shop = props.shop ?? null;
  el.suggestions = props.suggestions ?? SUGGESTIONS;
  const fired: Fired[] = [];
  for (const name of ["search-input", "shop-choose", "shop-remove"]) {
    el.addEventListener(name, (e) => fired.push({ name, detail: (e as CustomEvent).detail }));
  }
  document.body.append(el);
  await el.updateComplete;
  return { el, fired };
}

function field(el: HTMLElement): HTMLInputElement {
  return getByRole(el, "combobox", { name: da.searchLabel }) as HTMLInputElement;
}

async function focus(el: Search) {
  field(el).focus();
  await el.updateComplete;
}

async function key(el: Search, k: string) {
  fireEvent.keyDown(field(el), { key: k });
  await el.updateComplete;
}

function list(el: HTMLElement): HTMLElement | null {
  return queryByRole(el, "listbox", { name: da.suggestions });
}

function highlighted(el: HTMLElement): HTMLElement | null {
  return queryByRole(el, "option", { selected: true });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("the search field with shop suggestions", () => {
  it("is a combobox with the placeholder and the typed text", async () => {
    const { el } = await render({ search: "net" });
    const box = field(el);
    expect(box.getAttribute("placeholder")).toBe(da.search);
    expect(box.value).toBe("net");
    expect(box.getAttribute("aria-expanded")).toBe("false");
  });

  it("offers the shops while the field has focus, each named by its name and sum", async () => {
    const { el } = await render();
    expect(list(el)).toBeNull();
    await focus(el);
    expect(field(el).getAttribute("aria-expanded")).toBe("true");
    const options = getAllByRole(list(el) as HTMLElement, "option");
    expect(options).toEqual([
      getByRole(el, "option", { name: da.shopOption("Netto", kr(315000)) }),
      getByRole(el, "option", { name: da.shopOption("Nordisk Café", kr(4500)) }),
      getByRole(el, "option", { name: da.shopOption("Nørrebro Cykler", postingAmount(-20000)) }),
    ]);
    expect(options[0]?.textContent).toContain("Netto");
    expect(options[0]?.textContent).toContain(kr(315000));
    expect(options[2]?.textContent).toContain("+200,00");
  });

  it("reads a net of zero as a posting amount", async () => {
    const { el } = await render({ suggestions: [{ name: "Netto", sum: 0 }] });
    await focus(el);
    getByRole(el, "option", { name: da.shopOption("Netto", postingAmount(0)) });
  });

  it("offers nothing with no suggestions", async () => {
    const { el } = await render({ suggestions: [] });
    await focus(el);
    expect(list(el)).toBeNull();
    expect(field(el).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when the field loses focus", async () => {
    const { el } = await render();
    await focus(el);
    fireEvent.focusOut(field(el));
    await el.updateComplete;
    expect(list(el)).toBeNull();
  });

  it("fires the typed text", async () => {
    const { el, fired } = await render();
    fireEvent.input(field(el), { target: { value: "ne" } });
    expect(fired).toEqual([{ name: "search-input", detail: "ne" }]);
  });

  it("moves the highlight with the arrow keys and chooses with Enter", async () => {
    const { el, fired } = await render();
    await focus(el);
    expect(highlighted(el)).toBeNull();
    expect(field(el).hasAttribute("aria-activedescendant")).toBe(false);
    await key(el, "ArrowDown");
    expect(highlighted(el)?.getAttribute("aria-label")).toBe(da.shopOption("Netto", kr(315000)));
    expect(field(el).getAttribute("aria-activedescendant")).toBe(highlighted(el)?.id);
    await key(el, "ArrowDown");
    await key(el, "ArrowDown");
    expect(highlighted(el)?.getAttribute("aria-label")).toBe(da.shopOption("Nørrebro Cykler", postingAmount(-20000)));
    await key(el, "ArrowDown");
    expect(highlighted(el)?.getAttribute("aria-label")).toBe(da.shopOption("Netto", kr(315000)));
    await key(el, "ArrowUp");
    expect(highlighted(el)?.getAttribute("aria-label")).toBe(da.shopOption("Nørrebro Cykler", postingAmount(-20000)));
    await key(el, "ArrowUp");
    await key(el, "Enter");
    expect(fired).toEqual([{ name: "shop-choose", detail: "Nordisk Café" }]);
    expect(document.activeElement).toBe(field(el));
  });

  it("closes on Enter with no highlight, and fires nothing", async () => {
    const { el, fired } = await render();
    await focus(el);
    await key(el, "Enter");
    expect(list(el)).toBeNull();
    expect(fired).toEqual([]);
  });

  it("closes on Escape, and the next input opens it again", async () => {
    const { el } = await render();
    await focus(el);
    await key(el, "Escape");
    expect(list(el)).toBeNull();
    expect(field(el).getAttribute("aria-expanded")).toBe("false");
    fireEvent.input(field(el), { target: { value: "no" } });
    await el.updateComplete;
    expect(list(el)).not.toBeNull();
  });

  it("chooses an option on a click and focuses the field again", async () => {
    const { el, fired } = await render();
    await focus(el);
    fireEvent.click(getByRole(el, "option", { name: da.shopOption("Netto", kr(315000)) }));
    expect(fired).toEqual([{ name: "shop-choose", detail: "Netto" }]);
    expect(document.activeElement).toBe(field(el));
  });

  it("chooses an option on a tap although the field loses focus first", async () => {
    const { el, fired } = await render();
    await focus(el);
    const option = getByRole(el, "option", { name: da.shopOption("Netto", kr(315000)) });
    fireEvent.pointerDown(option);
    fireEvent.focusOut(field(el));
    await el.updateComplete;
    fireEvent.click(getByRole(el, "option", { name: da.shopOption("Netto", kr(315000)) }));
    expect(fired).toEqual([{ name: "shop-choose", detail: "Netto" }]);
  });

  it("keeps the focus in the field when the list is pressed", async () => {
    const { el } = await render();
    await focus(el);
    const option = getByRole(el, "option", { name: da.shopOption("Netto", kr(315000)) });
    expect(fireEvent.mouseDown(option)).toBe(false);
  });

  it("closes on a focus loss after the pointer is lifted", async () => {
    const { el } = await render();
    await focus(el);
    fireEvent.pointerDown(getByRole(el, "option", { name: da.shopOption("Netto", kr(315000)) }));
    fireEvent.pointerUp(document.body);
    fireEvent.focusOut(field(el));
    await el.updateComplete;
    expect(list(el)).toBeNull();
  });

  describe("with a chosen shop", () => {
    it("shows the chip in front of the field and offers nothing", async () => {
      const { el } = await render({ search: "n", shop: "Netto" });
      await focus(el);
      getByRole(el, "button", { name: da.remove(da.shopChip("Netto")) });
      expect(list(el)).toBeNull();
    });

    it("removes the shop from the chip", async () => {
      const { el, fired } = await render({ search: "", shop: "Netto" });
      fireEvent.click(getByRole(el, "button", { name: da.remove(da.shopChip("Netto")) }));
      expect(fired).toEqual([{ name: "shop-remove", detail: "click" }]);
    });

    it("removes the shop on Backspace in an empty field only", async () => {
      const { el, fired } = await render({ search: "", shop: "Netto" });
      await key(el, "Backspace");
      expect(fired).toEqual([{ name: "shop-remove", detail: "key" }]);
      fired.length = 0;
      el.search = "4521";
      await el.updateComplete;
      await key(el, "Backspace");
      expect(fired).toEqual([]);
    });
  });

  it("does nothing on Backspace in an empty field with no shop", async () => {
    const { el, fired } = await render({ search: "" });
    await key(el, "Backspace");
    expect(fired).toEqual([]);
  });
});
