import { addDays, fetchRange, type Period, unitAt } from "@ha-spending/shared";
import {
  findByRole,
  fireEvent,
  getAllByRole,
  getByRole,
  getByText,
  queryAllByRole,
  queryByRole,
  queryByText,
  waitFor,
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { kr, longDate, rangeText, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { answerFor, OBJECT_GROUP, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";
import { cardNames, hasArrow } from "./text";

const TODAY = "2026-10-30";
/** Keeps Intl's no-break space, which the default normalizer turns into a space. */
const escaped = (text: string) => new RegExp(text.replace(/[()]/g, "\\$&"));

afterEach(unmount);

/** No range's start, so Alt's start can only come from it. */
const EARLIEST = "2023-01-03";

function earliestAnswer(range: Period): Response {
  return json({ ...answerFor(range), earliestPostingDate: EARLIEST });
}

function kontiButton(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: new RegExp(`^${da.accounts}`) });
}

function periodButton(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: new RegExp(`^${da.period}`) });
}

function firstCard(root: HTMLElement): HTMLElement {
  return getByRole(root, "group", { name: da.spendingInPeriod });
}

async function choosePreset(root: HTMLElement, app: Parameters<typeof settle>[0], name: string) {
  fireEvent.click(periodButton(root));
  await app.updateComplete;
  const panel = getByRole(root, "group", { name: da.period });
  fireEvent.click(getByRole(panel, "button", { name }));
  await settle(app);
}

async function openPeriod(root: HTMLElement, app: Parameters<typeof settle>[0]) {
  fireEvent.click(periodButton(root));
  await settle(app);
  const panel = getByRole(root, "group", { name: da.period });
  return {
    panel,
    from: getByRole(panel, "textbox", { name: da.from }) as HTMLInputElement,
    to: getByRole(panel, "textbox", { name: da.to }) as HTMLInputElement,
    show: getByRole(panel, "button", { name: da.show }) as HTMLButtonElement,
  };
}

async function type(app: Parameters<typeof settle>[0], field: HTMLInputElement, text: string) {
  fireEvent.input(field, { target: { value: text } });
  await settle(app);
}

function day(panel: HTMLElement, date: string): HTMLButtonElement {
  return getByRole(panel, "button", { name: longDate(date) }) as HTMLButtonElement;
}

/** happy-dom's own API; its `matchMedia` follows the viewport. */
function setViewport(width: number): void {
  (window as unknown as { happyDOM: { setViewport(size: { width: number; height: number }): void } }).happyDOM.setViewport({
    width,
    height: 768,
  });
}

function isPicked(panel: HTMLElement, date: string): boolean {
  return queryAllByRole(panel, "gridcell", { selected: true }).some((cell) => cell.contains(day(panel, date)));
}

async function pick(app: Parameters<typeof settle>[0], panel: HTMLElement, date: string) {
  fireEvent.click(day(panel, date));
  await settle(app);
}

