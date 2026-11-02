import type { DataError, HiddenShopChange, HiddenShops, Period, SpendingData } from "@ha-spending/shared";

export type LoadErrorCode = "unreachable" | "refused" | "failed";

export class LoadError extends Error {
  constructor(readonly code: LoadErrorCode) {
    super(code);
    this.name = "LoadError";
  }
}

async function codeOf(response: Response): Promise<LoadErrorCode> {
  if (response.status !== 502) return "failed";
  try {
    const body = (await response.json()) as Partial<DataError>;
    return body.error === "unreachable" || body.error === "refused" ? body.error : "failed";
  } catch {
    return "failed";
  }
}

/** An abort rethrows the AbortError; every other failure is a LoadError. */
export async function loadData(range: Period, signal: AbortSignal): Promise<SpendingData> {
  try {
    // Relative, so the request stays under Ingress's prefix.
    const response = await fetch(`api/data?start=${range.start}&end=${range.end}`, { signal });
    if (!response.ok) throw new LoadError(await codeOf(response));
    return (await response.json()) as SpendingData;
  } catch (error) {
    if (signal.aborted || error instanceof LoadError) throw error;
    throw new LoadError("failed");
  }
}

async function hiddenShopsOf(response: Response): Promise<string[]> {
  if (!response.ok) throw new Error(`hidden shops: ${response.status}`);
  const body = (await response.json()) as Partial<HiddenShops>;
  if (!Array.isArray(body.shops) || !body.shops.every((s) => typeof s === "string")) {
    throw new Error("hidden shops: not a list");
  }
  return body.shops;
}

export async function loadHiddenShops(): Promise<string[]> {
  return hiddenShopsOf(await fetch("api/hidden-shops"));
}

export async function setHiddenShop(shop: string, hidden: boolean): Promise<string[]> {
  const change: HiddenShopChange = { shop, hidden };
  const response = await fetch("api/hidden-shops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
  return hiddenShopsOf(response);
}
