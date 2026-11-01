import { css, html, LitElement, nothing } from "lit";
import { live } from "lit/directives/live.js";
import { kr, postingAmount } from "../format";
import { da } from "../i18n/da";
import type { ShopSuggestion } from "../model/filter";
import { chip, fire } from "./chip";

let instances = 0;

/** A net of zero or less reads as a refund row does. */
function sumText(sum: number): string {
  return sum > 0 ? kr(sum) : postingAmount(sum);
}

/**
 * The search field with the chosen shop's chip and the shops as suggestions (shop search spec §3). Fires
 * `search-input` (the text), `shop-choose` (the name) and `shop-remove` (`"click"` or `"key"`).
 */
export class Search extends LitElement {
  static override properties = {
    search: { attribute: false },
    shop: { attribute: false },
    suggestions: { attribute: false },
    focused: { state: true },
    closed: { state: true },
    active: { state: true },
  };

  declare search: string;
  declare shop: string | null;
  declare suggestions: ShopSuggestion[];
  declare private focused: boolean;
  declare private closed: boolean;
  /** The highlighted option, or -1. */
  declare private active: number;

  private readonly idBase = `hs-search-${++instances}`;

  constructor() {
    super();
    this.search = "";
    this.shop = null;
    this.suggestions = [];
    this.focused = false;
    this.closed = false;
    this.active = -1;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private get open(): boolean {
    return this.focused && this.shop === null && !this.closed && this.suggestions.length > 0;
  }

  private get field(): HTMLInputElement | null {
    return this.querySelector("input");
  }

  private close(): void {
    this.closed = true;
    this.active = -1;
  }

  private choose(name: string): void {
    this.active = -1;
    fire(this, "shop-choose", name);
    this.field?.focus();
  }

  private removeShop(how: "click" | "key"): void {
    fire(this, "shop-remove", how);
    this.field?.focus();
  }

  private onInput(e: Event): void {
    this.closed = false;
    this.active = -1;
    fire(this, "search-input", (e.target as HTMLInputElement).value);
  }

  private onFocusOut(): void {
    this.focused = false;
    this.active = -1;
  }

  private onKeyDown(e: KeyboardEvent): void {
    const n = this.suggestions.length;
    const open = this.open;
    switch (e.key) {
      case "ArrowDown":
        if (!open) return;
        e.preventDefault();
        this.active = this.active < n - 1 ? this.active + 1 : 0;
        return;
      case "ArrowUp":
        if (!open) return;
        e.preventDefault();
        this.active = this.active > 0 ? this.active - 1 : n - 1;
        return;
      case "Enter": {
        const chosen = open ? this.suggestions[this.active] : undefined;
        if (chosen !== undefined) {
          e.preventDefault();
          this.choose(chosen.name);
        }
        else this.close();
        return;
      }
      case "Escape":
        if (!open) return;
        // A search field clears its text on Escape; the spec keeps the text.
        e.preventDefault();
        this.close();
        return;
      case "Backspace":
        if (this.shop !== null && (e.target as HTMLInputElement).value === "") this.removeShop("key");
        return;
    }
  }

  private options() {
    return this.suggestions.map((s, i) => {
      const text = sumText(s.sum);
      return html`<li
        role="option"
        id="${this.idBase}-${i}"
        class="search-option"
        aria-selected=${String(i === this.active)}
        aria-label=${da.shopOption(s.name, text)}
        @click=${() => this.choose(s.name)}
      >
        <span class="search-option-name">${s.name}</span>
        <span class="search-option-sum">${text}</span>
      </li>`;
    });
  }

  override render() {
    const open = this.open;
    const list = `${this.idBase}-list`;
    const active = open && this.active >= 0 && this.active < this.suggestions.length ? this.active : -1;
    return html`${this.shop === null
        ? nothing
        : chip(da.shopChip(this.shop), () => this.removeShop("click"))}
      <input
        class="all-search"
        type="search"
        role="combobox"
        aria-label=${da.searchLabel}
        placeholder=${da.search}
        aria-autocomplete="list"
        aria-expanded=${String(open)}
        aria-controls=${list}
        aria-activedescendant=${active < 0 ? nothing : `${this.idBase}-${active}`}
        .value=${live(this.search)}
        @input=${this.onInput}
        @focus=${() => (this.focused = true)}
        @focusout=${this.onFocusOut}
        @keydown=${this.onKeyDown}
      />
      <ul
        role="listbox"
        id=${list}
        class="search-list"
        aria-label=${da.suggestions}
        ?hidden=${!open}
        @mousedown=${(e: Event) => e.preventDefault()}
      >
        ${open ? this.options() : nothing}
      </ul>`;
  }
}

export const searchStyles = css`
  hs-search {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .search-list {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 5;
    margin: 0;
    padding: 6px 0;
    list-style: none;
    background: var(--hs-card);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  }
  .search-list[hidden] {
    display: none;
  }
  .search-option {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 16px;
    cursor: pointer;
  }
  .search-option:hover,
  .search-option[aria-selected="true"] {
    background: var(--hs-soft);
  }
  .search-option-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .search-option-sum {
    flex: none;
    color: var(--hs-muted);
    font-variant-numeric: tabular-nums;
  }
`;

if (!customElements.get("hs-search")) customElements.define("hs-search", Search);

declare global {
  interface HTMLElementTagNameMap {
    "hs-search": Search;
  }
}
