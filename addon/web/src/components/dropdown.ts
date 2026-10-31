import { css, LitElement, type PropertyDeclarations } from "lit";

const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";

function onFocusable(path: EventTarget[]): boolean {
  return path.some((target) => target instanceof Element && target.matches(FOCUSABLE));
}

/**
 * A field that opens a panel. Escape or a click outside closes it and returns focus to the field's button; focus
 * leaving closes it too. The pickers render into the app's shadow root (no shadow root of their own), so one tree
 * holds every role and name.
 */
export class Dropdown extends LitElement {
  static override properties: PropertyDeclarations = {
    open: { state: true },
  };

  declare open: boolean;

  constructor() {
    super();
    this.open = false;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private readonly onDocumentClick = (event: MouseEvent): void => {
    const path = event.composedPath();
    if (!this.open || path.includes(this)) return;
    // A click on another control moves focus there, so focus stays with it.
    void this.close(!onFocusable(path));
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.open) return;
    event.stopPropagation();
    void this.close(true);
  };

  /** The panel has tabindex -1, so a click on its background keeps focus inside. */
  private readonly onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (this.open && !(next instanceof Node && this.contains(next))) void this.close(false);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("click", this.onDocumentClick);
    this.addEventListener("keydown", this.onKeyDown);
    this.addEventListener("focusout", this.onFocusOut);
  }

  override disconnectedCallback(): void {
    document.removeEventListener("click", this.onDocumentClick);
    this.removeEventListener("keydown", this.onKeyDown);
    this.removeEventListener("focusout", this.onFocusOut);
    super.disconnectedCallback();
  }

  protected toggle(): void {
    this.open = !this.open;
  }

  protected async close(focus: boolean): Promise<void> {
    this.open = false;
    await this.updateComplete;
    if (focus) this.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
  }
}

export const dropdownStyles = css`
  .dd {
    position: relative;
  }
  .sel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 190px;
    padding: 6px 36px 6px 12px;
    border: 1px solid var(--hs-field);
    border-radius: 8px;
    background: var(--hs-card);
    color: var(--hs-text);
    font: inherit;
    text-align: left;
    position: relative;
    cursor: pointer;
  }
  .sel:disabled {
    cursor: default;
    color: var(--hs-muted);
  }
  .sel small {
    color: var(--hs-muted);
    font-size: 11px;
  }
  .sel span {
    font-size: 14px;
  }
  .sel::after {
    content: "▾";
    position: absolute;
    right: 12px;
    top: 14px;
    color: var(--hs-muted);
  }
  .sel[aria-expanded="true"],
  .sel:focus-visible {
    border: 2px solid var(--hs-accent);
    padding: 5px 35px 5px 11px;
    outline: none;
  }
  .sel[aria-expanded="true"] small {
    color: var(--hs-accent);
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 100%;
    background: var(--hs-card);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
    padding: 6px 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
  }
  .menu:focus {
    outline: none;
  }
  .menu.end {
    left: auto;
    right: 0;
  }
  .menu hr {
    border: 0;
    border-top: 1px solid var(--hs-line);
    margin: 6px 0;
    width: 100%;
  }
  .o {
    padding: 9px 16px;
    white-space: nowrap;
    border: 0;
    background: none;
    color: var(--hs-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .o:hover,
  .o:focus-visible {
    background: var(--hs-soft);
    outline: none;
  }
  .o[aria-pressed="true"] {
    background: var(--hs-accent-soft);
    color: var(--hs-accent-text);
  }
  .cb {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 9px 16px;
    white-space: nowrap;
    cursor: pointer;
  }
  .cb input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--hs-accent);
  }
`;
