import { type Grouping, type Period, unitAt } from "@ha-spending/shared";
import { fireEvent, getByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { kr, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { answerFor, leftOverFor, withLeftOver, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";
import { cardNames } from "./text";

afterEach(unmount);

const CARD = da.leftOver.label(null);
const FIXED = da.inPeriod("Faste udgifter");
const SUBS = da.inPeriod("Abonnementer");

/** The card's label for the unit that starts on `fullStart`. */
function unitLabel(fullStart: string, g: Grouping = "month"): string {
  return da.leftOver.label(unitName(unitAt(fullStart, g, "2026-10-30"), g, false));
}

function withCard(range: Period): Response {
  return json(withLeftOver(answerFor(range)));
}

function flat(el: HTMLElement): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function card(root: HTMLElement, label = CARD): HTMLElement {
  return getByRole(root, "group", { name: label });
}

function monthsLink(root: HTMLElement, label = CARD): HTMLElement {
  return getByRole(card(root, label), "link", { name: da.leftOver.showMonths });
}

describe("the Til overs card", () => {
  it("stands right after the period's cards and before the object groups' cards", async () => {
    const { root } = await mount("", { answer: (range) => json(withSubscriptions(withLeftOver(answerFor(range)))) });
    expect(cardNames(root)).toEqual([da.spendingInPeriod, da.averagePer("month"), CARD, SUBS, FIXED]);
  });

  it("sums the period's rounded months, with Ind and the net draw under it", async () => {
    const { root } = await mount("", { answer: withCard });
    const text = flat(card(root));
    expect(text).toContain(kr(2_553_400));
    expect(text).not.toContain("+");
    expect(text).toContain(`${da.leftOver.paidInSub(kr(23_100_000))}${da.leftOver.borrowedSub(kr(700_000))}`);
  });

  it("reads a month below zero with its minus only", async () => {
    const { root } = await mount("unit=2026-09-01", { answer: withCard });
    const label = unitLabel("2026-09-01");
    const text = flat(card(root, label));
    expect(text).toContain(`−${kr(880_100)}`);
    expect(text).not.toContain("+");
    expect(text).toContain(`${da.leftOver.paidInSub(kr(2_500_000))}${da.leftOver.borrowedSub(kr(1_000_000))}`);
  });

  it("names the chosen unit and sums only its month, with no draw when the credit was paid off", async () => {
    const { root } = await mount("unit=2026-08-01", { answer: withCard });
    const text = flat(card(root, unitLabel("2026-08-01")));
    expect(text).toContain(kr(300_000));
    expect(text).not.toContain("−");
    expect(text).toContain(da.leftOver.paidInSub(kr(2_500_000)));
    expect(text).not.toContain(da.leftOver.borrowed);
    expect(queryByRole(root, "group", { name: CARD })).toBeNull();
  });

  it("is not shown when the answer has no Til overs, and asks for none", async () => {
    const { root, leftOver } = await mount("");
    expect(queryByRole(root, "group", { name: CARD })).toBeNull();
    expect(leftOver).not.toHaveBeenCalled();
  });

  it("is not shown with a main group or with chosen accounts", async () => {
    for (const hash of ["group=Mad", "group=Mad&category=Café", "accounts=1"]) {
      const { root, leftOver } = await mount(hash, { answer: withCard });
      expect(cardNames(root)).not.toContain(CARD);
      expect(leftOver).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("is a busy placeholder named for the card while its answer loads", async () => {
    const { root } = await mount("", { answer: withCard, leftOver: () => new Promise<Response>(() => {}) });
    const busy = card(root);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(queryByRole(busy, "link")).toBeNull();
    expect(cardNames(root)).toEqual([da.spendingInPeriod, da.averagePer("month"), CARD, SUBS]);
  });

  it("is left out when its answer fails, and the rest of the overview shows", async () => {
    const error = vi.spyOn(console, "error");
    const { root } = await mount("", { answer: withCard, leftOver: () => json({ error: "failed" }, 502) });
    expect(queryByRole(root, "group", { name: CARD })).toBeNull();
    expect(cardNames(root)).toEqual([da.spendingInPeriod, da.averagePer("month"), SUBS]);
    expect(queryByRole(root, "alert")).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it("stays out after a failure while the period stays, so the other cards do not move", async () => {
    const { app, root, leftOver } = await mount("card=postings", {
      answer: withCard,
      leftOver: () => json({ error: "failed" }, 502),
    });
    fireEvent.input(getByRole(root, "combobox", { name: da.searchLabel }), { target: { value: "ne" } });
    await settle(app);
    expect(new URLSearchParams(location.hash.slice(1)).get("q")).toBe("ne");
    expect(leftOver).toHaveBeenCalledTimes(1);
    expect(queryByRole(root, "group", { name: CARD })).toBeNull();
  });

  it("Vis måneder → opens the view and pushes an entry", async () => {
    const { app, root } = await mount("", { answer: withCard });
    const before = history.length;
    const link = monthsLink(root);
    expect(flat(link)).toBe(`${da.leftOver.showMonths} →`);
    fireEvent.click(link);
    await settle(app);
    expect(location.hash).toBe("#view=leftover");
    expect(history.length).toBe(before + 1);
  });

  it("over a long period sums only the chosen year, and Vis måneder opens the whole period", async () => {
    const answer = (range: Period) => json({ ...withLeftOver(answerFor(range)), earliestPostingDate: "2024-03-01" });
    const months = (range: Period) => json(leftOverFor(range));
    const { app, root, leftOver } = await mount("period=all&unit=2025-01-01", { answer, leftOver: months });
    expect(leftOver).toHaveBeenCalledTimes(1);
    expect(leftOver.mock.calls[0][0]).toBe("api/left-over?start=2024-03-01&end=2026-10-30");

    const label = unitLabel("2025-01-01", "year");
    const text = flat(card(root, label));
    expect(text).toContain(kr(1_052_400));
    expect(text).toContain(da.leftOver.paidInSub(kr(30_000_000)));
    expect(text).not.toContain(da.leftOver.borrowed);

    fireEvent.click(monthsLink(root, label));
    await settle(app);
    const params = new URLSearchParams(location.hash.slice(1));
    expect(params.get("view")).toBe("leftover");
    expect(params.get("period")).toBe("all");
    expect(params.has("unit")).toBe(false);
  });
});
