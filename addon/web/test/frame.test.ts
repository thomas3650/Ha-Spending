import { addDays, change, unitAt } from "@ha-spending/shared";
import {
  findByRole,
  fireEvent,
  getAllByRole,
  getByLabelText,
  getByRole,
  getByText,
  queryAllByRole,
  queryByRole,
  queryByText,
  waitFor,
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { comparisonLabel, kr, rangeText, signedPercent } from "../src/format";
import { da } from "../src/i18n/da";
import { answerFor } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

const TODAY = "2026-10-30";
const sep = unitAt("2026-09-01", "month", TODAY);
const aug = unitAt("2026-08-01", "month", TODAY);
/** Keeps Intl's no-break space, which the default normalizer turns into a space. */
const exact = (text: string) => text.trim();
const escaped = (text: string) => new RegExp(text.replace(/[()]/g, "\\$&"));

afterEach(unmount);

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

describe("the frame", () => {
  it("opens on I år by month with all accounts, asking for the widened range", async () => {
    const { root, fetch } = await mount("");
    expect(fetch).toHaveBeenCalledWith("api/data?start=2025-12-01&end=2026-10-30", expect.anything());
    expect(getByRole(root, "heading", { level: 1, name: da.allSpending })).toBeTruthy();
    getByRole(root, "button", { name: new RegExp(`${da.period}.*${da.presets.thisYear}`) });
    expect((getByRole(root, "combobox", { name: da.groupBy }) as HTMLSelectElement).value).toBe("month");
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
    const third = getByRole(root, "group", { name: comparisonLabel(sep, aug, "month") });
    getByText(third, signedPercent(change(1150000, 1100000)!), { normalizer: exact });
    getByText(third, `${da.up} ${kr(50000)}`);
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
    getByRole(root, "button", { name: new RegExp(`^${da.accounts}.*Kreditkort`) });
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

  it("chooses a period from the dropdown and a custom one", async () => {
    const { app, root, fetch } = await mount("");
    await choosePreset(root, app, da.presets.lastYear);
    expect(fetch).toHaveBeenLastCalledWith("api/data?start=2024-12-01&end=2025-12-31", expect.anything());
    expect(location.hash).toBe("#period=lastYear");
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();

    fireEvent.click(periodButton(root));
    await app.updateComplete;
    const from = getByLabelText(root, da.from) as HTMLInputElement;
    const to = getByLabelText(root, da.to) as HTMLInputElement;
    const show = getByRole(root, "button", { name: da.show }) as HTMLButtonElement;
    from.value = "2026-04-01";
    fireEvent.input(from);
    to.value = "2026-03-01";
    fireEvent.input(to);
    await app.updateComplete;
    expect(show.disabled).toBe(true);
    from.value = "2026-02-01";
    fireEvent.input(from);
    to.value = "2026-03-31";
    fireEvent.input(to);
    await app.updateComplete;
    expect(show.disabled).toBe(false);
    fireEvent.click(show);
    await settle(app);
    expect(location.hash).toBe("#period=custom&from=2026-02-01&to=2026-03-31");
  });

  it("pushes a click and follows the hash back", async () => {
    const { app, root } = await mount("");
    const push = vi.spyOn(history, "pushState");
    await choosePreset(root, app, da.presets.lastYear);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(null, "", "#period=lastYear");

    history.replaceState(null, "", "#by=week");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle(app);
    expect((getByRole(root, "combobox", { name: da.groupBy }) as HTMLSelectElement).value).toBe("week");
    getByRole(root, "button", { name: new RegExp(`${da.period}.*${da.presets.thisYear}`) });
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
    expect(fetch.mock.calls[0][0]).toBe("api/data?start=2025-12-01&end=2026-10-31");
    expect(fetch.mock.calls[1][0]).toBe("api/data?start=2025-12-01&end=2026-10-30");
    getByRole(root, "button", { name: new RegExp(rangeText({ start: "2026-01-01", end: TODAY })) });
  });

  it("retries at most once, and a retry never moves today", async () => {
    const { app, root, fetch } = await mount("", {
      now: "2026-10-31T00:30:00+01:00",
      answer: (range) => json(answerFor(range, addDays(range.end, -1))),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe("api/data?start=2025-12-01&end=2026-10-31");
    expect(fetch.mock.calls[1][0]).toBe("api/data?start=2025-12-01&end=2026-10-30");
    getByRole(root, "button", { name: new RegExp(rangeText({ start: "2026-01-01", end: TODAY })) });
    getByText(firstCard(root), kr(11566012));

    await choosePreset(root, app, da.presets.lastYear);
    expect(fetch.mock.calls[2][0]).toBe("api/data?start=2024-12-01&end=2025-12-31");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("falls back from an unknown main group and replaces the hash", async () => {
    const replace = vi.spyOn(history, "replaceState");
    const push = vi.spyOn(history, "pushState");
    const { root } = await mount("group=Ukendt");
    expect(getByRole(root, "heading", { level: 1, name: da.allSpending })).toBeTruthy();
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

  it("names the trail's links back to their level", async () => {
    const { root } = await mount("group=Mad&category=Café");
    const trail = getByRole(root, "navigation", { name: da.trail });
    expect(getByRole(trail, "link", { name: da.allSpending }).getAttribute("href")).toBe("#");
    expect(getByRole(trail, "link", { name: "Mad" }).getAttribute("href")).toBe("#group=Mad");
    getByRole(trail, "heading", { level: 1, name: "Café" });
    await waitFor(() => getByRole(root, "group", { name: da.inPeriod("Café") }));
  });
});
