import { getDefaultNormalizer, queryAllByRole } from "@testing-library/dom";

/** Numbers carry Intl's no-break space, which the default normalizer would turn into a plain one. */
export const KEEP_NBSP = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

function row(root: HTMLElement): HTMLElement {
  return root.querySelector("hs-key-numbers") as HTMLElement;
}

/** The names of the key-number row's groups in page order, without the ones named in `leaveOut`. */
export function cardNames(root: HTMLElement, leaveOut: string[] = []): string[] {
  return queryAllByRole(row(root), "group")
    .map((el) => el.getAttribute("aria-label") ?? "")
    .filter((name) => !leaveOut.includes(name));
}

export function hasArrow(root: HTMLElement): boolean {
  return /[▲▼]/.test(row(root).textContent ?? "");
}
