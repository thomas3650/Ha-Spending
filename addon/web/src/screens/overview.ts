import { type ClassifiedPosting, keyNumbers, total, within } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import "../components/amount-pill";
import "../components/bars";
import { detailSplit } from "../components/detail";
import { fire } from "../components/chip";
import "../components/circle";
import "../components/postings";
import "../components/search";
import "../components/shops";
import { objectGroupSums } from "../components/subscriptions";
import { count, kr, plainCount, unitName } from "../format";
import { da } from "../i18n/da";
import { barItems, categoryColours, circleItems, circleSpan, circleTotal, partColours } from "../model/circle";
import { finerUnits, levelName, type ViewContext } from "../model/context";
import { type AmountFilter, inAmount } from "../model/amount";
import { detailView } from "../model/detail";
import { matches, shopSuggestions } from "../model/filter";
import { postingList, shownColumns, shownPostingSort, watchCategoryWidth } from "../model/postings";
import { type HiddenState, shopList } from "../model/shops";
import { DEFAULT_SUBSCRIPTION_SORT, subscriptionTable } from "../model/subscriptions";
import { hasShops } from "../state/actions";
import { type Card, DEFAULT_POSTING_SORT, type Sort, type SubscriptionColumn, type Sorted } from "../state/view";

const LEFT_TITLE = "hs-left-title";
const RIGHT_TITLE = "hs-right-title";
const EXPAND = "M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7";
const COLLAPSE = "M14 4v6h6M14 10l7-7M10 20v-6H4M10 14l-7 7";
const SHOPS_LIMIT = 10;

export class Overview extends LitElement {
  static override properties = {
    ctx: { attribute: false },
    postingsSort: { attribute: false },
    subscriptionsSort: { attribute: false },
    hiddenShops: { attribute: false },
    shopsAll: { attribute: false },
    shopsHidden: { attribute: false },
    hiddenWriteFailed: { attribute: false },
  };

  declare ctx: ViewContext;
  declare postingsSort: Sort;
  declare subscriptionsSort: Sorted<SubscriptionColumn>;
  declare hiddenShops: HiddenState;
  declare shopsAll: boolean;
  declare shopsHidden: boolean;
  declare hiddenWriteFailed: boolean;

  constructor() {
    super();
    this.postingsSort = DEFAULT_POSTING_SORT;
    this.subscriptionsSort = DEFAULT_SUBSCRIPTION_SORT;
    this.hiddenShops = { kind: "loading" };
    this.shopsAll = false;
    this.shopsHidden = false;
    this.hiddenWriteFailed = false;
  }

