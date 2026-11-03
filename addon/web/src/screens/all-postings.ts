import { compareKeys, total } from "@ha-spending/shared";
import { css, html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { live } from "lit/directives/live.js";
import { chip, fire } from "../components/chip";
import { detailSplit } from "../components/detail";
import { Dropdown } from "../components/dropdown";
import "../components/postings";
import "../components/search";
import { amountChip, count, kr, parseDanishAmount, unitName } from "../format";
import { da } from "../i18n/da";
import { categoryColours } from "../model/circle";
import { partName, type ViewContext } from "../model/context";
import { detailView } from "../model/detail";
import { filteredPostings, fold, objectGroupBase, searchBase, shopSuggestions } from "../model/filter";
import { postingList } from "../model/postings";
import {
  type AmountRange,
  nextSort,
  type PostingColumn,
  postingFirstDescending,
  toHash,
} from "../state/view";

export interface CategoryChoice {
  mainGroup: string | null;
  category: string | null;
}

/**
 * "+ Filter": a main group, a category, an amount range or an object group. Fires `set-main-group`, `set-category`,
 * `set-amount` and `set-object-group`.
 */
export class FilterPicker extends Dropdown {
  static override properties: PropertyDeclarations = {
    ctx: { attribute: false },
    min: { state: true },
    max: { state: true },
    checked: { state: true },
    search: { state: true },
  };

  declare ctx: ViewContext;
  declare private search: string;
  declare private min: string;
  declare private max: string;
  /**
   * A field is judged when "Tilføj" is pressed or it loses the focus, not while the user is typing; once it reads
   * again it waits for the next of those.
   */
  declare private checked: { min: boolean; max: boolean };

  constructor() {
    super();
    this.min = "";
    this.max = "";
    this.checked = { min: false, max: false };
    this.search = "";
  }

  /** A new view, from the trail or the browser's back, leaves the panel's choices behind. */
  protected override willUpdate(changed: PropertyValues<this>): void {
    const before = changed.get("ctx") as ViewContext | undefined;
    if (before !== undefined && toHash(before.state) !== toHash(this.ctx.state)) this.open = false;
    if (changed.has("open") && !this.open) this.search = "";
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has("open") && this.open) this.querySelector<HTMLInputElement>(".filter-search")?.focus();
  }

  private choose(name: string, detail: unknown): void {
    fire(this, name, detail);
    void this.close(true);
  }

  private invalid(field: "min" | "max"): boolean {
    const text = this[field];
    return this.checked[field] && text.trim() !== "" && parseDanishAmount(text) === null;
  }

  private addAmount(): void {
    this.checked = { min: true, max: true };
    if (this.invalid("min") || this.invalid("max")) return;
    const a = this.min.trim() === "" ? null : parseDanishAmount(this.min);
    const b = this.max.trim() === "" ? null : parseDanishAmount(this.max);
    const range: AmountRange = a !== null && b !== null && a > b ? { min: b, max: a } : { min: a, max: b };
    this.min = "";
    this.max = "";
    this.checked = { min: false, max: false };
    this.choose("set-amount", range);
  }

  private typed(field: "min" | "max", text: string): void {
    this[field] = text;
    this.checked = { ...this.checked, [field]: false };
  }

  private amountField(field: "min" | "max", label: string) {
    const invalid = this.invalid(field);
    const message = `hs-amount-${field}-invalid`;
    return html`<label
        >${label}
        <input
          type="text"
          inputmode="decimal"
          aria-invalid=${invalid ? "true" : nothing}
          aria-describedby=${invalid ? message : nothing}
          .value=${live(this[field])}
          @input=${(e: Event) => this.typed(field, (e.target as HTMLInputElement).value)}
          @blur=${() => (this.checked = { ...this.checked, [field]: true })}
        />
      </label>
      ${invalid ? html`<p id=${message} class="amount-invalid">${da.amountInvalid}</p>` : nothing}`;
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

  private fits(name: string): boolean {
    const needle = fold(this.search);
    return needle === "" || fold(name).includes(needle);
  }

  /** The chosen group is listed even when no posting carries it, so it can be seen pressed. */
  private objectGroups() {
    const chosen = this.ctx.state.objectGroup;
    const titles = new Set(objectGroupBase(this.ctx).flatMap((p) => (p.subscription ? [p.subscription.objectGroup] : [])));
    if (chosen !== null) titles.add(chosen);
    const shown = [...titles].filter((title) => this.fits(title));
    if (shown.length === 0) return nothing;
    return html`<div role="group" aria-labelledby="hs-filter-object-groups">
      <h3 id="hs-filter-object-groups">${da.subscriptions}</h3>
      ${shown
        .sort((a, b) => a.localeCompare(b, "da"))
        .map((title) => this.option(title, title === chosen, "set-object-group", title))}
    </div>`;
  }

  private panel() {
    const data = this.ctx.data;
    const level = this.ctx.state.level;
    const mainGroup = level.kind === "all" ? undefined : level.mainGroup;
    const category = level.kind === "category" ? level.category : undefined;
    const categories = [...data.categories].sort((a, b) => compareKeys(a.name, b.name));
    const groups = [...data.mainGroups, null].filter((key) => this.fits(partName(key, "mainGroup")));
    const shownCategories = categories.filter((c) => this.fits(c.name));
    const withoutCategory = this.fits(da.noCategory);
    const objectGroups = this.objectGroups();
    const none =
      groups.length === 0 && shownCategories.length === 0 && !withoutCategory && objectGroups === nothing;
    return html`<div class="dd-menu filter-menu" tabindex="-1">
      <input
        type="text"
        class="filter-search"
        aria-label=${da.filterSearch}
        .value=${live(this.search)}
        @input=${(e: Event) => (this.search = (e.target as HTMLInputElement).value)}
      />
      <div role="group" aria-labelledby="hs-filter-amount" class="amount-part">
        <h3 id="hs-filter-amount">${da.amountFilter}</h3>
        ${this.amountField("min", da.from)} ${this.amountField("max", da.to)}
        <button type="button" class="filter-add" @click=${() => this.addAmount()}>${da.add}</button>
      </div>
      ${objectGroups}
      ${groups.length === 0
        ? nothing
        : html`<div role="group" aria-labelledby="hs-filter-main-groups">
            <h3 id="hs-filter-main-groups">${da.mainGroups}</h3>
            ${groups.map((key) =>
              this.option(partName(key, "mainGroup"), key === mainGroup && category === undefined, "set-main-group", key),
            )}
          </div>`}
      ${shownCategories.length === 0 && !withoutCategory
        ? nothing
        : html`<div role="group" aria-labelledby="hs-filter-categories">
            <h3 id="hs-filter-categories">${da.categories}</h3>
            ${shownCategories.map((c) =>
              this.option(c.name, c.name === category && c.mainGroup === mainGroup, "set-category", {
                mainGroup: c.mainGroup,
                category: c.name,
              } satisfies CategoryChoice),
            )}
            ${withoutCategory
              ? this.option(da.noCategory, category === null && mainGroup === null, "set-category", {
                  mainGroup: null,
                  category: null,
                } satisfies CategoryChoice)
              : nothing}
          </div>`}
      ${none ? html`<p class="filter-none">${da.noFilterHits}</p>` : nothing}
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
 * Alle posteringer (UI spec §4.3). Fires `sort-change`, `remove-main-group`, `remove-category`, `remove-unit`,
 * `set-amount` and `set-object-group`; the search and the filter picker fire the rest.
 */
export class AllPostings extends LitElement {
  static override properties = {
    ctx: { attribute: false },
  };

  declare ctx: ViewContext;

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Waits for the list and the detail too, so the app can focus a row's button or the heading (detail spec §1.3). */
  protected override async getUpdateComplete(): Promise<boolean> {
    const done = await super.getUpdateComplete();
    const children = [...this.querySelectorAll<LitElement>("hs-postings, hs-detail")];
    await Promise.all(children.map((c) => c.updateComplete));
    return done;
  }

  private chip(text: string, name: string, detail?: unknown) {
    return chip(text, () => fire(this, name, detail));
  }

  private chips() {
    const { state, chosen, timeline } = this.ctx;
    const level = state.level;
    const amount = state.amount;
    const group = state.objectGroup;
    return html`${level.kind === "all"
      ? nothing
      : this.chip(da.mainGroupChip(partName(level.mainGroup, "mainGroup")), "remove-main-group")}
    ${level.kind === "category"
      ? this.chip(da.categoryChip(partName(level.category, "category")), "remove-category")
      : nothing}
    ${chosen === null ? nothing : this.chip(unitName(chosen, timeline.grouping), "remove-unit")}
    ${amount === null ? nothing : this.chip(amountChip(amount), "set-amount", null)}
    ${group === null ? nothing : this.chip(group, "set-object-group", null)}`;
  }

  private table(postings: ReturnType<typeof filteredPostings>) {
    const ctx = this.ctx;
    const sort = ctx.state.sort;
    if (postings.length === 0) return html`<p class="empty">${da.noMatch}</p>`;
    const list = postingList(postings, ctx.units, ctx, sort, categoryColours(ctx));
    return html`<hs-postings
      .list=${list}
      .query=${ctx.state.search}
      .shop=${ctx.state.shop}
      .showCategory=${true}
      .grouping=${ctx.timeline.grouping}
      .sort=${sort}
      .marked=${ctx.state.detail}
      @posting-sort=${(e: CustomEvent<PostingColumn>) => {
        e.stopPropagation();
        fire(this, "sort-change", nextSort(sort, e.detail, postingFirstDescending));
      }}
    ></hs-postings>`;
  }

  override render() {
    const ctx = this.ctx;
    const state = ctx.state;
    const postings = filteredPostings(ctx);
    const view = state.detail === null ? null : detailView(state.detail, ctx);
    const above = html`<div class="all-search-row">
        <hs-search
          .search=${state.search}
          .shop=${state.shop}
          .suggestions=${shopSuggestions(searchBase(ctx), state.search)}
        ></hs-search>
      </div>
      <div class="all-chips-row">
        <div class="all-chips">
          ${this.chips()}
          <hs-filter-picker .ctx=${ctx}></hs-filter-picker>
        </div>
        <span class="all-summary">${da.summary(count(postings.length), kr(total(postings)))}</span>
      </div>`;
    return html`<section class="card all-postings">${detailSplit(above, this.table(postings), view, false)}</section>`;
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
  .filter-search {
    margin: 2px 12px 8px;
    padding: 6px 8px;
    font: inherit;
    border: 1px solid var(--hs-field);
    border-radius: 6px;
  }
  .filter-none {
    margin: 8px 16px;
    color: var(--hs-muted);
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
  .amount-part .amount-invalid {
    margin: 0;
    color: var(--hs-up);
    font-size: 12px;
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
