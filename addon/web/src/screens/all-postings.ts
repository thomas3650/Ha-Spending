import { compareKeys, total } from "@ha-spending/shared";
import { css, html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { live } from "lit/directives/live.js";
import { chip, fire } from "../components/chip";
import { Dropdown } from "../components/dropdown";
import "../components/postings";
import { amountChip, count, kr, unitName } from "../format";
import { da } from "../i18n/da";
import { categoryColours } from "../model/circle";
import { partName, type ViewContext } from "../model/context";
import { filteredPostings, sortPostings } from "../model/filter";
import { flatPostings, groupedPostings } from "../model/postings";
import { type AmountRange, parseKroner, type Sort, toHash } from "../state/view";

export interface CategoryChoice {
  mainGroup: string | null;
  category: string | null;
}

/** "+ Filter": a main group, a category or an amount range. Fires `set-main-group`, `set-category` and `set-amount`. */
export class FilterPicker extends Dropdown {
  static override properties: PropertyDeclarations = {
    ctx: { attribute: false },
    min: { state: true },
    max: { state: true },
  };

  declare ctx: ViewContext;
  declare private min: string;
  declare private max: string;

  constructor() {
    super();
    this.min = "";
    this.max = "";
  }

  /** A new view, from the trail or the browser's back, leaves the panel's choices behind. */
  protected override willUpdate(changed: PropertyValues<this>): void {
    const before = changed.get("ctx") as ViewContext | undefined;
    if (before !== undefined && toHash(before.state) !== toHash(this.ctx.state)) this.open = false;
  }

  private choose(name: string, detail: unknown): void {
    fire(this, name, detail);
    void this.close(true);
  }

  private addAmount(): void {
    const a = parseKroner(this.min.trim());
    const b = parseKroner(this.max.trim());
    const range: AmountRange = a !== null && b !== null && a > b ? { min: b, max: a } : { min: a, max: b };
    this.min = "";
    this.max = "";
    this.choose("set-amount", range);
  }

  private option(label: string, pressed: boolean, name: string, detail: unknown) {
    return html`<button
      type="button"
      class="dd-option"
      aria-pressed=${String(pressed)}
      @click=${() => this.choose(name, detail)}
    >
      ${label}
    </button>`;
  }

  private panel() {
    const data = this.ctx.data;
    const level = this.ctx.state.level;
    const mainGroup = level.kind === "all" ? undefined : level.mainGroup;
    const category = level.kind === "category" ? level.category : undefined;
    const categories = [...data.categories].sort((a, b) => compareKeys(a.name, b.name));
    return html`<div class="dd-menu filter-menu" tabindex="-1">
      <div role="group" aria-labelledby="hs-filter-main-groups">
        <h3 id="hs-filter-main-groups">${da.mainGroups}</h3>
        ${[...data.mainGroups, null].map((key) =>
          this.option(partName(key, "mainGroup"), key === mainGroup && category === undefined, "set-main-group", key),
        )}
      </div>
      <div role="group" aria-labelledby="hs-filter-categories">
        <h3 id="hs-filter-categories">${da.categories}</h3>
        ${categories.map((c) =>
          this.option(c.name, c.name === category && c.mainGroup === mainGroup, "set-category", {
            mainGroup: c.mainGroup,
            category: c.name,
          } satisfies CategoryChoice),
        )}
        ${this.option(da.noCategory, category === null && mainGroup === null, "set-category", {
          mainGroup: null,
          category: null,
        } satisfies CategoryChoice)}
      </div>
      <div role="group" aria-labelledby="hs-filter-amount" class="amount-part">
        <h3 id="hs-filter-amount">${da.amountFilter}</h3>
        <label
          >${da.from}
          <input
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            .value=${live(this.min)}
            @input=${(e: Event) => (this.min = (e.target as HTMLInputElement).value)}
          />
        </label>
        <label
          >${da.to}
          <input
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            .value=${live(this.max)}
            @input=${(e: Event) => (this.max = (e.target as HTMLInputElement).value)}
          />
        </label>
        <button type="button" class="filter-add" @click=${() => this.addAmount()}>${da.add}</button>
      </div>
    </div>`;
  }

  override render() {
    return html`<div class="dd">
      <button type="button" class="add-filter" aria-expanded=${String(this.open)} @click=${() => this.toggle()}>
        ${da.addFilter}
      </button>
      ${this.open ? this.panel() : nothing}
    </div>`;
  }
}

/**
 * Alle posteringer (UI spec §4.3). Fires `search-input`, `sort-change`, `remove-main-group`, `remove-category`,
 * `remove-unit` and `set-amount`; the filter picker fires the rest.
 */
export class AllPostings extends LitElement {
  static override properties = {
    ctx: { attribute: false },
  };

  declare ctx: ViewContext;

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private chip(text: string, name: string, detail?: unknown) {
    return chip(text, () => fire(this, name, detail));
  }

  private chips() {
    const { state, chosen, timeline } = this.ctx;
    const level = state.level;
    const amount = state.amount;
    return html`${level.kind === "all"
      ? nothing
      : this.chip(da.mainGroupChip(partName(level.mainGroup, "mainGroup")), "remove-main-group")}
    ${level.kind === "category"
      ? this.chip(da.categoryChip(partName(level.category, "category")), "remove-category")
      : nothing}
    ${chosen === null ? nothing : this.chip(unitName(chosen, timeline.grouping), "remove-unit")}
    ${amount === null ? nothing : this.chip(amountChip(amount), "set-amount", null)}`;
  }

  private table(postings: ReturnType<typeof filteredPostings>) {
    const ctx = this.ctx;
    const sort = ctx.state.sort;
    if (postings.length === 0) return html`<p class="empty">${da.noMatch}</p>`;
    const colours = categoryColours(ctx);
    const list =
      sort === "largest" || sort === "smallest"
        ? flatPostings(sortPostings(postings, sort), ctx, colours)
        : groupedPostings(postings, ctx.units, ctx, sort === "newest", colours);
    return html`<hs-postings .list=${list} .showCategory=${true} .grouping=${ctx.timeline.grouping}></hs-postings>`;
  }

  override render() {
    const ctx = this.ctx;
    const state = ctx.state;
    const postings = filteredPostings(ctx);
    return html`<section class="card all-postings">
      <div class="all-search-row">
        <input
          class="all-search"
          type="search"
          aria-label=${da.searchLabel}
          placeholder=${da.search}
          .value=${live(state.search)}
          @input=${(e: Event) => fire(this, "search-input", (e.target as HTMLInputElement).value)}
        />
        <label class="field">
          <small>${da.sort}</small>
          <!-- The options are static so that the value binding finds them when it is first set. -->
          <select
            .value=${live(state.sort)}
            @change=${(e: Event) => fire(this, "sort-change", (e.target as HTMLSelectElement).value as Sort)}
          >
            <option value="newest">${da.sorts.newest}</option>
            <option value="oldest">${da.sorts.oldest}</option>
            <option value="largest">${da.sorts.largest}</option>
            <option value="smallest">${da.sorts.smallest}</option>
          </select>
        </label>
      </div>
      <div class="all-chips-row">
        <div class="all-chips">
          ${this.chips()}
          <hs-filter-picker .ctx=${ctx}></hs-filter-picker>
        </div>
        <span class="all-summary">${da.summary(count(postings.length), kr(total(postings)))}</span>
      </div>
      ${this.table(postings)}
    </section>`;
  }
}

export const allPostingsStyles = css`
  .all-search-row {
    display: flex;
    gap: 12px;
    align-items: stretch;
  }
  .all-search {
    flex: 1;
    min-width: 0;
    padding: 10px 12px 10px 36px;
    font: inherit;
    color: var(--hs-text);
    border: 1px solid var(--hs-field);
    border-radius: 8px;
    background: var(--hs-card)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='6.5' cy='6.5' r='5' fill='none' stroke='%236b6b6b' stroke-width='1.6'/%3E%3Cpath d='M10.3 10.3 15 15' stroke='%236b6b6b' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E")
      12px center no-repeat;
  }
  .all-search:focus-visible {
    outline: none;
    border: 2px solid var(--hs-accent);
    padding: 9px 11px 9px 35px;
  }
  .all-chips-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 12px 0;
  }
  .all-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .add-filter {
    font: inherit;
    padding: 3px 12px;
    color: var(--hs-muted);
    background: none;
    border: 1px dashed var(--hs-field);
    border-radius: 14px;
    cursor: pointer;
  }
  .add-filter:hover,
  .add-filter[aria-expanded="true"],
  .add-filter:focus-visible {
    color: var(--hs-accent-text);
    border-color: var(--hs-accent-text);
    outline: none;
  }
  .filter-menu {
    min-width: 240px;
    max-height: 420px;
    overflow-y: auto;
  }
  .filter-menu [role="group"] {
    display: flex;
    flex-direction: column;
  }
  .filter-menu [role="group"] + [role="group"] {
    border-top: 1px solid var(--hs-line);
    margin-top: 6px;
    padding-top: 6px;
  }
  .filter-menu h3 {
    margin: 4px 16px;
    color: var(--hs-muted);
    font-size: 11px;
    font-weight: normal;
  }
  .amount-part {
    padding: 0 16px 8px;
    gap: 6px;
  }
  .amount-part h3 {
    margin: 4px 0;
  }
  .amount-part label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .amount-part input {
    width: 110px;
    padding: 6px 8px;
    font: inherit;
    border: 1px solid var(--hs-field);
    border-radius: 6px;
  }
  .amount-part .filter-add {
    align-self: flex-end;
    padding: 6px 14px;
    font: inherit;
    font-weight: 600;
    color: #fff;
    background: var(--hs-accent);
    border: 0;
    border-radius: 6px;
    cursor: pointer;
  }
  .all-summary {
    color: var(--hs-muted);
    font-variant-numeric: tabular-nums;
  }
`;

if (!customElements.get("hs-filter-picker")) customElements.define("hs-filter-picker", FilterPicker);
if (!customElements.get("hs-all-postings")) customElements.define("hs-all-postings", AllPostings);

declare global {
  interface HTMLElementTagNameMap {
    "hs-filter-picker": FilterPicker;
    "hs-all-postings": AllPostings;
  }
}
