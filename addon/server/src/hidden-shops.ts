import { readFile, rename, writeFile } from "node:fs/promises";
import type { HiddenShops } from "@ha-spending/shared";

export const MAX_HIDDEN_SHOPS = 500;
export const MAX_SHOP_NAME = 200;

export class HiddenShopsFull extends Error {
  constructor() {
    super("hidden shops: full");
    this.name = "HiddenShopsFull";
  }
}

export interface HiddenShopsStore {
  read(): Promise<string[]>;
  set(shop: string, hidden: boolean): Promise<string[]>;
}

function isHiddenShops(value: unknown): value is HiddenShops {
  if (typeof value !== "object" || value === null) return false;
  const shops = (value as { shops?: unknown }).shops;
  return Array.isArray(shops) && shops.every((shop) => typeof shop === "string");
}

export function createHiddenShopsStore(path: string, log: (message: string) => void): HiddenShopsStore {
  // Every set waits for the one before, so two changes sent at once both end in the file.
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<string[]> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (!isHiddenShops(parsed)) {
      log("hidden shops: unreadable, treated as empty");
      return [];
    }
    return parsed.shops;
  }

  async function change(shop: string, hidden: boolean): Promise<string[]> {
    const shops = await read();
    if (shops.includes(shop) === hidden) return shops;
    if (hidden && shops.length >= MAX_HIDDEN_SHOPS) throw new HiddenShopsFull();
    const next = (hidden ? [...shops, shop] : shops.filter((s) => s !== shop)).sort((a, b) => a.localeCompare(b, "da"));
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify({ shops: next } satisfies HiddenShops));
    await rename(temporary, path);
    return next;
  }

  return {
    read,
    set(shop, hidden) {
      const result = queue.then(() => change(shop, hidden));
      queue = result.catch(() => undefined);
      return result;
    },
  };
}
