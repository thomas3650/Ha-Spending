import { css, html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { kr, partLabel } from "../format";
import { da } from "../i18n/da";
import type { LevelRow } from "../model/circle";
import { CARET, Dropdown } from "./dropdown";

/**
 * The trail's main group or category step, or with no `name` its dashed button for the next level. Either opens the
 * list of the circle's pieces at that level. Fires `level-choose` with a row's key, and nothing for the current row.
 */
export class LevelMenu extends Dropdown {
  static override properties: PropertyDeclarations = {
    level: { attribute: false },
    rows: { attribute: false },
    name: { attribute: false },
    heading: { attribute: false },
    greyed: { attribute: false },
  };

  declare level: "mainGroup" | "category";
  /** null while the answer loads and on an error. */
  declare rows: LevelRow[] | null;
  /** The chosen part's name; null is the dashed button. */
  declare name: string | null;
  /** The last step is the page's heading. */
  declare heading: boolean;
  /** Why the step does not open here; null where it works. */
  declare greyed: string | null;

  constructor() {
    super();
    this.level = "mainGroup";
    this.rows = null;
    this.name = null;
    this.heading = false;
    this.greyed = null;
  }

  private get disabled(): boolean {
    if (this.greyed !== null) return false;
    return this.rows === null || this.rows.length === 0;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("rows") && this.disabled) this.open = false;
  }

  private choose(row: LevelRow): void {
    void this.close(true);
    if (!row.current) this.dispatchEvent(new CustomEvent<string | null>("level-choose", { detail: row.key }));
  }

  private button() {
    const mainGroup = this.level === "mainGroup";
    const name = this.name;
    const label =
      name === null
        ? mainGroup
          ? da.chooseMainGroup
          : da.chooseCategory
        : mainGroup
          ? da.switchMainGroup(name)
          : da.switchCategory(name);
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
      ${name === null ? (mainGroup ? da.mainGroupStep : da.categoryStep) : html`${name}${CARET}`}
    </button>`;
  }

  override render() {
    const button = this.button();
    return html`<div class="dd">
      ${this.heading ? html`<h1 tabindex="-1">${button}</h1>` : button}
      ${this.open && this.rows !== null && !this.disabled
        ? html`<div
            class="dd-menu level-menu"
            tabindex="-1"
            role="group"
            aria-label=${this.level === "mainGroup" ? da.mainGroups : da.categories}
          >
            ${this.rows.map(
              (row) =>
                html`<button
                  type="button"
                  class="dd-option level-row"
                  aria-label=${
                    row.sumText === undefined ? partLabel(row.name, row.sum, null) : `${row.name}, ${row.sumText}`
                  }
                  aria-current=${row.current ? "true" : nothing}
                  @click=${() => this.choose(row)}
                >
                  <span class="level-dot" aria-hidden="true" style=${styleMap({ background: row.colour })}></span
                  ><span>${row.name}</span><span class="level-sum">${row.sumText ?? kr(row.sum)}</span>
                </button>`,
            )}
          </div>`
        : nothing}
    </div>`;
  }
}

export const levelMenuStyles = css`
  .level-row {
    grid-template-columns: auto 1fr auto;
  }
  .level-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
`;

if (!customElements.get("hs-level-menu")) customElements.define("hs-level-menu", LevelMenu);

declare global {
  interface HTMLElementTagNameMap {
    "hs-level-menu": LevelMenu;
  }
}