  private stopWatchingWidth: (() => void) | null = null;

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.stopWatchingWidth = watchCategoryWidth(() => this.requestUpdate());
  }

  override disconnectedCallback(): void {
    this.stopWatchingWidth?.();
    this.stopWatchingWidth = null;
    super.disconnectedCallback();
  }

  /** Waits for the lists too, so the app can focus a row's button once they show (detail spec §1.3). */
  protected override async getUpdateComplete(): Promise<boolean> {
    const done = await super.getUpdateComplete();
    const children = [...this.querySelectorAll<LitElement>("hs-postings, hs-subscriptions, hs-detail")];
    await Promise.all(children.map((c) => c.updateComplete));
    return done;
  }

  private empty() {
    return html`<p class="empty">${da.noSpending}</p>`;
  }

  private left() {
    const ctx = this.ctx;
    const all = ctx.circleLevel.kind === "all";
    const level = ctx.state.level;
    const selected = level.kind === "category" ? { key: level.category } : null;
    const items = circleItems(ctx);
    const whole = circleTotal(ctx);
    const name = levelName(ctx.circleLevel);
    const hint = all ? null : selected ? da.chosenHint(name) : da.circleHintGroup;
    const empty = circleSpan(ctx).length === 0;
    const heading = all ? da.mainGroups : da.categories;
    const unit = ctx.chosen === null ? null : unitName(ctx.chosen, ctx.timeline.grouping);
    const centre = unit === null ? name : all ? unit : da.levelInUnit(name, unit);
    return html`<section class="card half" role="region" aria-labelledby=${LEFT_TITLE}>
      <div class="half-head">
        <h2 id=${LEFT_TITLE}>${unit === null ? heading : da.inUnit(heading, unit)}</h2>
        <span class="half-sum">${kr(whole)}</span>
      </div>
      ${empty
        ? this.empty()
        : html`<hs-circle
              .items=${items}
              .centreName=${centre}
              .centreAmount=${whole}
              .selectable=${!all}
              .selected=${selected}
            ></hs-circle>
            ${hint === null ? nothing : html`<p class="half-foot">${hint}</p>`}`}
    </section>`;
  }

  private switchButton(card: Card, label: string) {
    const pressed = this.ctx.state.card === card;
    return html`<button
      type="button"
      aria-pressed=${String(pressed)}
      @click=${() => fire(this, "card-change", card)}
    >
      ${label}
    </button>`;
  }

  private bars() {
    const ctx = this.ctx;
    // On finer bars the key numbers' average is a whole month's, far above any finer bar.
    const avg = finerUnits(ctx) === null ? keyNumbers(ctx.shown, ctx.timeline).average.amount : null;
    const average = avg === null ? null : { amount: avg, label: da.average(kr(avg)) };
    const level = ctx.state.level;
    const colour = level.kind === "category" ? (partColours(ctx).get(level.category) ?? "") : "";
    return html`<hs-bars
        .items=${barItems(ctx)}
        .colour=${colour}
        .average=${average}
        .chosen=${ctx.state.unit}
      ></hs-bars>`;
  }

  /** The search row stays one element whatever the list turns into, so the field keeps its focus while typing. */
  private postings() {
    const ctx = this.ctx;
    const search = ctx.state.search;
    const chosen = ctx.chosen;
    const shop = ctx.state.shop;
    const amount = ctx.state.amount;
    const base = within(ctx.shown, chosen ?? ctx.timeline.period);
    const postings = base.filter((p) => matches(p, search, shop) && inAmount(p, amount));
    const g = ctx.timeline.grouping;
    let body: unknown;
    if (postings.length === 0) {
      const unfiltered = search.trim() === "" && shop === null && amount === null;
      body = html`<p class="empty">${unfiltered ? da.noSpending : da.noMatch}</p>`;
    } else {
      const units = chosen === null ? ctx.units : [chosen];
      const columns = shownColumns(ctx.state.fullScreen, ctx.state.detail !== null);
      const sort = shownPostingSort(this.postingsSort, columns);
      const list = postingList(postings, units, ctx, sort, categoryColours(ctx));
      body = html`<hs-postings
          .list=${list}
          .query=${search}
          .shop=${shop}
          .grouping=${g}
          .sort=${sort}
          .showCategory=${columns.category}
          .showAccount=${columns.account}
          .marked=${ctx.state.detail}
        ></hs-postings>`;
    }
    const above = html`<div class="postings-search-row">
        <hs-search .search=${search} .shop=${shop} .suggestions=${shopSuggestions(base, search)}></hs-search>
        <hs-amount-pill .amount=${amount}></hs-amount-pill>
      </div>
      ${this.sentence(base.length, postings, search, shop, amount)}`;
    return { above, list: body };
  }

  /** Without a quick filter the count and sum; with one, what is shown of what there is, and Ryd (spec §4.3). */
  private sentence(
    all: number,
    postings: ClassifiedPosting[],
    search: string,
    shop: string | null,
    amount: AmountFilter | null,
  ) {
    const text = search.trim();
    const parts = [
      ...(shop === null ? [] : [shop]),
      ...(text === "" ? [] : [da.searchPart(text)]),
      ...(amount === null ? [] : [da.amountWords(amount)]),
    ];
    if (parts.length === 0) {
      return html`<p class="postings-summary">${da.summary(count(postings.length), kr(total(postings)))}</p>`;
    }
    const sum = postings.length === 0 ? "" : kr(total(postings));
    const shown = plainCount(postings.length);
    return html`<p class="postings-summary">
      ${da.showing(shown, count(all), sum, parts.join(" · "))}
      <button type="button" class="postings-clear" @click=${() => fire(this, "quick-clear")}>${da.clearQuick}</button>
    </p>`;
  }

  /** A chosen category is named by the trail; the title names its main group, so it does not change. */
  private cardTitle(card: Card): string {
    const level = this.ctx.state.level;
    const g = finerUnits(this.ctx)?.grouping ?? this.ctx.timeline.grouping;
    if (level.kind === "all") {
      if (card === "subscriptions") return da.subscriptions;
      if (card === "postings") return da.postingsTitle;
      if (card === "shops") return da.shops;
      return da.per(g);
    }
    const name = levelName({ kind: "mainGroup", mainGroup: level.mainGroup });
    if (card === "subscriptions") return da.subscriptionsIn(name);
    if (card === "postings") return da.postingsOf(name);
    if (card === "shops") return da.shopsIn(name);
    return da.levelPer(name, g);
  }

  private subscriptions(title: string) {
    const table = subscriptionTable(this.ctx, this.subscriptionsSort);
    if (table.rows.length === 0) {
      return { above: nothing, list: html`<p class="empty">${da.noSubscriptions(levelName(this.ctx.state.level))}</p>` };
    }
    return {
      above: objectGroupSums(table, da.objectGroupSums(title)),
      list: html`<hs-subscriptions .table=${table} .label=${title} .marked=${this.ctx.state.detail}></hs-subscriptions>
        <p class="half-foot">${da.subscriptionsFoot}</p>`,
    };
  }

  /** Like Posteringer, the list follows a chosen unit but not the search or the chosen shop (top-shops spec §1). */
  private shops() {
    const ctx = this.ctx;
    const base = within(ctx.shown, ctx.chosen ?? ctx.timeline.period);
    if (base.length === 0) return this.empty();
    const state = this.hiddenShops;
    if (state.kind === "loading") return html`<p class="empty">${da.fetching}</p>`;
    const list = shopList(base, new Set(state.kind === "ready" ? state.shops : []));
    if (list.visible.length === 0 && list.hidden.length === 0) return html`<p class="empty">${da.noShops}</p>`;
    return html`${state.kind === "error" ? html`<p class="line status" role="status">${da.hiddenUnreadable}</p>` : nothing}
      <hs-shops
      .list=${list}
      .chosen=${ctx.state.shop}
      .all=${this.shopsAll}
      .showHidden=${this.shopsHidden}
      .canHide=${state.kind === "ready"}
      .limit=${this.ctx.state.fullScreen ? null : SHOPS_LIMIT}
    ></hs-shops>`;
  }

  private right() {
    const ctx = this.ctx;
    const card = ctx.state.card;
    const inPeriod = within(ctx.shown, ctx.timeline.period);
    const title = this.cardTitle(card);
    const shops = hasShops(ctx.data);
    const listed = card === "subscriptions" || card === "postings";
    const view = listed && ctx.state.detail !== null ? detailView(ctx.state.detail, ctx) : null;
    // Full screen has the room to put the detail beside the list (detail spec §1.2).
    const inPlace = view !== null && !this.ctx.state.fullScreen;
    let body: unknown;
    let fill = false;
    if (listed) {
      const { above, list } = card === "subscriptions" ? this.subscriptions(title) : this.postings();
      body = detailSplit(above, list, view, !this.ctx.state.fullScreen);
    } else if (card === "shops") body = this.shops();
    else if (inPeriod.length === 0) body = this.empty();
    else {
      body = this.bars();
      fill = ctx.state.fullScreen;
    }
    return html`<section class="card half right ${fill ? "fill" : ""}" role="region" aria-labelledby=${RIGHT_TITLE}>
      <div class="half-head with-tools">
        <div class="half-title ${inPlace ? "in-detail" : ""}">
          ${inPlace
            ? html`<button
                type="button"
                class="back"
                aria-label=${da.backTo(title)}
                @click=${() => fire(this, "detail-close")}
              >
                <span aria-hidden="true">←</span>
              </button>`
            : nothing}
          <h2 id=${RIGHT_TITLE} tabindex="-1" title=${title}>${title}</h2>
        </div>
        <div class="card-tools">
          <div class="card-switch" role="group" aria-label=${da.view}>
            ${this.switchButton("bars", da.bars)} ${this.switchButton("postings", da.postings)}
            ${ctx.data.subscriptions.length === 0 ? nothing : this.switchButton("subscriptions", da.subscriptions)}
            ${shops ? this.switchButton("shops", da.shops) : nothing}
          </div>
          <button
            type="button"
            class="full-screen"
            aria-label=${da.fullScreen}
            aria-pressed=${String(this.ctx.state.fullScreen)}
            @click=${() => fire(this, "full-screen-toggle")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d=${this.ctx.state.fullScreen ? COLLAPSE : EXPAND} />
            </svg>
          </button>
        </div>
      </div>
      ${card === "shops" && this.hiddenWriteFailed
        ? html`<p class="line alert" role="alert">${da.saveFailed}</p>`
        : nothing}
      ${body}
    </section>`;
  }

  override render() {
    const single = this.ctx.state.fullScreen;
    return html`<div class="halves ${single ? "single" : ""}">${single ? nothing : this.left()} ${this.right()}</div>`;
  }
}

