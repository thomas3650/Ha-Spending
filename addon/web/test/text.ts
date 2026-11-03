import { getDefaultNormalizer, queryAllByRole } from "@testing-library/dom";

import { da } from "../src/i18n/da";

/** Numbers carry Intl's no-break space, which the default normalizer would turn into a plain one. */
export const KEEP_NBSP = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

/** The names of the page's groups in order, without the view switch and the ones named in `leaveOut`. */
export function cardNames(root: HTMLElement, leaveOut: string[] = []): string[] {
  return queryAllByRole(root, "group")
    .map((el) => el.getAttribute("aria-label") ?? "")
    .filter((name) => name !== da.view && !leaveOut.includes(name));
}

export function hasArrow(root: HTMLElement): boolean {
  return /[▲▼]/.test(root.textContent ?? "");
}
