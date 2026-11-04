import { getAllByRole, getByRole } from "@testing-library/dom";

export function barsList(root: HTMLElement, name: string): HTMLElement {
  return getByRole(getByRole(root, "region", { name }), "list");
}

export function barButtons(root: HTMLElement, name: string): HTMLElement[] {
  return getAllByRole(barsList(root, name), "button");
}

export function names(buttons: HTMLElement[]): string[] {
  return buttons.map((b) => b.textContent?.trim() ?? "");
}

export function pressed(buttons: HTMLElement[]): string[] {
  return buttons.map((b) => b.getAttribute("aria-pressed") ?? "");
}
