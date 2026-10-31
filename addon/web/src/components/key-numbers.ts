import { css, html, LitElement } from "lit";
import { da } from "../i18n/da";
import type { KeyCard } from "../model/key-numbers";

/** The three key numbers, or their placeholder while `cards` is null. */
export class KeyNumbers extends LitElement {
  static override properties = {
    cards: { attribute: false },
  };

  declare cards: KeyCard[] | null;

  constructor() {
    super();
    this.cards = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render() {
    if (this.cards === null) {
      return html`<div class="kpis" role="group" aria-busy="true" aria-label=${da.loading}>
        ${[0, 1, 2].map(
          () => html`<div class="card kpi">
            <div class="kpi-bone short"></div>
            <div class="kpi-bone tall"></div>
            <div class="kpi-bone"></div>
          </div>`,
        )}
      </div>`;
    }
    return html`<div class="kpis">
      ${this.cards.map(
        (c) => html`<div class="card kpi" role="group" aria-label=${c.label}>
          <div class="kpi-label">${c.label}</div>
          <div class="kpi-value">${c.value}</div>
          <div class="kpi-sub ${c.trend === "up" ? "kpi-up" : ""}">${c.sub}</div>
        </div>`,
      )}
    </div>`;
  }
}

export const keyNumbersStyles = css`
  .kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .kpi-label {
    color: var(--hs-muted);
    font-size: 12px;
  }
  .kpi-value {
    font-size: 26px;
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
  }
  .kpi-sub {
    color: var(--hs-muted);
    font-size: 12px;
    margin-top: 2px;
  }
  .kpi-sub.kpi-up {
    color: var(--hs-up);
  }
  .kpi-bone {
    height: 12px;
    width: 60%;
    border-radius: 4px;
    background: var(--hs-soft);
    margin-top: 8px;
  }
  .kpi-bone.short {
    width: 40%;
    margin-top: 0;
  }
  .kpi-bone.tall {
    height: 28px;
  }
`;

if (!customElements.get("hs-key-numbers")) customElements.define("hs-key-numbers", KeyNumbers);

declare global {
  interface HTMLElementTagNameMap {
    "hs-key-numbers": KeyNumbers;
  }
}
