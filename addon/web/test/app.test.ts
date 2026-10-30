import { findByText, getByRole, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../src/app";
import { da } from "../src/i18n/da";

interface AppElement extends HTMLElement {
  updateComplete: Promise<boolean>;
}

async function mount(): Promise<{ app: AppElement; root: HTMLElement }> {
  const app = document.createElement("hs-app") as AppElement;
  document.body.append(app);
  await app.updateComplete;
  return { app, root: app.shadowRoot as unknown as HTMLElement };
}

function answer(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body)));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("<hs-app>", () => {
  it("says Hej", async () => {
    vi.stubGlobal("fetch", answer({ status: "ok", version: "1.2.3" }));
    const { root } = await mount();

    expect(getByRole(root, "heading", { level: 1, name: da.hello })).toBeTruthy();
  });

  it("shows the server version", async () => {
    vi.stubGlobal("fetch", answer({ status: "ok", version: "1.2.3" }));
    const { root } = await mount();

    expect(await findByText(root, da.version("1.2.3"))).toBeTruthy();
  });

  it("asks with a relative URL", async () => {
    const fetch = answer({ status: "ok", version: "1.2.3" });
    vi.stubGlobal("fetch", fetch);
    await mount();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("api/health");
  });

  it("still says Hej when the server does not answer", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetch);
    const { app, root } = await mount();

    expect(fetch).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve));
    await app.updateComplete;
    expect(getByRole(root, "heading", { level: 1, name: da.hello })).toBeTruthy();
    expect(queryByText(root, /Version/)).toBeNull();
  });
});
