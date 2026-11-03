import { fireEvent, getByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { da } from "../src/i18n/da";
import type { DetailKey } from "../src/state/view";
import { answerFor, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

afterEach(unmount);

const CAFE: DetailKey = { kind: "posting", id: "p23" };
const LATER: DetailKey = { kind: "posting", id: "p26" };

async function open(app: SpendingApp, key: DetailKey): Promise<void> {
  app.dispatchEvent(new CustomEvent("detail-open", { detail: key, bubbles: true, composed: true }));
  await settle(app);
}

async function close(app: SpendingApp): Promise<void> {
  app.dispatchEvent(new CustomEvent("detail-close", { bubbles: true, composed: true }));
  await settle(app);
}

async function escape(app: SpendingApp, target: Element | Window = window): Promise<void> {
  fireEvent.keyDown(target, { key: "Escape" });
  await settle(app);
}

async function hashBecomes(app: SpendingApp, hash: string): Promise<void> {
  await vi.waitFor(() => expect(location.hash).toBe(hash));
  await settle(app);
}

function fullScreen(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: da.fullScreen });
}

describe("the detail in the history", () => {
  it("open, then Back, shows the list", async () => {
    const { app, root } = await mount("card=postings");
    const length = history.length;
    await open(app, CAFE);
    expect(location.hash).toBe("#card=postings&detail=p%3Ap23");
    expect(history.length).toBe(length + 1);
    history.back();
    await hashBecomes(app, "#card=postings");
    getByRole(root, "region", { name: da.postingsTitle });
  });

  it("a detail-open for a key that does not resolve adds no history entry", async () => {
    const { app } = await mount("card=postings");
    const length = history.length;
    await open(app, { kind: "posting", id: "nope" });
    expect(history.length).toBe(length);
    expect(location.hash).toBe("#card=postings");
  });

  it("two rows then Back shows the list", async () => {
    const { app } = await mount("card=postings");
    const length = history.length;
    await open(app, CAFE);
    await open(app, LATER);
    expect(location.hash).toBe("#card=postings&detail=p%3Ap26");
    expect(history.length).toBe(length + 1);
    history.back();
    await hashBecomes(app, "#card=postings");
  });

  it("two rows then close goes back to the list, and Back then leaves the list", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
    await settle(app);
    await open(app, CAFE);
    await open(app, LATER);
    await close(app);
    await hashBecomes(app, "#card=postings");
    history.back();
    await hashBecomes(app, "");
  });

  it("two Escapes in a row close the detail once and then leave full screen", async () => {
    const { app, root } = await mount("card=postings");
    fireEvent.click(fullScreen(root));
    await settle(app);
    await open(app, CAFE);
    // happy-dom's Back fires popstate at once; a browser's comes later, which is the case this test is about.
    const back = history.back.bind(history);
    vi.spyOn(history, "back").mockImplementation(() => void setTimeout(back));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Escape" });
    await hashBecomes(app, "#card=postings");
    await settle(app);
    expect(location.hash).toBe("#card=postings");
    expect(fullScreen(root).getAttribute("aria-pressed")).toBe("false");
  });

  const showAll = (root: HTMLElement) => getByRole(root, "button", { name: da.showAll });
  const bars = (root: HTMLElement) =>
    getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.bars });

  it.each([
    ["Vis alle", showAll, "#card=postings&view=all-postings"],
    ["the card", bars, ""],
  ])("a choice that changes the screen or the card closes the detail: %s", async (_, button, hash) => {
    const { app, root } = await mount("card=postings");
    // Full screen shows Vis alle and keeps the list's rows above the detail; the normal page hides them while it is open.
    fireEvent.click(fullScreen(root));
    await settle(app);
    await open(app, CAFE);
    expect(location.hash).toBe("#card=postings&detail=p%3Ap23");
    fireEvent.click(button(root));
    await settle(app);
    expect(location.hash).toBe(hash);
  });

  it("open, close, then Back does not reopen it", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
    await settle(app);
    expect(location.hash).toBe("#card=postings");
    await open(app, CAFE);
    await close(app);
    await hashBecomes(app, "#card=postings");
    history.back();
    await hashBecomes(app, "");
    await settle(app);
    expect(location.hash).toBe("");
  });

  it("open, change the level, then close: the level stays and the detail is closed", async () => {
    const { app, root } = await mount("card=postings");
    await open(app, CAFE);
    fireEvent.click(getByRole(getByRole(root, "region", { name: da.mainGroups }), "button", { name: /^Mad,/ }));
    await settle(app);
    expect(location.hash).toBe("#group=Mad&card=postings&detail=p%3Ap23");
    const length = history.length;
    await close(app);
    expect(location.hash).toBe("#group=Mad&card=postings");
    expect(history.length).toBe(length);
  });

  it("a detail from a reload closes by replacing", async () => {
    const { app } = await mount("card=postings&detail=p%3Ap23");
    expect(location.hash).toBe("#card=postings&detail=p%3Ap23");
    const length = history.length;
    await close(app);
    expect(location.hash).toBe("#card=postings");
    expect(history.length).toBe(length);
  });

  it("Escape closes the detail and not full screen, and a second Escape leaves full screen", async () => {
    const { app, root } = await mount("card=postings");
    fireEvent.click(fullScreen(root));
    await settle(app);
    await open(app, CAFE);
    await escape(app);
    await hashBecomes(app, "#card=postings");
    expect(fullScreen(root).getAttribute("aria-pressed")).toBe("true");
    await escape(app);
    expect(fullScreen(root).getAttribute("aria-pressed")).toBe("false");
  });

  it("Escape on Alle posteringer closes the detail", async () => {
    const { app } = await mount("view=all-postings&detail=p%3Ap23");
    await escape(app);
    expect(location.hash).toBe("#view=all-postings");
  });

  it("Escape with the period dropdown open closes only that and keeps the detail", async () => {
    const { app, root } = await mount("card=postings&detail=p%3Ap23");
    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    const preset = getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastYear });
    preset.focus();
    await escape(app, preset);
    expect(queryByRole(root, "group", { name: da.period })).toBeNull();
    expect(location.hash).toBe("#card=postings&detail=p%3Ap23");
  });

  it("Escape with the search's suggestions open closes only them and keeps the detail", async () => {
    const { app, root } = await mount("card=postings&detail=p%3Ap23");
    fireEvent.click(fullScreen(root));
    await settle(app);
    const box = getByRole(root, "combobox", { name: da.searchLabel });
    box.focus();
    fireEvent.input(box, { target: { value: "n" } });
    await settle(app);
    getByRole(root, "listbox", { name: da.suggestions });
    await escape(app, box);
    expect(queryByRole(root, "listbox", { name: da.suggestions })).toBeNull();
    expect(location.hash).toBe("#card=postings&q=n&detail=p%3Ap23");
  });
});

