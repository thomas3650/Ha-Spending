import { type Posting, share, unitAt } from "@ha-spending/shared";
import {
  fireEvent,
  getAllByRole,
  queryAllByRole,
  getAllByText,
  getAllByTitle,
  getByRole,
  getByText,
  queryByRole,
  queryByText,
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { count, kr, partLabel, postingAmount, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import type { AmountFilter } from "../src/model/amount";
import { answerFor } from "./fixture";
import { json, mount, settle, unmount } from "./mount";
import { plainSummary, showingSummary } from "./summary";

const TODAY = "2026-10-30";
const TOTAL = 11566012;

afterEach(unmount);

function circleCard(root: HTMLElement): HTMLElement {
  return getByRole(root, "region", { name: da.mainGroups });
}

function viewSwitch(root: HTMLElement): HTMLElement {
  return getByRole(root, "group", { name: da.view });
}

function barButtons(region: HTMLElement): HTMLElement[] {
  return getAllByRole(region, "listitem").map((item) => getByRole(item, "button"));
}

describe("screen 1, all spending", () => {
  it("shows every main group in the circle with its amount and share", async () => {
    const { root } = await mount("");
    const card = circleCard(root);
    getByRole(card, "heading", { name: da.mainGroups });
    expect(getAllByText(card, kr(TOTAL))).toHaveLength(2);
    const parts: [string, number][] = [
      ["Bolig", 8000000],
      ["Mad", 3281012],
      ["Bil", 150000],
      [da.noMainGroup, 135000],
    ];
    const names = parts.map(([name, amount]) => partLabel(name, amount, share(amount, TOTAL)));
    expect(getAllByRole(card, "button")).toEqual(names.map((name) => getByRole(card, "button", { name })));
  });

  it("the three help texts are gone", async () => {
    const { app, root } = await mount("");
    const texts = [
      "Klik på et stykke eller et navn for at gå til hovedgruppen.",
      'Grupperet pr. måned, som "Gruppér pr.".',
      "klik på en søjle for kun den måned",
    ];
    for (const text of texts) expect(queryByText(root, text)).toBeNull();
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    for (const text of texts) expect(queryByText(root, text)).toBeNull();
  });

  it("opens a main group", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(circleCard(root), "button", { name: new RegExp("^Mad,") }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: "Mad" });
    expect(location.hash).toBe("#group=Mad");
  });

  it("opens Uden hovedgruppe", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(circleCard(root), "button", { name: new RegExp(`^${da.noMainGroup},`) }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: da.noMainGroup });
    expect(location.hash).toBe("#group=");
  });

  it("shows the bars per month with the average", async () => {
    const { root } = await mount("");
    const card = getByRole(root, "region", { name: da.per("month") });
    getByRole(card, "heading", { name: da.per("month") });
    expect(barButtons(card)).toHaveLength(10);
    getByText(card, da.average(kr(1159444)));
    expect(getByRole(viewSwitch(root), "button", { name: da.bars }).getAttribute("aria-pressed")).toBe("true");
  });

  it("switches to the postings and back", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    expect(getByRole(viewSwitch(root), "button", { name: da.postings }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole(viewSwitch(root), "button", { name: da.bars }).getAttribute("aria-pressed")).toBe("false");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    const oct = unitAt("2026-10-01", "month", TODAY);
    expect(getByRole(card, "button", { name: new RegExp(`^${unitName(oct, "month")},`) }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(location.hash).toBe("#card=postings");

    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    expect(barButtons(getByRole(root, "region", { name: da.per("month") }))).toHaveLength(10);
    expect(location.hash).toBe("");
  });

  it("orders the switch Søjler, Posteringer, Butikker", async () => {
    const { root } = await mount("");
    const names = getAllByRole(viewSwitch(root), "button").map((b) => b.textContent?.trim());
    expect(names).toEqual([da.bars, da.postings, da.shops]);
  });
});

