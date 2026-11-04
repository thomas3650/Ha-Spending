import { css, html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { kr } from "../format";
import { da } from "../i18n/da";
import type { ObjectGroupRow } from "../model/fixed";
import { CARET, Dropdown } from "./dropdown";

/**
 * The fixed-expenses view's object-group step: the chosen group, or "Alle faste udgifter", opening the list of the
 * groups and Alle. Fires `object-group-choose` with a row's name (null is Alle), and nothing for the current row.
 */
export class ObjectGroupMenu extends Dropdown {
  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
    name: { attribute: false },
  };

  /** null while the answer loads and on an error. */
  declare rows: ObjectGroupRow[] | null;
  /** The step's text. */
  declare name: string;

  constructor() {
    super();
    this.rows = null;
    this.name = "";
  }

  private get disabled(): boolean {
    return this.rows === null || this.rows.length === 0;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("rows") && this.disabled) this.open = false;
  }

  private choose(row: ObjectGroupRow): void {
    void this.close(true);
    if (!row.current) this.dispatchEvent(new CustomEvent<string | null>("object-group-choose", { detail: row.name }));
  }

  override render() {
    const rows = this.rows;
    return html`<div class="dd">
      <button
        type="button"
        class="trail-dd"
        aria-label=${da.switchObjectGroup(this.name)}
        aria-expanded=${this.open ? "true" : "false"}
        ?disabled=${this.disabled}
        @click=${() => this.toggle()}
      >
        ${this.name}${CARET}
      </button>
      ${this.open && rows !== null && !this.disabled
        ? html`<div class="dd-menu object-group-menu" tabindex="-1" role="group" aria-label=${da.objectGroups}>
            ${rows.map((row) => {
              const name = row.name ?? da.all;
              const line = da.billsInPeriod(row.count, kr(row.sum));
              return html`<button
                type="button"
                class="dd-option object-group-row"
                aria-label=${`${name}, ${line}`}
                aria-current=${row.current ? "true" : nothing}
                @click=${() => this.choose(row)}
              >
                <span>${name}</span><small class="object-group-line">${line}</small>
              </button>`;
            })}
          </div>`
        : nothing}
    </div>`;
  }
}

export const objectGroupMenuStyles = css`
  .dd-menu.object-group-menu {
    width: max-content;
  }
  .object-group-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .object-group-row[aria-current="true"] {
    background: var(--hs-accent-soft);
    color: var(--hs-accent-text);
  }
  .object-group-line {
    color: var(--hs-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .object-group-row[aria-current="true"] .object-group-line {
    color: inherit;
  }
`;

if (!customElements.get("hs-object-group-menu")) customElements.define("hs-object-group-menu", ObjectGroupMenu);

declare global {
  interface HTMLElementTagNameMap {
    "hs-object-group-menu": ObjectGroupMenu;
  }
}