describe("the links built from an action leave no detail", () => {
  async function follow(app: SpendingApp, link: HTMLElement): Promise<void> {
    expect(link.getAttribute("href")).not.toContain("detail");
    fireEvent.click(link);
    await settle(app);
    expect(location.hash).not.toContain("detail");
  }

  it("the first key number's link", async () => {
    const { app, root } = await mount("card=postings&detail=p%3Ap23");
    const first = getByRole(root, "group", { name: da.spendingInPeriod });
    await follow(app, getByRole(first, "link", { name: /→$/ }));
    expect(location.hash).toBe("#card=postings&view=all-postings");
  });

  it("an object group's N posteringer link", async () => {
    const { app, root } = await mount("card=postings&detail=p%3Ap23", {
      answer: (range) => json(withSubscriptions(answerFor(range))),
    });
    const group = getByRole(root, "group", { name: da.inPeriod("Abonnementer") });
    await follow(app, getByRole(group, "link", { name: /→$/ }));
    expect(location.hash).toBe("#card=postings&view=all-postings&og=Abonnementer");
  });

  it("the trail back from Alle posteringer", async () => {
    const { app, root } = await mount("view=all-postings&detail=p%3Ap23");
    const trail = getByRole(root, "navigation", { name: da.trail });
    await follow(app, getByRole(trail, "link", { name: da.allSpending }));
    expect(location.hash).toBe("");
  });
});
