import { css, html, LitElement, nothing } from "lit";
import { count } from "../format";
import { da } from "../i18n/da";
import type { KeyCard } from "../model/key-numbers";

/** The period's key numbers, then one per object group; their placeholder while `cards` is null. */
export class KeyNumbers extends LitElement {
  static override properties = {
    cards: { attribute: false },
    objectGroups: { attribute: false },
    boxes: { attribute: false },
  };

  declare cards: KeyCard[] | null;
  declare objectGroups: KeyCard[];
  /** How many boxes the placeholder draws. */
  declare boxes: number;

  constructor() {
    super();
    this.cards = null;
    this.objectGroups = [];
    this.boxes = 2;
  }

  private postingsLine(c: KeyCard) {
    const p = c.postings;
    if (p === undefined) return nothing;
    return p.count === 0
      ? html`<div class="kpi-link">${count(0)}</div>`
      : html`<a class="kpi-link" href=${p.href}>${da.postingsLink(count(p.count))}</a>`;
  }

  private plainCard(c: KeyCard) {
    return html`<div class="card kpi" role="group" aria-label=${c.label}>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      ${this.postingsLine(c)}
      <div class="kpi-sub">${c.sub}</div>
    </div>`;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render() {
    if (this.cards === null) {
      return html`<div class="kpis-busy" role="group" aria-busy="true" aria-label=${da.loading}>
        <div role="list" class="kpis">
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
    return html`<div class="kpis">${[...this.cards, ...this.objectGroups].map((c) => this.plainCard(c))}</div>`;
  }
}

export const keyNumbersStyles = css`
  .kpis {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
  }
  @media (max-width: 1023px) {
    .kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 599px) {
    .kpis {
      grid-template-columns: minmax(0, 1fr);
    }
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
