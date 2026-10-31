import type { SpendingData } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, queryAllByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import "../src/components/postings";
import { count, postingAmount, tableDate, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { groupedPostings, linkBase, type PostingList } from "../src/model/postings";
import { DEFAULT_STATE, type ViewState } from "../src/state/view";
import { answerFor, LINK } from "./fixture";

const THIS_YEAR = { start: "2026-01-01", end: "2026-10-30" };
const TODAY = "2026-10-30";
const COLOURS = new Map<string | null, string>([
  ["Café", "#eb6834"],
  ["Dagligvarer", "#2a78d6"],
]);

function listOf(state: Partial<ViewState> = {}, data: SpendingData = answerFor(THIS_YEAR)): PostingList {
  const ctx = viewContext(data, { ...DEFAULT_STATE, ...state }, TODAY);
  return groupedPostings(ctx.shown, ctx.units, ctx, true, COLOURS);
}

async function render(list: PostingList, opts: { showCategory?: boolean; grouping?: ViewState["grouping"] } = {}) {
  const el = document.createElement("hs-postings");
  el.list = list;
  el.showCategory = opts.showCategory ?? false;
  el.grouping = opts.grouping ?? "month";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function groupButtons(el: HTMLElement): HTMLElement[] {
  return getAllByRole(el, "button").filter((b) => b.hasAttribute("aria-expanded"));
}

function monthUnit(fullStart: string) {
  const ctx = viewContext(answerFor(THIS_YEAR), DEFAULT_STATE, TODAY);
  const unit = ctx.units.find((u) => u.fullStart === fullStart);
  if (!unit) throw new Error(`no unit ${fullStart}`);
  return unit;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("the postings list", () => {
  it("groups by unit, newest first, the two newest open", async () => {
    const el = await render(listOf());
    const buttons = groupButtons(el);
    const names = ["10", "09", "08", "07", "06", "05", "04", "03", "02", "01"].map((m) =>
      unitName(monthUnit(`2026-${m}-01`), "month"),
    );
    expect(buttons).toEqual(names.map((n) => getByRole(el, "button", { name: new RegExp(`^${n},`) })));
    const oct = monthUnit("2026-10-01");
    expect(buttons[0]).toBe(
      getByRole(el, "button", { name: `${unitName(oct, "month")}, ${count(3)}, ${postingAmount(1131012)}` }),
    );
    expect(buttons.map((b) => b.getAttribute("aria-expanded")).slice(0, 3)).toEqual(["true", "true", "false"]);
  });

  it("adds a group up to its bar, newest posting first", async () => {
    const el = await render(listOf());
    const sep = monthUnit("2026-09-01");
    const button = getByRole(el, "button", {
      name: `${unitName(sep, "month")}, ${count(4)}, ${postingAmount(1150000)}`,
    });
    const group = button.closest("tbody") as HTMLElement;
    const amounts = getAllByRole(group, "row")
      .slice(1)
      .map((row) => getAllByRole(row, "cell").at(-1)?.textContent?.trim());
    expect(amounts).toEqual([20000, -70000, -300000, -800000].map((ore) => postingAmount(-ore)));
    const dates = getAllByRole(group, "row")
      .slice(1)
      .map((row) => getAllByRole(row, "cell")[0].textContent?.trim());
    expect(dates).toEqual(["2026-09-22", "2026-09-20", "2026-09-10", "2026-09-01"].map(tableDate));
  });

  it("folds a group in and out", async () => {
    const el = await render(listOf());
    const aug = monthUnit("2026-08-01");
    const button = getByRole(el, "button", { name: new RegExp(`^${unitName(aug, "month")},`) });
    expect(queryByRole(el, "cell", { name: tableDate("2026-08-10") })).toBeNull();
    fireEvent.click(button);
    await el.updateComplete;
    expect(button.getAttribute("aria-expanded")).toBe("true");
    getByRole(el, "cell", { name: tableDate("2026-08-10") });
    fireEvent.click(button);
    await el.updateComplete;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(queryByRole(el, "cell", { name: tableDate("2026-08-10") })).toBeNull();
  });

  it("shows older groups", async () => {
    const el = await render(listOf({ grouping: "week" }), { grouping: "week" });
    expect(groupButtons(el)).toHaveLength(12);
    fireEvent.click(getByRole(el, "button", { name: da.showOlder }));
    await el.updateComplete;
    expect(groupButtons(el)).toHaveLength(24);
  });

  it("shows newer groups when oldest first", async () => {
    const ctx = viewContext(answerFor(THIS_YEAR), { ...DEFAULT_STATE, grouping: "week" }, TODAY);
    const list = groupedPostings(ctx.shown, ctx.units, ctx, false, COLOURS);
    const el = await render(list, { grouping: "week" });
    expect(groupButtons(el)).toHaveLength(12);
    expect(queryByRole(el, "button", { name: da.showOlder })).toBeNull();
    fireEvent.click(getByRole(el, "button", { name: da.showNewer }));
    await el.updateComplete;
    expect(groupButtons(el)).toHaveLength(24);
  });

  it("shows 100 rows of a flat list, then more", async () => {
    const grouped = listOf({ grouping: "day" });
    if (grouped.kind !== "grouped") throw new Error("grouped expected");
    const rows = grouped.groups.flatMap((g) => g.rows);
    const many = Array.from({ length: 5 }, () => rows).flat();
    const el = await render({ kind: "flat", rows: many });
    expect(getAllByRole(el, "row")).toHaveLength(101);
    fireEvent.click(getByRole(el, "button", { name: da.showMore }));
    await el.updateComplete;
    expect(getAllByRole(el, "row")).toHaveLength(Math.min(many.length, 200) + 1);
  });

  it("links a posting to Firefly III", async () => {
    const el = await render(listOf());
    const link = getByRole(el, "link", { name: "Café Søde" });
    expect(link.getAttribute("href")).toBe(`${LINK}/transactions/show/g26`);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");

    const data = answerFor(THIS_YEAR);
    data.postings = data.postings.map((p) => (p.groupId === "g26" ? { ...p, groupId: "a/b c" } : p));
    document.body.replaceChildren();
    const other = await render(listOf({}, data));
    expect(getByRole(other, "link", { name: "Café Søde" }).getAttribute("href")).toBe(
      `${LINK}/transactions/show/a%2Fb%20c`,
    );
  });

  it("links only to http and https", async () => {
    expect(linkBase("javascript:alert(1)")).toBeNull();
    expect(linkBase("ftp://x.test")).toBeNull();
    expect(linkBase("not a url")).toBeNull();
    expect(linkBase(null)).toBeNull();
    expect(linkBase("https://firefly.test/")).toBe("https://firefly.test");
    expect(linkBase("http://firefly.test/sub")).toBe("http://firefly.test/sub");

    const data = { ...answerFor(THIS_YEAR), fireflyLinkUrl: null };
    const el = await render(listOf({}, data));
    getByRole(el, "cell", { name: "Café Søde" });
    expect(queryAllByRole(el, "link")).toEqual([]);
  });

  it("shows the category with its dot", async () => {
    const plain = await render(listOf());
    expect(queryByRole(plain, "columnheader", { name: da.columns.category })).toBeNull();
    document.body.replaceChildren();
    const el = await render(listOf(), { showCategory: true });
    getByRole(el, "columnheader", { name: da.columns.category });
    getByRole(el, "columnheader", { name: da.columns.unitAndDate("month") });
    expect(getAllByRole(el, "cell", { name: "Café" }).length).toBeGreaterThan(0);
  });

  it("starts over when the first group changes", async () => {
    const el = await render(listOf());
    const sep = monthUnit("2026-09-01");
    const button = getByRole(el, "button", { name: new RegExp(`^${unitName(sep, "month")},`) });
    fireEvent.click(button);
    await el.updateComplete;
    expect(button.getAttribute("aria-expanded")).toBe("false");

    el.list = listOf({ period: { preset: "custom", start: "2026-01-01", end: "2026-09-30" } });
    await el.updateComplete;
    const buttons = groupButtons(el);
    expect(buttons[0]).toBe(getByRole(el, "button", { name: new RegExp(`^${unitName(sep, "month")},`) }));
    expect(buttons.map((b) => b.getAttribute("aria-expanded")).slice(0, 3)).toEqual(["true", "true", "false"]);
  });
});
