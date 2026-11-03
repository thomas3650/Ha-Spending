import { getDefaultNormalizer, queryAllByRole } from "@testing-library/dom";

import { da } from "../src/i18n/da";

/** Numbers carry Intl's no-break space, which the default normalizer would turn into a plain one. */
export const KEEP_NBSP = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

/** The row's plain cards by name in page order, without the view switch and the fixture's object group. */
export function cardNames(root: HTMLElement): string[] {
  return queryAllByRole(root, "group")
    .map((el) => el.getAttribute("aria-label") ?? "")
    .filter((name) => name !== da.view && name !== da.inPeriod("Abonnementer"));
}

export function hasArrow(root: HTMLElement): boolean {
  return /[▲▼]/.test(root.textContent ?? "");
}