export const overviewStyles = css`
  .half-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .half-head > :first-child {
    flex: 1 1 auto;
    min-width: 0;
  }
  .half.right {
    container-type: inline-size;
  }
  /* The tools are grid items of the head, so the button stays on the title's row when the switch drops below. */
  .half-head.with-tools {
    display: grid;
    grid-template-columns: minmax(10em, 1fr) auto auto;
    grid-template-areas: "title switch button";
    align-items: start;
    column-gap: 8px;
  }
  .half-head.with-tools > .half-title {
    grid-area: title;
  }
  .half-head.with-tools .card-switch {
    grid-area: switch;
  }
  .half-head.with-tools .full-screen {
    grid-area: button;
  }
  @container (max-width: 700px) {
    .half-head.with-tools {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: "title button" "switch switch";
      row-gap: 8px;
    }
    .half-head.with-tools .card-switch {
      justify-self: end;
    }
  }
  .half-head h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  .half-title.in-detail {
    gap: 4px;
    color: var(--hs-accent-text);
  }
  .half-title .back {
    padding: 0 4px;
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    color: inherit;
    background: none;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .half-title .back:focus-visible {
    outline: 2px solid var(--hs-accent-text);
  }
  .half-head h2:focus {
    outline: none;
  }
  .half-title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .half-title h2 {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .half-sum {
    flex: none;
    color: var(--hs-muted);
    font-variant-numeric: tabular-nums;
  }
  .card-tools {
    display: contents;
  }
  .card-tools .full-screen {
    box-sizing: border-box;
    height: calc(1lh + 12px + 2px);
    font: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    color: var(--hs-text);
    background: var(--hs-card);
    border: 1px solid var(--hs-field);
    border-radius: 6px;
    cursor: pointer;
  }
  .card-tools .full-screen svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .card-tools .full-screen:hover {
    border-color: var(--hs-accent-text);
  }
  .card-tools .full-screen:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: -2px;
  }
  .card-switch {
    display: inline-flex;
    flex-wrap: wrap;
    max-width: 100%;
  }
  /* The buttons draw the border, so each one's left edge is the previous one's right edge. */
  .card-switch button {
    font: inherit;
    padding: 6px 14px;
    color: var(--hs-text);
    background: var(--hs-card);
    border: 1px solid var(--hs-field);
    border-left-width: 0;
    cursor: pointer;
  }
  .card-switch button:first-child {
    border-left-width: 1px;
    border-radius: 6px 0 0 6px;
  }
  .card-switch button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .card-switch button[aria-pressed="true"] {
    color: #fff;
    font-weight: 600;
    background: var(--hs-accent);
  }
  .card-switch button {
    white-space: nowrap;
  }
  .card-switch button:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: -2px;
  }
  @media (max-width: 480px) {
    .card-switch button {
      padding: 6px 8px;
      font-size: 14px;
    }
  }
  .half-foot {
    margin: 12px 0 0;
    color: var(--hs-muted);
    font-size: 12px;
  }
  /* A chosen shop's chip wraps below the field, so the row aligns to the top and the pill keeps its height. */
  .postings-search-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .postings-clear {
    margin-left: 8px;
    padding: 0;
    font: inherit;
    color: var(--hs-accent-text);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .postings-summary {
    margin: 12px 0;
    text-align: right;
    color: var(--hs-muted);
    font-variant-numeric: tabular-nums;
  }
`;

if (!customElements.get("hs-overview")) customElements.define("hs-overview", Overview);

declare global {
  interface HTMLElementTagNameMap {
    "hs-overview": Overview;
  }
}
