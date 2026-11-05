import { css, html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { da } from "../i18n/da";
import { CARET, Dropdown } from "./dropdown";

export interface UnitRow {
  fullStart: string;
  name: string;
  /** Written out, since the overview and the view word their sums differently. */
  sum: string;
  current: boolean;
}

export interface UnitStep {
  word: "month" | "year";
  /** null while the answer loads and on an error. */
  rows: UnitRow[] | null;
  /** The chosen unit's name; null is the dashed button. */
  chosen: string | null;
}

/**
 * The trail's unit step, or with nothing chosen its dashed button. Either opens the list of the bars' units. Fires
 * `unit-choose` with a row's `fullStart`, and nothing for the current row.
 */
export class UnitMenu extends Dropdown {
  static override properties: PropertyDeclarations = {
    step: { attribute: false },
    heading: { attribute: false },
    greyed: { attribute: false },
  };

  declare step: UnitStep;
  /** The last step is the page's heading. */
  declare heading: boolean;
  /** Why the step does not open here; null where it works. */
  declare greyed: string | null;

  constructor() {
    super();
    this.step = { word: "month", rows: null, chosen: null };
    this.heading = false;
    this.greyed = null;
  }

  private get disabled(): boolean {
    if (this.greyed !== null) return false;
    return this.step.rows === null || this.step.rows.length === 0;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("step") && this.disabled) this.open = false;
  }

  private choose(row: UnitRow): void {
    void this.close(true);
    if (!row.current) this.dispatchEvent(new CustomEvent<string>("unit-choose", { detail: row.fullStart }));
  }

  private button() {
    const month = this.step.word === "month";
    const name = this.step.chosen;
    const label =
      name === null ? (month ? da.chooseMonth : da.chooseYear) : month ? da.switchMonth(name) : da.switchYear(name);
    return html`<button
      type="button"
      class=${name === null ? "trail-add" : "trail-dd"}
      aria-label=${label}
      aria-expanded=${this.open ? "true" : "false"}
      aria-disabled=${this.greyed === null ? nothing : "true"}
      title=${this.greyed ?? nothing}
      ?disabled=${this.disabled}
      @click=${() => {
        if (this.greyed === null) this.toggle();
      }}
    >
      ${name === null ? (month ? da.monthStep : da.yearStep) : html`${name}${CARET}`}
    </button>`;
  }

  override render() {
    const button = this.button();
    const rows = this.step.rows;
    return html`<div class="dd">
      ${this.heading ? html`<h1 tabindex="-1">${button}</h1>` : button}
      ${this.open && rows !== null && !this.disabled
        ? html`<div class="dd-menu unit-menu" tabindex="-1" role="group" aria-label=${da.units}>
            ${rows.map(
              (row) =>
                html`<button
                  type="button"
                  class="dd-option unit-row"
                  aria-label=${`${row.name}, ${row.sum}`}
                  aria-current=${row.current ? "true" : nothing}
                  @click=${() => this.choose(row)}
                >
                  <span>${row.name}</span><span class="unit-sum">${row.sum}</span>
                </button>`,
            )}
          </div>`
        : nothing}
    </div>`;
  }
}

export const unitMenuStyles = css`
  .dd-menu.unit-menu {
    width: max-content;
  }
  .unit-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px 10px;
  }
  .unit-row[aria-current="true"] {
    background: var(--hs-accent-soft);
    color: var(--hs-accent-text);
  }
  .unit-sum {
    padding-left: 16px;
    color: var(--hs-muted);
    font-variant-numeric: tabular-nums;
  }
  .unit-row[aria-current="true"] .unit-sum {
    color: inherit;
  }
`;

if (!customElements.get("hs-unit-menu")) customElements.define("hs-unit-menu", UnitMenu);

declare global {
  interface HTMLElementTagNameMap {
    "hs-unit-menu": UnitMenu;
  }
}