describe("the frame", () => {
  it("opens on I år by month with all accounts, asking for the period's range", async () => {
    const { root, fetch } = await mount("");
    expect(fetch).toHaveBeenCalledWith("api/data?start=2026-01-01&end=2026-10-30", expect.anything());
    expect(getByRole(root, "heading", { level: 1 }).textContent?.trim()).toBe(da.presets.thisYear);
    getByRole(root, "button", { name: da.periodStep(da.presets.thisYear, rangeText({ start: "2026-01-01", end: TODAY })) });
    await findByRole(root, "button", { name: escaped(da.allAccountsCount(2)) });
  });

  it("shows the key numbers of all spending", async () => {
    const { root } = await mount("");
    const first = await findByRole(root, "group", { name: da.spendingInPeriod });
    getByText(first, kr(11566012));
    getByText(first, rangeText({ start: "2026-01-01", end: TODAY }));
    const second = getByRole(root, "group", { name: da.averagePer("month") });
    getByText(second, kr(1159444));
    getByText(second, da.unitCount(9, "month"));
    expect(cardNames(root, [OBJECT_GROUP])).toEqual([da.spendingInPeriod, da.averagePer("month")]);
    expect(hasArrow(root)).toBe(false);
  });

  it("labels the average of a one-unit period by the months before", async () => {
    const { root, fetch } = await mount("period=thisMonth");
    expect(fetch).toHaveBeenCalledWith("api/data?start=2025-10-01&end=2026-10-30", expect.anything());
    const second = getByRole(root, "group", { name: da.averagePer("month") });
    getByText(second, kr(1163500));
    getByText(second, da.averageBefore(10, "month"));
  });

  it("filters by account", async () => {
    const { app, root, fetch } = await mount("");
    const push = vi.spyOn(history, "pushState");
    fireEvent.click(kontiButton(root));
    await app.updateComplete;
    fireEvent.click(getByRole(root, "checkbox", { name: "Fælleskonto" }));
    await settle(app);
    getByText(firstCard(root), kr(281012));
    expect(push).toHaveBeenCalledWith(null, "", "#accounts=2");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("ticks and unticks every account with Alle konti, and names the choice", async () => {
    const { app, root } = await mount("");
    const push = vi.spyOn(history, "pushState");
    fireEvent.click(kontiButton(root));
    await app.updateComplete;
    fireEvent.click(getByRole(root, "checkbox", { name: "Fælleskonto" }));
    await settle(app);
    getByRole(root, "button", { name: escaped(`${da.accounts} ${da.someAccounts(1, 2)}`) });
    fireEvent.click(getByRole(root, "checkbox", { name: "Kreditkort" }));
    await settle(app);
    getByRole(root, "button", { name: new RegExp(`^${da.accounts}.*${da.noAccounts}`) });
    getByText(firstCard(root), kr(0));

    fireEvent.click(getByRole(root, "checkbox", { name: da.allAccounts }));
    await settle(app);
    expect((getByRole(root, "checkbox", { name: "Fælleskonto" }) as HTMLInputElement).checked).toBe(true);
    expect((getByRole(root, "checkbox", { name: "Kreditkort" }) as HTMLInputElement).checked).toBe(true);
    getByRole(root, "button", { name: escaped(da.allAccountsCount(2)) });
    expect(push).toHaveBeenLastCalledWith(null, "", "#");

    fireEvent.click(getByRole(root, "checkbox", { name: da.allAccounts }));
    await settle(app);
    expect((getByRole(root, "checkbox", { name: "Fælleskonto" }) as HTMLInputElement).checked).toBe(false);
    expect((getByRole(root, "checkbox", { name: "Kreditkort" }) as HTMLInputElement).checked).toBe(false);
    expect(push).toHaveBeenLastCalledWith(null, "", "#accounts=");
  });

  it("closes a panel with Escape or an outside click and returns focus", async () => {
    const { app, root } = await mount("");
    const shadow = app.shadowRoot!;
    fireEvent.click(kontiButton(root));
    await app.updateComplete;
    const box = getByRole(root, "checkbox", { name: da.allAccounts });
    box.focus();
    fireEvent.keyDown(box, { key: "Escape" });
    await settle(app);
    expect(queryByRole(root, "checkbox", { name: da.allAccounts })).toBeNull();
    expect(shadow.activeElement).toBe(kontiButton(root));

    fireEvent.click(periodButton(root));
    await app.updateComplete;
    getByRole(root, "group", { name: da.period });
    fireEvent.click(document.body);
    await settle(app);
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();
    expect(shadow.activeElement).toBe(periodButton(root));
  });

  it("keeps Konti disabled until the first answer", async () => {
    const { root } = await mount("", { answer: () => new Promise<Response>(() => {}) });
    expect((kontiButton(root) as HTMLButtonElement).disabled).toBe(true);
  });

  it("marks the chosen preset as pressed", async () => {
    const { app, root } = await mount("period=lastMonth");
    fireEvent.click(periodButton(root));
    await app.updateComplete;
    const panel = getByRole(root, "group", { name: da.period });
    expect(getByRole(panel, "button", { name: da.presets.lastMonth }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole(panel, "button", { name: da.presets.thisYear }).getAttribute("aria-pressed")).toBe("false");
  });

  it("closes a panel when focus leaves it", async () => {
    const { app, root } = await mount("");
    fireEvent.click(kontiButton(root));
    await app.updateComplete;
    getByRole(root, "checkbox", { name: da.allAccounts }).focus();
    await app.updateComplete;
    getByRole(root, "checkbox", { name: da.allAccounts });
    periodButton(root).focus();
    await settle(app);
    expect(queryByRole(root, "checkbox", { name: da.allAccounts })).toBeNull();
    expect(app.shadowRoot!.activeElement).toBe(periodButton(root));
  });

  it("chooses a period from the dropdown", async () => {
    const { app, root, fetch } = await mount("");
    await choosePreset(root, app, da.presets.lastYear);
    expect(fetch).toHaveBeenLastCalledWith("api/data?start=2025-01-01&end=2025-12-31", expect.anything());
    expect(location.hash).toBe("#period=lastYear");
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();
  });

  it("pushes a click and follows the hash back", async () => {
    const { app, root } = await mount("");
    const push = vi.spyOn(history, "pushState");
    await choosePreset(root, app, da.presets.lastYear);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(null, "", "#period=lastYear");

    history.replaceState(null, "", "#period=lastMonth");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle(app);
    getByRole(root, "button", { name: new RegExp(`${da.period}.*${da.presets.lastMonth}`) });
  });

  it("shows Firefly III refusing the key, and no numbers", async () => {
    const { root } = await mount("", { answer: () => json({ error: "refused" }, 502) });
    expect(getByRole(root, "alert").textContent).toContain(da.errors.refused);
    expect(queryByRole(root, "group", { name: da.spendingInPeriod })).toBeNull();
  });

  it("drops the old numbers when a later fetch fails", async () => {
    const { app, root } = await mount("", {
      answer: (range, n) => (n === 1 ? json(answerFor(range)) : json({ error: "unreachable" }, 502)),
    });
    getByText(firstCard(root), kr(11566012));
    await choosePreset(root, app, da.presets.lastYear);
    expect(getByRole(root, "alert").textContent).toContain(da.errors.unreachable);
    expect(queryByText(root, kr(11566012))).toBeNull();
    expect(queryAllByRole(root, "group")).toEqual([]);
  });

  it("shows Firefly III not answering, and a failed fetch", async () => {
    const first = await mount("", { answer: () => json({ error: "unreachable" }, 502) });
    expect(getByRole(first.root, "alert").textContent).toContain(da.errors.unreachable);
    unmount();
    const second = await mount("", { answer: () => Promise.reject(new TypeError("Failed to fetch")) });
    expect(getByRole(second.root, "alert").textContent).toContain(da.errors.failed);
  });

  it("says once that the rule group is missing", async () => {
    const { root } = await mount("", { answer: (range) => json({ ...answerFor(range), mainGroupsFound: false }) });
    const status = getAllByRole(root, "status");
    expect(status).toHaveLength(1);
    expect(status[0].textContent).toContain(da.noRuleGroup);
  });

  it("keeps the top card usable while loading", async () => {
    const { root } = await mount("", { answer: () => new Promise<Response>(() => {}) });
    expect((periodButton(root) as HTMLButtonElement).disabled).toBe(false);
    const busy = getAllByRole(root, "group", { name: da.loading });
    expect(busy.length).toBeGreaterThan(0);
    expect(busy[0].getAttribute("aria-busy")).toBe("true");
    expect(queryByRole(root, "group", { name: da.spendingInPeriod })).toBeNull();
  });

  it("ignores an answer that comes after a newer one", async () => {
    let release: () => void = () => {};
    const { app, root } = await mount("", {
      answer: (range, n) =>
        n === 1
          ? new Promise<Response>((resolve) => {
              release = () => resolve(json(answerFor(range)));
            })
          : json(answerFor(range)),
    });
    await choosePreset(root, app, da.presets.lastYear);
    getByText(firstCard(root), kr(1200000));
    release();
    await settle(app);
    getByText(firstCard(root), kr(1200000));
  });

  it("fetches again with the add-on's today, once", async () => {
    const { root, fetch } = await mount("", {
      now: "2026-10-31T00:30:00+01:00",
      answer: (range) => json(answerFor(range, TODAY)),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe("api/data?start=2026-01-01&end=2026-10-31");
    expect(fetch.mock.calls[1][0]).toBe("api/data?start=2026-01-01&end=2026-10-30");
    getByRole(root, "button", { name: new RegExp(rangeText({ start: "2026-01-01", end: TODAY })) });
  });

  it("retries at most once, and a retry never moves today", async () => {
    const { app, root, fetch } = await mount("", {
      now: "2026-10-31T00:30:00+01:00",
      answer: (range) => json(answerFor(range, addDays(range.end, -1))),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe("api/data?start=2026-01-01&end=2026-10-31");
    expect(fetch.mock.calls[1][0]).toBe("api/data?start=2026-01-01&end=2026-10-30");
    getByRole(root, "button", { name: new RegExp(rangeText({ start: "2026-01-01", end: TODAY })) });
    getByText(firstCard(root), kr(11566012));

    await choosePreset(root, app, da.presets.lastYear);
    expect(fetch.mock.calls[2][0]).toBe("api/data?start=2025-01-01&end=2025-12-31");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("choosing Alt shows the earliest posting to today", async () => {
    const { app, root, fetch } = await mount("", { answer: earliestAnswer });
    await choosePreset(root, app, da.presets.all);
    expect(location.hash).toBe("#period=all");
    getByRole(root, "button", { name: new RegExp(rangeText({ start: EARLIEST, end: TODAY })) });
    expect(fetch.mock.calls[1][0]).toBe(`api/data?start=2023-01-01&end=${TODAY}`);
  });

  it("a hash with Alt asks for I år's range, then once for Alt's", async () => {
    const { app, root, fetch } = await mount("period=all", { answer: earliestAnswer });
    const url = (p: { start: string; end: string }) => `api/data?start=${p.start}&end=${p.end}`;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe(url(fetchRange({ start: "2026-01-01", end: TODAY }, "month", TODAY)));
    expect(fetch.mock.calls[1][0]).toBe(`api/data?start=2023-01-01&end=${TODAY}`);
    await settle(app);
    expect(fetch).toHaveBeenCalledTimes(2);
    getByRole(root, "button", { name: new RegExp(rangeText({ start: EARLIEST, end: TODAY })) });
  });

  it("Alt shows nothing of the first answer while the second is on its way", async () => {
    const { root, fetch } = await mount("period=all", {
      answer: (range, n) => (n === 1 ? json(answerFor(range)) : new Promise<Response>(() => {})),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(getAllByRole(root, "group", { name: da.loading }).length).toBeGreaterThan(0);
    expect(queryByRole(root, "group", { name: da.spendingInPeriod })).toBeNull();
  });

  it("Alt keeps a unit from an earlier year", async () => {
    const { app, fetch } = await mount("period=all&unit=2024-01-01", { answer: earliestAnswer });
    await settle(app);
    expect(fetch.mock.calls[1][0]).toBe(`api/data?start=2023-01-01&end=${TODAY}`);
    expect(location.hash).toContain("unit=2024-01-01");
  });

  it("a later change of the period makes one request", async () => {
    const { app, root, fetch } = await mount("period=all");
    expect(fetch).toHaveBeenCalledTimes(2);
    await choosePreset(root, app, da.presets.lastYear);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("the period reads Alt alone before the first answer", async () => {
    const { root } = await mount("period=all", { answer: () => new Promise<Response>(() => {}) });
    getByRole(root, "button", { name: da.periodStep(da.presets.all, null) });
  });

  it("falls back from an unknown main group and replaces the hash", async () => {
    const replace = vi.spyOn(history, "replaceState");
    const push = vi.spyOn(history, "pushState");
    const { root } = await mount("group=Ukendt");
    expect(getByRole(root, "heading", { level: 1 }).textContent?.trim()).toBe(da.presets.thisYear);
    expect(replace).toHaveBeenLastCalledWith(null, "", "#");
    expect(push).not.toHaveBeenCalled();
  });

  it("says there is no spending in an empty period", async () => {
    const { root } = await mount("period=custom&from=2020-01-01&to=2020-12-31");
    const regions = getAllByRole(root, "region");
    expect(regions).toHaveLength(2);
    for (const region of regions) getByText(region, da.noSpending);
    getByText(firstCard(root), kr(0));
  });

  it("disables the dashed button when its list would be empty", async () => {
    const { root } = await mount("period=custom&from=2020-01-01&to=2020-12-31");
    getByText(getAllByRole(root, "region")[0] as HTMLElement, da.noSpending);
    const dashed = getByRole(getByRole(root, "navigation", { name: da.trail }), "button", { name: da.chooseMainGroup });
    expect((dashed as HTMLButtonElement).disabled).toBe(true);
  });

  it("links the trail's Alt forbrug to the overview with nothing chosen", async () => {
    const { root } = await mount("group=Mad&category=Café");
    const trail = getByRole(root, "navigation", { name: da.trail });
    expect(getByRole(trail, "link", { name: da.allSpending }).getAttribute("href")).toBe("#");
    expect(queryByRole(trail, "link", { name: "Mad" })).toBeNull();
    expect(getByRole(trail, "heading", { level: 1 }).textContent?.trim()).toBe("Café");
    await waitFor(() => getByRole(root, "group", { name: da.inPeriod("Café") }));
  });
});

describe("the period's custom interval", () => {
  it("typing Fra and Til and pressing Vis sets a custom period", async () => {
    const { app, root } = await mount("");
    const { from, to, show } = await openPeriod(root, app);
    await type(app, from, "03.01.2024");
    await type(app, to, "3.2.2024");
    expect(show.disabled).toBe(false);
    fireEvent.click(show);
    await settle(app);
    expect(location.hash).toBe("#period=custom&from=2024-01-03&to=2024-02-03");
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();
  });

  it("a wrong date, a date after today or an end before the start leaves Vis disabled", async () => {
    const { app, root } = await mount("");
    const { from, to, show } = await openPeriod(root, app);
    expect(show.disabled).toBe(false);
    await type(app, from, "31.02.2024");
    expect(show.disabled).toBe(true);
    await type(app, from, "2024-01-03");
    expect(show.disabled).toBe(true);
    await type(app, from, "3.1.24");
    expect(show.disabled).toBe(true);
    await type(app, from, "03.01.2024");
    expect(show.disabled).toBe(false);
    await type(app, to, "31.10.2026");
    expect(show.disabled).toBe(true);
    await type(app, to, "02.01.2024");
    expect(show.disabled).toBe(true);
    await type(app, to, "03.01.2024");
    expect(show.disabled).toBe(false);
  });

  it("a wrong typed date says what is wrong once the field loses the focus or Enter is pressed", async () => {
    const { app, root } = await mount("");
    const { panel, from, to } = await openPeriod(root, app);
    const named = (name: string, description: string) => getByRole(panel, "textbox", { name, description });
    await type(app, from, "31.2.2026");
    expect(from.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.blur(from);
    await settle(app);
    named(da.from, da.dateInvalid);
    expect(from.getAttribute("aria-invalid")).toBe("true");
    expect(to.hasAttribute("aria-invalid")).toBe(false);

    await type(app, from, "03.01.2026");
    expect(from.hasAttribute("aria-invalid")).toBe(false);
    expect(queryByText(panel, da.dateInvalid)).toBeNull();

    await type(app, to, "31.10.2026");
    expect(to.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.keyDown(to, { key: "Enter" });
    await settle(app);
    named(da.to, da.dateFuture);

    await type(app, to, "02.01.2026");
    fireEvent.blur(to);
    await settle(app);
    named(da.to, da.dateOrder);

    await type(app, from, "01.01.2026");
    expect(to.hasAttribute("aria-invalid")).toBe(false);
    expect(queryByText(panel, da.dateOrder)).toBeNull();
  });

  it("typing judges a date afresh at the next blur, and Fra's typing does not judge Til", async () => {
    const { app, root } = await mount("");
    const { from, to } = await openPeriod(root, app);
    await type(app, from, "03.01.2026");
    fireEvent.blur(from);
    await type(app, from, "31.2.2026");
    expect(from.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.blur(from);
    await settle(app);
    expect(from.getAttribute("aria-invalid")).toBe("true");
    await type(app, from, "03.01.2026");
    await type(app, to, "05.01.2026");
    fireEvent.blur(to);
    await type(app, from, "10.01.2026");
    expect(to.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.blur(to);
    await settle(app);
    expect(to.getAttribute("aria-invalid")).toBe("true");
  });

  it("an empty or valid date field shows no message", async () => {
    const { app, root } = await mount("");
    const { panel, from, to } = await openPeriod(root, app);
    await type(app, from, "");
    fireEvent.blur(from);
    await type(app, to, "30.10.2026");
    fireEvent.blur(to);
    await settle(app);
    for (const text of [da.dateInvalid, da.dateFuture, da.dateOrder]) expect(queryByText(panel, text)).toBeNull();
    expect(from.hasAttribute("aria-invalid")).toBe(false);
    expect(to.hasAttribute("aria-invalid")).toBe(false);
  });

  it("a date before the year list is accepted", async () => {
    const { app, root } = await mount("");
    const { panel, from, to, show } = await openPeriod(root, app);
    await type(app, from, "15.6.2012");
    day(panel, "2012-06-15");
    await type(app, to, "20.06.2012");
    fireEvent.click(show);
    await settle(app);
    expect(location.hash).toBe("#period=custom&from=2012-06-15&to=2012-06-20");
  });

  it("the Fra and Til fields open on the shown period", async () => {
    const { app, root } = await mount("period=custom&from=2026-02-01&to=2026-03-31");
    const { panel, from, to } = await openPeriod(root, app);
    expect(from.value).toBe("01.02.2026");
    expect(to.value).toBe("31.03.2026");
    expect(day(panel, "2026-03-31").disabled).toBe(false);
    expect(day(panel, "2026-02-01").disabled).toBe(false);
    expect(queryByRole(panel, "button", { name: longDate("2026-04-15") })).toBeNull();
  });

  it("Escape closes the menu without a change", async () => {
    const { app, root } = await mount("period=lastMonth");
    const { from } = await openPeriod(root, app);
    await type(app, from, "03.01.2024");
    fireEvent.keyDown(from, { key: "Escape" });
    await settle(app);
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();
    expect(location.hash).toBe("#period=lastMonth");
    expect(app.shadowRoot!.activeElement).toBe(periodButton(root));
  });

  it("a focusout with no next target still closes Konti", async () => {
    const { app, root } = await mount("");
    fireEvent.click(kontiButton(root));
    await app.updateComplete;
    fireEvent.focusOut(getByRole(root, "checkbox", { name: da.allAccounts }), { relatedTarget: null });
    await settle(app);
    expect(queryByRole(root, "checkbox", { name: da.allAccounts })).toBeNull();
  });

  it("a focusout with no next target keeps the period menu open", async () => {
    const { app, root } = await mount("");
    const { from } = await openPeriod(root, app);
    fireEvent.focusOut(from, { relatedTarget: null });
    await settle(app);
    getByRole(root, "group", { name: da.period });
  });

  it("a focusout with no next target closes the period menu while the document has no focus", async () => {
    const { app, root } = await mount("");
    const { from } = await openPeriod(root, app);
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    fireEvent.focusOut(from, { relatedTarget: null });
    await settle(app);
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();
  });

  it("after a pick, focus is on the picked day and Escape closes the menu", async () => {
    const { app, root } = await mount("period=lastMonth");
    const { panel } = await openPeriod(root, app);
    await pick(app, panel, "2026-09-03");
    const focused = app.shadowRoot!.activeElement as HTMLElement;
    expect(focused).toBe(day(panel, "2026-09-03"));
    fireEvent.keyDown(focused, { key: "Escape" });
    await settle(app);
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();
    expect(location.hash).toBe("#period=lastMonth");
    expect(app.shadowRoot!.activeElement).toBe(periodButton(root));
  });

  it("picking two days in the calendar and pressing Vis gives that period", async () => {
    const { app, root } = await mount("period=lastMonth");
    const { panel, from, to, show } = await openPeriod(root, app);
    await pick(app, panel, "2026-09-03");
    expect(from.value).toBe("03.09.2026");
    expect(to.value).toBe("");
    expect(show.disabled).toBe(true);
    getByRole(root, "group", { name: da.period });
    await pick(app, panel, "2026-09-10");
    expect(to.value).toBe("10.09.2026");
    expect(getByRole(panel, "status").textContent).toBe(da.picked(longDate("2026-09-03"), longDate("2026-09-10")));
    fireEvent.click(show);
    await settle(app);
    expect(location.hash).toBe("#period=custom&from=2026-09-03&to=2026-09-10");
  });

  it("a second day before the first swaps them", async () => {
    const { app, root } = await mount("period=lastMonth");
    const { panel, from, to } = await openPeriod(root, app);
    await pick(app, panel, "2026-09-10");
    await pick(app, panel, "2026-08-20");
    expect(from.value).toBe("20.08.2026");
    expect(to.value).toBe("10.09.2026");
  });

  it("the same day picked twice is a one-day period", async () => {
    const { app, root } = await mount("period=lastMonth");
    const { panel, show } = await openPeriod(root, app);
    await pick(app, panel, "2026-09-10");
    await pick(app, panel, "2026-09-10");
    fireEvent.click(show);
    await settle(app);
    expect(location.hash).toBe("#period=custom&from=2026-09-10&to=2026-09-10");
  });

  it("a day after today cannot be picked", async () => {
    const { app, root } = await mount("period=thisMonth");
    const { panel } = await openPeriod(root, app);
    expect(day(panel, "2026-10-30").disabled).toBe(false);
    expect(day(panel, "2026-10-31").disabled).toBe(true);
  });

  it("typing a date moves the calendar there and picks it", async () => {
    const { app, root } = await mount("");
    const { panel, from } = await openPeriod(root, app);
    await type(app, from, "15.06.2023");
    expect(isPicked(panel, "2023-06-15")).toBe(true);
  });

  it("clearing or spoiling a field clears its day in the calendar and keeps the month", async () => {
    const { app, root } = await mount("period=lastMonth");
    const { panel, from, to } = await openPeriod(root, app);
    expect(isPicked(panel, "2026-09-30")).toBe(true);
    await type(app, to, "");
    expect(isPicked(panel, "2026-09-01")).toBe(true);
    expect(isPicked(panel, "2026-09-30")).toBe(false);
    await type(app, from, "31.02.2026");
    expect(queryAllByRole(panel, "gridcell", { selected: true })).toEqual([]);
    day(panel, "2026-09-15");
  });

  it("a pick and a change of month keep the menu open", async () => {
    const { app, root } = await mount("period=lastMonth");
    const { panel } = await openPeriod(root, app);
    await pick(app, panel, "2026-09-03");
    fireEvent.click(getByRole(panel, "button", { name: da.calendar.arrowPrev.month }));
    await settle(app);
    getByRole(root, "group", { name: da.period });
    day(panel, "2026-07-15");
  });

  it("the arrow keys move between the days", async () => {
    const { app, root } = await mount("period=lastMonth");
    const { panel } = await openPeriod(root, app);
    day(panel, "2026-09-10").focus();
    fireEvent.keyDown(day(panel, "2026-09-10"), { key: "ArrowRight" });
    await settle(app);
    expect(app.shadowRoot!.activeElement).toBe(day(panel, "2026-09-11"));
  });

  it("shows two months, and one below 600 px", async () => {
    const wide = await mount("period=lastMonth");
    const first = await openPeriod(wide.root, wide.app);
    day(first.panel, "2026-08-03");
    day(first.panel, "2026-09-03");
    unmount();
    setViewport(420);
    try {
      const narrow = await mount("period=lastMonth");
      const second = await openPeriod(narrow.root, narrow.app);
      day(second.panel, "2026-09-03");
      expect(queryByRole(second.panel, "button", { name: longDate("2026-08-03") })).toBeNull();
    } finally {
      setViewport(1024);
    }
  });
});

describe("the loading placeholder's key-number boxes", () => {
  const pending = () => new Promise<Response>(() => {});

  function boxes(root: HTMLElement): number {
    const busy = getByRole(root, "group", { name: da.loading });
    return getAllByRole(busy, "listitem").length;
  }

  async function chooseJuly(root: HTMLElement, app: Parameters<typeof settle>[0]) {
    const july = unitName(unitAt("2026-07-01", "month", "2026-10-30"), "month");
    const bars = getByRole(root, "region", { name: da.per("month") });
    fireEvent.click(getByRole(bars, "button", { name: new RegExp(`^${july},`) }));
    await settle(app);
  }

  it("after a period change the placeholder has as many boxes as the page showed", async () => {
    const { app, root } = await mount("", {
      answer: (range, n) => (n === 1 ? json(withSubscriptions(answerFor(range))) : pending()),
    });
    getByRole(root, "group", { name: da.inPeriod("Faste udgifter") });
    await choosePreset(root, app, da.presets.lastYear);
    expect(boxes(root)).toBe(4);
  });

  it("the first load's placeholder has 2 boxes", async () => {
    const { root } = await mount("", { answer: pending });
    expect(boxes(root)).toBe(2);
  });

  it("after choosing a unit, the placeholder has the unit's row", async () => {
    const { app, root } = await mount("", {
      answer: (range, n) => (n === 1 ? json(withSubscriptions(answerFor(range))) : pending()),
    });
    await chooseJuly(root, app);
    await choosePreset(root, app, da.presets.lastYear);
    expect(boxes(root)).toBe(3);
  });

  it("a unit chosen in full screen does not change the row the placeholder keeps", async () => {
    const { app, root } = await mount("", {
      answer: (range, n) => (n === 1 ? json(withSubscriptions(answerFor(range))) : pending()),
    });
    fireEvent.click(getAllByRole(root, "button", { name: da.fullScreen })[0]);
    await settle(app);
    await chooseJuly(root, app);
    await choosePreset(root, app, da.presets.lastYear);
    fireEvent.keyDown(window, { key: "Escape" });
    await settle(app);
    expect(boxes(root)).toBe(4);
  });

  it("after a failed load and a new change the placeholder keeps the last row's count", async () => {
    const { app, root } = await mount("", {
      answer: (range, n) =>
        n === 1 ? json(withSubscriptions(answerFor(range))) : n === 2 ? new Response("", { status: 500 }) : pending(),
    });
    await choosePreset(root, app, da.presets.lastYear);
    getByRole(root, "alert");
    await choosePreset(root, app, da.presets.lastMonth);
    expect(boxes(root)).toBe(4);
  });

  it("drops back to 2 boxes after an answer with no object groups", async () => {
    const { app, root } = await mount("", {
      answer: (range, n) =>
        n === 1 ? json(withSubscriptions(answerFor(range))) : n === 2 ? json(answerFor(range)) : pending(),
    });
    await choosePreset(root, app, da.presets.lastYear);
    expect(queryByRole(root, "group", { name: da.loading })).toBeNull();
    await choosePreset(root, app, da.presets.lastMonth);
    expect(boxes(root)).toBe(2);
  });
});