describe("the search on Posteringer", () => {
  const ALL = 28;

  function searchbox(root: HTMLElement): HTMLInputElement {
    return getByRole(root, "combobox", { name: da.searchLabel }) as HTMLInputElement;
  }

  async function type(app: SpendingApp, root: HTMLElement, text: string) {
    fireEvent.input(searchbox(root), { target: { value: text } });
    await settle(app);
  }

  function postingTexts(card: HTMLElement): string[] {
    return getAllByRole(card, "row")
      .filter((r) => queryAllByRole(r, "cell").length > 0)
      .map((r) => getByRole(r, "button").textContent?.trim() ?? "");
  }

  function keyNumberTexts(root: HTMLElement): string[] {
    return getAllByRole(root, "group")
      .filter((g) => g.getAttribute("aria-label") !== da.view)
      .map((g) => g.textContent?.replace(/\s+/g, " ").trim() ?? "");
  }

  it("filters the rows as you type, with the count and sum, and no history entry per key", async () => {
    const { app, root } = await mount("card=postings");
    const box = searchbox(root);
    expect(box.getAttribute("placeholder")).toBe(da.search);
    plainSummary(root, ALL, TOTAL);
    const replace = vi.spyOn(history, "replaceState");
    const push = vi.spyOn(history, "pushState");
    await type(app, root, "roma");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    expect(postingTexts(card)).toEqual(["Pizzeria Roma", "Pizzeria Roma"]);
    showingSummary(root, 2, ALL, 50000);
    expect(new URLSearchParams(location.hash.slice(1)).get("q")).toBe("roma");
    expect(replace).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the bank's text under a shop that only the text matched", async () => {
    const { root } = await mount("card=postings&q=mobilepay");
    const buttons = getAllByRole(root, "button", { name: "Pizzeria Roma" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button.closest("td")?.textContent).toContain("MOBILEPAY 1234");
  });

  it("shows no bank text under a shop that the search matched", async () => {
    const { root } = await mount("card=postings&q=roma");
    for (const button of getAllByRole(root, "button", { name: "Pizzeria Roma" })) {
      expect(button.closest("td")?.textContent).not.toContain("MOBILEPAY");
    }
  });

  it("leaves the key numbers, the circle and the bars as they are", async () => {
    const { app, root } = await mount("");
    const barNames = () =>
      barButtons(getByRole(root, "region", { name: da.per("month") })).map((b) => b.textContent?.trim());
    const bars = barNames();
    expect(bars).toHaveLength(10);
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    const before = keyNumberTexts(root);
    expect(before).toHaveLength(3);
    expect(before.every((text) => text !== "")).toBe(true);
    await type(app, root, "roma");
    showingSummary(root, 2, ALL, 50000);
    expect(keyNumberTexts(root)).toEqual(before);
    expect(getAllByText(circleCard(root), kr(TOTAL))).toHaveLength(2);
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    expect(new URLSearchParams(location.hash.slice(1)).get("q")).toBe("roma");
    expect(barNames()).toEqual(bars);
  });

  it("keeps the text through Søjler and back", async () => {
    const { app, root } = await mount("card=postings");
    await type(app, root, "roma");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    expect(searchbox(root).value).toBe("roma");
    showingSummary(root, 2, ALL, 50000);
  });

  it("shows only the matching rows from a link", async () => {
    const { root } = await mount("card=postings&q=caf%C3%A9");
    expect(searchbox(root).value).toBe("café");
    expect(postingTexts(getByRole(root, "region", { name: da.postingsTitle }))).toEqual(["Café Søde", "Café Søde"]);
    showingSummary(root, 2, ALL, 81012);
  });

  it("says nothing matches for a chosen shop that has no posting, and offers no shops", async () => {
    const { app, root } = await mount("card=postings&shop=Ukendt");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    getByRole(card, "button", { name: da.remove(da.shopChip("Ukendt")) });
    getByText(root, da.noMatch);
    expect(root.textContent).not.toContain(da.noSpending);
    showingSummary(root, 0, ALL, 0);
    searchbox(root).focus();
    await type(app, root, "n");
    expect(queryByRole(root, "listbox", { name: da.suggestions })).toBeNull();
  });

  it("says when nothing matches and keeps the focus in the field", async () => {
    const { app, root } = await mount("card=postings");
    const box = searchbox(root);
    box.focus();
    await type(app, root, "romaxyz");
    getByText(root, da.noMatch);
    showingSummary(root, 0, ALL, 0);
    expect(searchbox(root)).toBe(box);
    expect((app.shadowRoot as ShadowRoot).activeElement).toBe(box);
  });

  it("shows the field above no spending in a unit after today", async () => {
    const { root } = await mount("period=custom&from=2026-10-01&to=2026-12-31&unit=2026-12-01&card=postings");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    const trail = getByRole(root, "navigation", { name: da.trail });
    getByRole(trail, "button", { name: da.remove(unitName(unitAt("2026-12-01", "month", TODAY), "month")) });
    searchbox(card);
    getByText(card, da.noSpending);
  });

  it("shows the field in a period with no spending at all", async () => {
    const { root } = await mount("period=custom&from=2020-01-01&to=2020-12-31&card=postings");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    searchbox(card);
    getByText(card, da.noSpending);
  });

  it("finds Danish capitals from small letters", async () => {
    const beer: Posting = {
      id: "beer",
      groupId: "beer",
      date: "2026-10-20",
      text: "ØL OG VAND",
      account: "1",
      category: "Dagligvarer",
      kind: "spending",
      shop: "ØL OG VAND",
      amount: 12500,
      subscription: null,
    };
    const answer = (range: { start: string; end: string }) => {
      const data = answerFor(range);
      return json({ ...data, postings: [beer, ...data.postings] });
    };
    const { app, root } = await mount("card=postings", { answer });
    await type(app, root, "øl");
    expect(postingTexts(getByRole(root, "region", { name: da.postingsTitle }))).toEqual(["ØL OG VAND"]);
    showingSummary(root, 1, ALL + 1, 12500);
  });

  it("counts everything for a search of spaces", async () => {
    const { app, root } = await mount("card=postings");
    await type(app, root, "   ");
    plainSummary(root, ALL, TOTAL);
  });

  it("holds only the category's matching postings in the chosen unit", async () => {
    const { root } = await mount("group=Mad&category=Caf%C3%A9&unit=2026-07-01&card=postings&q=e");
    const card = getByRole(root, "region", { name: da.postingsOf("Mad") });
    expect(postingTexts(card)).toEqual(["Café Søde"]);
    showingSummary(root, 1, 1, 50000);
  });

  it("starts the postings list afresh on a new search", async () => {
    const { app, root } = await mount("card=postings");
    const card = () => getByRole(root, "region", { name: da.postingsTitle });
    const groupLines = () =>
      getAllByRole(getByRole(card(), "table"), "button").filter((b) => b.hasAttribute("aria-expanded"));
    const states = () => groupLines().slice(0, 2).map((b) => b.getAttribute("aria-expanded"));
    expect(states()).toEqual(["true", "true"]);
    fireEvent.click(groupLines()[0] as HTMLElement);
    await settle(app);
    expect(states()[0]).toBe("false");
    await type(app, root, "café");
    expect(states()).toEqual(["true", "true"]);
  });

  it("goes Back past all the keys at once", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    const length = history.length;
    for (const text of ["p", "pi", "piz"]) await type(app, root, text);
    expect(history.length).toBe(length);
    expect(location.hash).toBe("#card=postings&q=piz");
    history.back();
    await vi.waitFor(() => expect(location.hash).toBe(""));
    await settle(app);
    getByRole(root, "region", { name: da.per("month") });
  });

  describe("the shop", () => {
    const ROMA = da.shopOption("Pizzeria Roma", "2", kr(50000));
    const CHIP = da.remove(da.shopChip("Pizzeria Roma"));

    function card(root: HTMLElement): HTMLElement {
      return getByRole(root, "region", { name: da.postingsTitle });
    }

    async function typeFocused(app: SpendingApp, root: HTMLElement, text: string) {
      searchbox(root).focus();
      await type(app, root, text);
    }

    function params(): URLSearchParams {
      return new URLSearchParams(location.hash.slice(1));
    }

    it("finds the rows by their shop although the bank text says otherwise", async () => {
      const { app, root } = await mount("card=postings");
      await type(app, root, "roma");
      expect(getAllByTitle(card(root), "Pizzeria Roma")).toHaveLength(2);
      expect(card(root).textContent).not.toContain("MOBILEPAY 1234");
      showingSummary(root, 2, ALL, 50000);
    });

    it("finds a row with no shop by its text, and offers no shop", async () => {
      const { app, root } = await mount("card=postings");
      await typeFocused(app, root, "kiosk");
      expect(postingTexts(card(root))).toEqual(["Kiosken"]);
      expect(queryByRole(root, "listbox", { name: da.suggestions })).toBeNull();
    });

    it("offers the matching shop with its net sum", async () => {
      const { app, root } = await mount("card=postings");
      await typeFocused(app, root, "pizz");
      const list = getByRole(root, "listbox", { name: da.suggestions });
      expect(getAllByRole(list, "option")).toEqual([getByRole(list, "option", { name: ROMA })]);
    });

    async function expectChosen(app: SpendingApp, root: HTMLElement) {
      expect(searchbox(root).value).toBe("");
      getByRole(card(root), "button", { name: CHIP });
      expect(postingTexts(card(root))).toEqual(["Pizzeria Roma", "Pizzeria Roma"]);
      showingSummary(root, 2, ALL, 50000);
      expect(location.hash).toContain("shop=Pizzeria+Roma");
      expect(params().has("q")).toBe(false);
      history.back();
      await vi.waitFor(() => expect(location.hash).toBe("#card=postings&q=pizz"));
      await settle(app);
      expect(searchbox(root).value).toBe("pizz");
      expect(queryByRole(root, "button", { name: CHIP })).toBeNull();
    }

    it("chooses a shop by a click, and Back returns to the typed text", async () => {
      const { app, root } = await mount("card=postings");
      await typeFocused(app, root, "pizz");
      fireEvent.click(getByRole(root, "option", { name: ROMA }));
      await settle(app);
      await expectChosen(app, root);
    });

    it("chooses a shop by ArrowDown and Enter, and Back returns to the typed text", async () => {
      const { app, root } = await mount("card=postings");
      await typeFocused(app, root, "pizz");
      fireEvent.keyDown(searchbox(root), { key: "ArrowDown" });
      await settle(app);
      fireEvent.keyDown(searchbox(root), { key: "Enter" });
      await settle(app);
      await expectChosen(app, root);
    });

    it("shows only the rows of the chosen shop that match the text", async () => {
      const { app, root } = await mount("card=postings&shop=Pizzeria+Roma");
      await type(app, root, "kiosk");
      getByText(root, da.noMatch);
      showingSummary(root, 0, ALL, 0);
      await type(app, root, "1234");
      expect(postingTexts(card(root))).toEqual(["Pizzeria Roma", "Pizzeria Roma"]);
      showingSummary(root, 2, ALL, 50000);
    });

    it("unchooses the shop from the chip with a history entry", async () => {
      const { app, root } = await mount("card=postings&shop=Pizzeria+Roma");
      const push = vi.spyOn(history, "pushState");
      fireEvent.click(getByRole(root, "button", { name: CHIP }));
      await settle(app);
      expect(queryByRole(root, "button", { name: CHIP })).toBeNull();
      plainSummary(root, ALL, TOTAL);
      expect(params().has("shop")).toBe(false);
      expect(push).toHaveBeenCalled();
    });

    it("unchooses the shop on Backspace in an empty field, replacing the history entry", async () => {
      const { app, root } = await mount("card=postings&shop=Pizzeria+Roma");
      const push = vi.spyOn(history, "pushState");
      const replace = vi.spyOn(history, "replaceState");
      fireEvent.keyDown(searchbox(root), { key: "Backspace" });
      await settle(app);
      expect(queryByRole(root, "button", { name: CHIP })).toBeNull();
      plainSummary(root, ALL, TOTAL);
      expect(params().has("shop")).toBe(false);
      expect(replace).toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("leaves the key numbers and the circle as they are", async () => {
      const { app, root } = await mount("card=postings");
      const before = keyNumberTexts(root);
      expect(before).toHaveLength(3);
      await typeFocused(app, root, "pizz");
      fireEvent.click(getByRole(root, "option", { name: ROMA }));
      await settle(app);
      showingSummary(root, 2, ALL, 50000);
      expect(keyNumberTexts(root)).toEqual(before);
      expect(getAllByText(circleCard(root), kr(TOTAL))).toHaveLength(2);
    });
  });
});

describe("the Beløb pill on Posteringer", () => {
  const ALL = 28;
  const UNDER: AmountFilter = { kind: "under", value: 450_000 };
  const JULY = unitAt("2026-07-01", "month", TODAY);

  function searchbox(root: HTMLElement): HTMLElement {
    return getByRole(root, "combobox", { name: da.searchLabel });
  }

  function emptyPill(root: HTMLElement): HTMLElement | null {
    return queryByRole(root, "button", { name: da.filterAmount });
  }

  function pill(root: HTMLElement, filter: AmountFilter): HTMLElement {
    return getByRole(root, "group", { name: da.amountName(filter) });
  }

  function postingsCard(root: HTMLElement): HTMLElement {
    return getByRole(root, "region", { name: da.postingsTitle });
  }

  async function chooseKind(app: SpendingApp, root: HTMLElement, kind: AmountFilter["kind"]) {
    const opener = queryByRole(root, "button", { name: da.amountKindButton }) ?? emptyPill(root);
    if (opener === null) throw new Error("no pill");
    opener.focus();
    fireEvent.click(opener);
    await settle(app);
    const option = getByRole(getByRole(root, "group", { name: da.amountKindsLabel }), "button", {
      name: da.amountKinds[kind],
    });
    option.focus();
    fireEvent.click(option);
    await settle(app);
  }

  async function applyAmount(app: SpendingApp, root: HTMLElement, kind: "about" | "under" | "over", text: string) {
    await chooseKind(app, root, kind);
    const input = getByRole(root, "textbox", { name: da.amountKinds[kind] });
    fireEvent.input(input, { target: { value: text } });
    await settle(app);
    fireEvent.keyDown(input, { key: "Enter" });
    await settle(app);
  }

  /** The page's groups but the view switch and the pill: the key numbers. */
  function keyNumberTexts(root: HTMLElement): string[] {
    return getAllByRole(root, "group")
      .filter((g) => {
        const name = g.getAttribute("aria-label") ?? "";
        return name !== da.view && !name.startsWith(da.amountEmpty);
      })
      .map((g) => g.textContent?.replace(/\s+/g, " ").trim() ?? "");
  }

  it("is on the Posteringer tab right after the search, in the normal card and in full screen", async () => {
    for (const hash of ["card=postings", "card=postings&view=full"]) {
      const { root } = await mount(hash);
      const card = postingsCard(root);
      const button = emptyPill(card);
      if (button === null) throw new Error(`no pill on ${hash}`);
      expect(searchbox(card).compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      unmount();
    }
    const { root } = await mount("");
    expect(emptyPill(root)).toBeNull();
  });

  it("Under 4.500 leaves out the posting of exactly 4.500 kr. and keeps those below, in one history entry", async () => {
    const { app, root } = await mount("card=postings");
    plainSummary(root, ALL, TOTAL);
    const july = (n: number, sum: number) =>
      getByRole(postingsCard(root), "button", { name: `${unitName(JULY, "month")}, ${count(n)}, ${postingAmount(sum)}` });
    july(5, 1_510_000);
    const length = history.length;
    await applyAmount(app, root, "under", "4.500");
    expect(location.hash).toBe("#card=postings&under=4500");
    expect(history.length).toBe(length + 1);
    pill(root, UNDER);
    showingSummary(root, 17, ALL, 3_116_012);
    july(3, 260_000);
  });

  it("does not change the key numbers or the circle", async () => {
    const { app, root } = await mount("card=postings");
    const before = keyNumberTexts(root);
    expect(before).toHaveLength(3);
    await applyAmount(app, root, "under", "4.500");
    showingSummary(root, 17, ALL, 3_116_012);
    expect(keyNumberTexts(root)).toEqual(before);
    expect(getAllByText(circleCard(root), kr(TOTAL))).toHaveLength(2);
  });

  it("pushes one entry per change, and Back gives the amount before", async () => {
    const { app, root } = await mount("card=postings");
    const length = history.length;
    await applyAmount(app, root, "under", "4.500");
    await chooseKind(app, root, "over");
    expect(location.hash).toBe("#card=postings&over=4500");
    expect(history.length).toBe(length + 2);
    pill(root, { kind: "over", value: 450_000 });
    showingSummary(root, 10, ALL, 8_000_000);
    history.back();
    await vi.waitFor(() => expect(location.hash).toBe("#card=postings&under=4500"));
    await settle(app);
    pill(root, UNDER);
    showingSummary(root, 17, ALL, 3_116_012);
    history.back();
    await vi.waitFor(() => expect(location.hash).toBe("#card=postings"));
    await settle(app);
    expect(emptyPill(root)).not.toBeNull();
    plainSummary(root, ALL, TOTAL);
  });

  it("names the empty pill apart from the Beløb column header", async () => {
    const { root } = await mount("card=postings");
    expect(getAllByRole(root, "button", { name: da.amountEmpty })).toHaveLength(1);
    getByRole(root, "button", { name: da.filterAmount });
  });

  it("stays when the tab changes", async () => {
    const { app, root } = await mount("card=postings&under=4500");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    expect(location.hash).toBe("#under=4500");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    pill(root, UNDER);
    showingSummary(root, 17, ALL, 3_116_012);
  });

  it("stays when the period changes", async () => {
    const { app, root } = await mount("card=postings&under=4500");
    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastYear }));
    await settle(app);
    expect(location.hash).toBe("#period=lastYear&card=postings&under=4500");
    pill(root, UNDER);
    showingSummary(root, 2, 3, 400_000);
  });

  it("says nothing matches when the amount leaves no posting", async () => {
    const { root } = await mount("card=postings&over=10000");
    getByText(root, da.noMatch);
    expect(root.textContent).not.toContain(da.noSpending);
    showingSummary(root, 0, ALL, 0);
  });

  it("shows an old max alone as Under", async () => {
    const { root } = await mount("card=postings&max=4500");
    pill(root, UNDER);
    showingSummary(root, 17, ALL, 3_116_012);
  });
});
