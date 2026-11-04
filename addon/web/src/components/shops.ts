import type { HiddenShopChange } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { kr, percent } from "../format";
import { da } from "../i18n/da";
import { barScale, type ShopList, type ShopRow } from "../model/shops";
import { fire } from "./chip";

/**
 * The Butikker card's list (top-shops spec §2 and §3). Fires `shop-open` (the name), `shop-hide`
 * (a `HiddenShopChange`), `shops-all-toggle` and `shops-hidden-toggle`.
 */
export class Shops extends LitElement {
  static override properties = {
    list: { attribute: false },
    chosen: { attribute: false },
    all: { attribute: false },
    showHidden: { attribute: false },
    canHide: { attribute: false },
    limit: { attribute: false },
  };

  declare list: ShopList;
  /** The chosen shop's name. */
  declare chosen: string | null;
  declare all: boolean;
  declare showHidden: boolean;
  declare canHide: boolean;
  /** null shows every row, as in full screen. */
  declare limit: number | null;

  constructor() {
    super();
    this.list = { visible: [], hidden: [], hiddenSum: 0, noShop: 0 };
    this.chosen = null;
    this.all = false;
    this.showHidden = false;
    this.canHide = false;
    this.limit = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private hide(shop: string, hidden: boolean): void {
    const change: HiddenShopChange = { shop, hidden };
    fire(this, "shop-hide", change);
  }

  private row(r: ShopRow, place: number | null, scale: number) {
    const width = scale > 0 ? `${(r.sum / scale) * 100}%` : "0";
    return html`<li class="shop-row">
      <span class="shop-place" aria-hidden="true">${place ?? ""}</span>
      <button
        type="button"
        class="shop-name"
        aria-label=${da.shopOption(r.name, kr(r.sum))}
        aria-pressed=${String(r.name === this.chosen)}
        @click=${() => fire(this, "shop-open", r.name)}
      >
        ${r.name}
      </button>
      <span class="shop-bar" aria-hidden="true"><span style=${styleMap({ width })}></span></span>
      <span class="shop-sum">${kr(r.sum)}</span>
      <span class="shop-share">${r.share === null ? "" : percent(r.share)}</span>
      ${this.canHide
        ? html`<button
            type="button"
            class="shop-hide"
            aria-label=${place === null ? da.showShop(r.name) : da.hideShop(r.name)}
            @click=${() => this.hide(r.name, place !== null)}
          >
            ${place === null ? da.show : da.hide}
          </button>`
        : nothing}
    </li>`;
  }

  override render() {
    const { visible, hidden, hiddenSum, noShop } = this.list;
    const limited = this.limit !== null && visible.length > this.limit;
    const rows = limited && !this.all ? visible.slice(0, this.limit ?? undefined) : visible;
    const offerHidden = this.canHide && hidden.length > 0;
    const shownHidden = offerHidden && this.showHidden ? hidden : [];
    const scale = barScale([...rows, ...shownHidden]);
    const lists = this.canHide ? "shops shops-hideable" : "shops";
    return html`<ol class=${lists}>
        ${rows.map((r, i) => this.row(r, i + 1, scale))}
      </ol>
      ${limited
        ? html`<button
            type="button"
            class="shops-more"
            aria-expanded=${String(this.all)}
            @click=${() => fire(this, "shops-all-toggle")}
          >
            ${this.all ? da.showFewer : da.showAllShops(visible.length)}
          </button>`
        : nothing}
      ${shownHidden.length === 0
        ? nothing
        : html`<ul class=${`${lists} shops-hidden`}>
            ${shownHidden.map((r) => this.row(r, null, scale))}
          </ul>`}
      ${offerHidden
        ? html`<button
            type="button"
            class="shops-more"
            aria-expanded=${String(this.showHidden)}
            @click=${() => fire(this, "shops-hidden-toggle")}
          >
            ${this.showHidden ? da.hideHidden : da.showHidden(hidden.length, kr(hiddenSum))}
          </button>`
        : nothing}
      ${noShop > 0 ? html`<p class="half-foot">${da.noShop(kr(noShop))}</p>` : nothing}`;
  }
}

export const shopsStyles = css`
  .shops {
    margin: 0;
    padding: 0;
    list-style: none;
    font-variant-numeric: tabular-nums;
  }
  /* Each row is its own grid, so only fixed widths after the bar make every track end at one place. */
  .shop-row {
    display: grid;
    grid-template-columns: 2.5ch minmax(6em, 16em) minmax(40px, 1fr) 11ch 5.5ch;
    align-items: center;
    gap: 4px 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--hs-line);
  }
  .shops-hideable .shop-row {
    grid-template-columns: 2.5ch minmax(6em, 16em) minmax(40px, 1fr) 11ch 5.5ch 4.5ch;
  }
  .shop-place {
    color: var(--hs-muted);
    text-align: right;
  }
  .shop-name {
    min-width: 0;
    padding: 0;
    overflow: hidden;
    font: inherit;
    color: inherit;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .shop-name:hover,
  .shop-name:focus-visible {
    color: var(--hs-accent-text);
    text-decoration: underline;
  }
  .shop-name[aria-pressed="true"] {
    color: var(--hs-accent-text);
    font-weight: 600;
  }
  .shop-bar {
    height: 10px;
    background: var(--hs-soft);
    border-radius: 5px;
    overflow: hidden;
  }
  .shop-bar > span {
    display: block;
    height: 100%;
    background: var(--hs-accent);
  }
  .shop-sum,
  .shop-share {
    text-align: right;
    white-space: nowrap;
  }
  .shop-share {
    color: var(--hs-muted);
  }
  .shop-hide,
  .shops-more {
    padding: 0;
    font: inherit;
    color: var(--hs-accent-text);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .shops-more {
    display: block;
    margin-top: 8px;
  }
  .shop-hide:focus-visible,
  .shops-more:focus-visible,
  .shop-name:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
  .shops-hidden .shop-row {
    color: var(--hs-muted);
  }
  .shops-hidden .shop-bar > span {
    background: var(--hs-field);
  }
  @media (max-width: 480px) {
    .shop-row,
    .shops-hideable .shop-row {
      grid-template-columns: 2.5ch minmax(0, 1fr) auto 5.5ch auto;
    }
    .shop-bar {
      grid-row: 2;
      grid-column: 2 / -1;
    }
  }
`;

if (!customElements.get("hs-shops")) customElements.define("hs-shops", Shops);

declare global {
  interface HTMLElementTagNameMap {
    "hs-shops": Shops;
  }
}
