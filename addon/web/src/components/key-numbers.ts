import { css, html, LitElement, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { count } from "../format";
import { da } from "../i18n/da";
import type { KeyCard } from "../model/key-numbers";
import { fire } from "./chip";

export interface ObjectGroupKeys {
  cards: KeyCard[];
  /** The household has kept bills, so each card switches the right card to Faste udgifter. */
  toggle: boolean;
  /** The right card shows Faste udgifter. */
  pressed: boolean;
}

/** The three key numbers, then one per object group; their placeholder while `cards` is null. */
export class KeyNumbers extends LitElement {
  static override properties = {
    cards: { attribute: false },
    objectGroups: { attribute: false },
    boxes: { attribute: false },
  };

  declare cards: KeyCard[] | null;
  declare objectGroups: ObjectGroupKeys | null;
  /** How many boxes the placeholder draws. */
  declare boxes: number;

  constructor() {
    super();
    this.cards = null;
    this.objectGroups = null;
    this.boxes = 3;
  }

  private postingsLine(c: KeyCard) {
    const p = c.postings;
    if (p === undefined) return nothing;
    return p.count === 0
      ? html`<div class="kpi-link">${count(0)}</div>`
      : html`<a class="kpi-link" href=${p.href}>${da.postingsLink(count(p.count))}</a>`;
  }

  private objectCard(c: KeyCard, groups: ObjectGroupKeys) {
    const body = html`<span class="kpi-label">${c.label}</span>
      <span class="kpi-value">${c.value}</span>
      <span class="kpi-sub">${c.sub}</span>`;
    return html`<div class="card kpi kpi-group" role="group" aria-label=${c.label}>
      ${groups.toggle
        ? html`<button
            type="button"
            class="kpi-toggle"
            aria-pressed=${String(groups.pressed)}
            @click=${() => fire(this, "subscriptions-toggle")}
          >
            ${body}
          </button>`
        : html`<div class="kpi-plain">${body}</div>`}
      ${this.postingsLine(c)}
    </div>`;
  }

  private plainCard(c: KeyCard) {
    return html`<div class="card kpi" role="group" aria-label=${c.label}>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      ${this.postingsLine(c)}
      <div class="kpi-sub ${c.trend === "up" ? "kpi-up" : ""}">${c.sub}</div>
    </div>`;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render() {
    if (this.cards === null) {
      return html`<div class="kpis-busy" role="group" aria-busy="true" aria-label=${da.loading}>
        <div role="list" class="kpis ${this.boxes > 3 ? "many" : ""}" style=${styleMap({ "--kpi-columns": String(Math.min(this.boxes, 5)) })}>
          ${Array.from(
            { length: this.boxes },
            () => html`<div class="card kpi" role="listitem">
              <div class="kpi-bone short"></div>
              <div class="kpi-bone tall"></div>
              <div class="kpi-bone"></div>
            </div>`,
          )}
        </div>
      </div>`;
    }
    const groups = this.objectGroups;
    const extra = groups?.cards ?? [];
    const columns = Math.min(this.cards.length + extra.length, 5);
    return html`<div class="kpis ${extra.length === 0 ? "" : "many"}" style=${styleMap({ "--kpi-columns": String(columns) })}>
      ${this.cards.map((c) => this.plainCard(c))}
      ${groups === null
        ? nothing
        : extra.map((c) => this.objectCard(c, groups))}
    </div>`;
  }
}

export const keyNumbersStyles = css`
  .kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .kpis.many {
    grid-template-columns: repeat(var(--kpi-columns), minmax(0, 1fr));
  }
  @media (max-width: 1023px) {
    .kpis.many {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 599px) {
    .kpis,
    .kpis.many {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .kpi-toggle {
    display: block;
    width: 100%;
    padding: 16px 16px 0;
    border: 0;
    background: none;
    font: inherit;
    color: var(--hs-text);
    text-align: left;
    cursor: pointer;
  }
  .kpi-group {
    padding: 0;
  }
  .kpi-plain {
    padding: 16px 16px 0;
  }
  .kpi-group > .kpi-link {
    margin: 2px 16px 16px;
  }
  .kpi-toggle > span,
  .kpi-plain > span {
    display: block;
  }
  .kpi-group:has(.kpi-toggle:hover) {
    border-color: var(--hs-accent);
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
  .kpi-link {
    display: inline-block;
    font-size: 13px;
    margin-top: 2px;
    color: var(--hs-muted);
  }
  a.kpi-link {
    color: var(--hs-accent-text);
    text-decoration: none;
  }
  a.kpi-link:hover {
    text-decoration: underline;
  }
  a.kpi-link:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
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
