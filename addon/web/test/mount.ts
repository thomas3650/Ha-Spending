import type { HiddenShopChange, Period } from "@ha-spending/shared";
import { vi } from "vitest";

import "../src/app";
import type { SpendingApp } from "../src/app";
import { answerFor } from "./fixture";

export interface MountOptions {
  now?: string;
  answer?: (range: Period, n: number) => Response | Promise<Response>;
  /** Answers `api/hidden-shops`; the default keeps a list in memory, empty at the start. */
  hidden?: (init: RequestInit | undefined) => Response | Promise<Response>;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function rangeOf(url: string): Period {
  const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  return { start: params.get("start") ?? "", end: params.get("end") ?? "" };
}

/** Lets pending fetches, their JSON and Lit's updates run. */
export async function settle(app: SpendingApp, rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await app.updateComplete;
  }
}

export async function mount(hash: string, opts: MountOptions = {}) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(opts.now ?? "2026-10-30T10:00:00Z");
  let n = 0;
  const fetch = vi.fn(async (...[url]: [url: string, init?: RequestInit]) => {
    n += 1;
    const range = rangeOf(url);
    return opts.answer ? opts.answer(range, n) : json(answerFor(range));
  });
  let shops: string[] = [];
  const hidden = vi.fn(async (init: RequestInit | undefined) => {
    if (opts.hidden) return opts.hidden(init);
    if (init?.method === "POST") {
      const change = JSON.parse(String(init.body)) as HiddenShopChange;
      shops = shops.filter((s) => s !== change.shop);
      if (change.hidden) shops = [...shops, change.shop].sort((a, b) => a.localeCompare(b, "da"));
    }
    return json({ shops });
  });
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    url.startsWith("api/hidden-shops") ? hidden(init) : fetch(url, init),
  );
  history.replaceState(null, "", hash === "" ? location.pathname : `#${hash}`);
  const app = document.createElement("hs-app");
  document.body.append(app);
  await settle(app);
  return { app, root: app.shadowRoot as unknown as HTMLElement, fetch, hidden };
}

export function unmount(): void {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  history.replaceState(null, "", location.pathname);
}
