import { getByRole, getByText, queryByRole } from "@testing-library/dom";
import { expect } from "vitest";

import { count, kr, plainCount } from "../src/format";
import { da } from "../src/i18n/da";

function flat(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The line over the list with no quick filter: the count and sum, and no Ryd. */
export function plainSummary(root: HTMLElement, n: number, sum: number): HTMLElement {
  const line = getByText(root, da.summary(count(n), kr(sum)));
  expect(queryByRole(root, "button", { name: da.clearQuick })).toBeNull();
  return line;
}

/** The line with a quick filter: what is shown of `all`, then the parts if given, and Ryd. */
export function showingSummary(root: HTMLElement, n: number, all: number, sum: number, parts?: string): HTMLElement {
  const head = da.showing(plainCount(n), count(all), n === 0 ? "" : kr(sum), parts ?? "");
  const wanted = flat(head);
  const line = getByText(root, (content) =>
    parts === undefined ? flat(content).startsWith(wanted) : flat(content) === wanted,
  );
  getByRole(root, "button", { name: da.clearQuick });
  return line;
}
