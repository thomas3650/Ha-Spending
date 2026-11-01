import { css, html, LitElement, nothing } from "lit";
import { da } from "../i18n/da";
import type { KeyCard } from "../model/key-numbers";
import { fire } from "./chip";

export interface SubscriptionsKey {
  card: KeyCard;
  /** The right card shows Faste udgifter. */
  pressed: boolean;
}

/**
 * The three key numbers, and Faste udgifter om året as a fourth when there are subscriptions; their placeholder while
 * `cards` is null.
 */
export class KeyNumbers extends LitElement {
  static override properties = {
    cards: { attribute: false },
    subscriptions: { attribute: false },
  };

  declare cards: KeyCard[] | null;
  declare subscriptions: SubscriptionsKey | null;

  constructor() {
    super();
    this.cards = null;
    this.subscriptions = null;
  }

  private subscriptionsButton(key: SubscriptionsKey) {
    const c = key.card;
    return html`<button
      type="button"
      class="card kpi kpi-toggle"
      aria-pressed=${String(key.pressed)}
      @click=${() => fire(this, "subscriptions-toggle")}
    >
      <span class="kpi-label">${c.label}</span>
      <span class="kpi-value">${c.value}</span>
      <span class="kpi-sub">${c.sub}</span>
    </button>`;
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
    const subscriptions = this.subscriptions;
    return html`<div class="kpis ${subscriptions === null ? "" : "four"}">
      ${this.cards.map(
        (c) => html`<div class="card kpi" role="group" aria-label=${c.label}>
          <div class="kpi-label">${c.label}</div>
          <div class="kpi-value">${c.value}</div>
          <div class="kpi-sub ${c.trend === "up" ? "kpi-up" : ""}">${c.sub}</div>
        </div>`,
      )}
      ${subscriptions === null ? nothing : this.subscriptionsButton(subscriptions)}
    </div>`;
  }
}

export const keyNumbersStyles = css`
  .kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .kpis.four {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  @media (max-width: 1023px) {
    .kpis.four {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 599px) {
    .kpis,
    .kpis.four {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .kpi-toggle {
    display: block;
    width: 100%;
    font: inherit;
    color: var(--hs-text);
    text-align: left;
    cursor: pointer;
  }
  .kpi-toggle > span {
    display: block;
  }
  .kpi-toggle:hover {
    border-color: var(--hs-accent);
  }
  .kpi-toggle[aria-pressed="true"] {
    border-color: var(--hs-accent);
    box-shadow: inset 0 0 0 1px var(--hs-accent);
  }
  .kpi-toggle:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
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
