import { describe, expect, it, vi } from "vitest";
import { createCache } from "../src/cache";

describe("createCache", () => {
  it("keeps an answer 5 minutes", async () => {
    let t = 0;
    const cache = createCache<string>({ ttlMs: 300_000, max: 20, now: () => t });
    const load = vi.fn(async () => "answer");

    expect(await cache.get("k", load)).toBe("answer");
    t = 299_999;
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(1);
    t = 300_001;
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps at most 20 ranges", async () => {
    const cache = createCache<string>({ ttlMs: 300_000, max: 20, now: () => 0 });
    const loads = new Map<string, number>();
    const get = (key: string) =>
      cache.get(key, async () => {
        loads.set(key, (loads.get(key) ?? 0) + 1);
        return key;
      });

    for (let i = 1; i <= 21; i++) await get(`k${i}`);
    await get("k1");
    await get("k21");
    expect(loads.get("k1")).toBe(2);
    expect(loads.get("k21")).toBe(1);
  });

  it("shares one load and forgets a failure", async () => {
    const cache = createCache<string>({ ttlMs: 300_000, max: 20, now: () => 0 });
    const load = vi.fn(async () => "answer");
    const [a, b] = await Promise.all([cache.get("k", load), cache.get("k", load)]);
    expect([a, b]).toEqual(["answer", "answer"]);
    expect(load).toHaveBeenCalledTimes(1);

    const failing = vi.fn(async (): Promise<string> => {
      throw new Error("down");
    });
    await expect(cache.get("f", failing)).rejects.toThrow("down");
    const again = vi.fn(async () => "back");
    expect(await cache.get("f", again)).toBe("back");
    expect(again).toHaveBeenCalledTimes(1);
  });
});
