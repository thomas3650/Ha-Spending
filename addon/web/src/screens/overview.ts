import { chosenUnitNumbers, differences, keyNumbers, total, type Unit, within } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import "../components/bars";
import { detailSplit } from "../components/detail";
import { chip, fire } from "../components/chip";
import "../components/circle";
import "../components/difference";
import type { DifferenceItem } from "../components/difference";
import "../components/postings";
import "../components/search";
import "../components/shops";
import { objectGroupSums } from "../components/subscriptions";
import { count, kr, unitName } from "../format";
import { da } from "../i18n/da";
import { barItems, categoryColours, circleItems, circleSpan, circleTotal, partColours } from "../model/circle";
import { dayUnits, levelName, partName, type ViewContext } from "../model/context";
import { detailView } from "../model/detail";
import { matches, shopSuggestions } from "../model/filter";
import { postingList } from "../model/postings";
import { type HiddenState, shopList } from "../model/shops";
import { DEFAULT_SUBSCRIPTION_SORT, subscriptionTable } from "../model/subscriptions";
import { hasShops } from "../state/actions";
import { type Card, DEFAULT_STATE, type Sort, type SubscriptionColumn, type Sorted } from "../state/view";

const LEFT_TITLE = "hs-left-title";
const RIGHT_TITLE = "hs-right-title";
const EXPAND = "M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7";
const COLLAPSE = "M14 4v6h6M14 10l7-7M10 20v-6H4M10 14l-7 7";
const SHOPS_LIMIT = 10;

export class Overview extends LitElement {
  static override properties = {
    ctx: { attribute: false },
    fullScreen: { attribute: false },
    postingsSort: { attribute: false },
    subscriptionsSort: { attribute: false },
    hiddenShops: { attribute: false },
    shopsAll: { attribute: false },
    shopsHidden: { attribute: false },
    hiddenWriteFailed: { attribute: false },
  };

  declare ctx: ViewContext;
  declare fullScreen: boolean;
  declare postingsSort: Sort;
  declare subscriptionsSort: Sorted<SubscriptionColumn>;
  declare hiddenShops: HiddenState;
  declare shopsAll: boolean;
  declare shopsHidden: boolean;
  declare hiddenWriteFailed: boolean;

  constructor() {
    super();
    this.fullScreen = false;
    this.postingsSort = DEFAULT_STATE.sort;
    this.subscriptionsSort = DEFAULT_SUBSCRIPTION_SORT;
    this.hiddenShops = { kind: "loading" };
    this.shopsAll = false;
    this.shopsHidden = false;
    this.hiddenWriteFailed = false;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
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

  /** Without a chosen unit, Forskel keeps its place hidden, so the switch is as wide either way and no button moves. */
  private differenceSlot() {
    if (this.ctx.chosen !== null) return this.switchButton("difference", da.difference);
    return html`<button type="button" class="kept" aria-hidden="true" tabindex="-1">${da.difference}</button>`;
  }

  private bars() {
    const ctx = this.ctx;
    // On day bars the key numbers' average is a month's, far above any day.
    const avg = dayUnits(ctx) === null ? keyNumbers(ctx.shown, ctx.timeline).average.amount : null;
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
    const base = within(ctx.shown, chosen ?? ctx.timeline.period);
    const postings = base.filter((p) => matches(p, search, shop));
    const g = ctx.timeline.grouping;
    let body: unknown;
    if (postings.length === 0) {
      const unfiltered = search.trim() === "" && shop === null;
      body = html`<p class="empty">${unfiltered ? da.noSpending : da.noMatch}</p>`;
    } else {
      const units = chosen === null ? ctx.units : [chosen];
      const list = postingList(postings, units, ctx, this.postingsSort, categoryColours(ctx));
      body = html`<hs-postings
          .list=${list}
          .query=${search}
          .shop=${shop}
          .grouping=${g}
          .sort=${this.postingsSort}
          .marked=${ctx.state.detail}
        ></hs-postings>`;
    }
    const above = html`<div class="postings-search-row">
        <hs-search .search=${search} .shop=${shop} .suggestions=${shopSuggestions(base, search)}></hs-search>
        ${this.fullScreen
          ? html`<button type="button" class="show-all" @click=${() => fire(this, "open-all-postings")}>${da.showAll}</button>`
          : nothing}
      </div>
      <p class="postings-summary">${da.summary(count(postings.length), kr(total(postings)))}</p>`;
    return { above, list: body };
  }

  private differenceTitle(unit: Unit): string {
    const ctx = this.ctx;
    const g = ctx.timeline.grouping;
    const name = unitName(unit, g);
    const basis = chosenUnitNumbers(ctx.shown, ctx.timeline, unit).average.basis;
    return basis === "before" ? da.differenceTitleBefore(name) : da.differenceTitle(name, g);
  }

  /** A chosen category is named by its chip and the trail; the title names its main group, so it does not change. */
  private cardTitle(card: Card): string {
    const level = this.ctx.state.level;
    const g = dayUnits(this.ctx) === null ? this.ctx.timeline.grouping : "day";
    if (card === "difference" && this.ctx.chosen !== null) return this.differenceTitle(this.ctx.chosen);
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

  private difference(unit: Unit, title: string) {
    const ctx = this.ctx;
    const level = ctx.state.level;
    const chosen = level.kind === "category" ? level.category : undefined;
    const of = ctx.circleLevel.kind === "all" ? "mainGroup" : "category";
    const items: DifferenceItem[] = differences(ctx.circlePostings, ctx.circleLevel, ctx.timeline, unit).map((d) => ({
      key: d.key,
      name: partName(d.key, of),
      difference: d.difference,
      chosen: d.key === chosen,
    }));
    return html`<hs-difference .items=${items} .title=${title}></hs-difference>
      <p class="half-foot">${da.differenceHint}</p>`;
  }

  /** Faste udgifter does not follow the chosen unit, so its chip does not show there; the unit stays chosen. */
  private chips() {
    const ctx = this.ctx;
    const level = ctx.state.level;
    const unit =
      ctx.chosen === null || ctx.state.card === "subscriptions" ? null : unitName(ctx.chosen, ctx.timeline.grouping);
    if (level.kind !== "category" && unit === null) return nothing;
    return html`<div class="card-chips">
      ${level.kind === "category" ? chip(levelName(level), () => fire(this, "remove-category")) : nothing}
      ${unit === null ? nothing : chip(unit, () => fire(this, "remove-unit"))}
    </div>`;
  }

  private subscriptions(title: string) {
    const table = subscriptionTable(this.ctx, this.subscriptionsSort);
    if (table.rows.length === 0) {
      return { above: nothing, list: html`<p class="empty">${da.noSubscriptions(levelName(this.ctx.state.level))}</p>` };
    }
    return {
      above: objectGroupSums(table, title),
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
      .limit=${this.fullScreen ? null : SHOPS_LIMIT}
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
    const inPlace = view !== null && !this.fullScreen;
    let body: unknown;
    if (listed) {
      const { above, list } = card === "subscriptions" ? this.subscriptions(title) : this.postings();
      body = detailSplit(above, list, view, !this.fullScreen);
    } else if (card === "shops") body = this.shops();
    else if (inPeriod.length === 0) body = this.empty();
    else if (card === "difference" && ctx.chosen !== null) body = this.difference(ctx.chosen, title);
    else body = this.bars();
    return html`<section class="card half" role="region" aria-labelledby=${RIGHT_TITLE}>
      <div class="half-head ${ctx.data.subscriptions.length === 0 && !shops ? "" : "wraps"}">
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
          <div class="card-switch ${ctx.chosen === null ? "" : "with-unit"}" role="group" aria-label=${da.view}>
            ${this.switchButton("bars", da.bars)} ${this.switchButton("postings", da.postings)}
            ${ctx.data.subscriptions.length === 0 ? nothing : this.switchButton("subscriptions", da.subscriptions)}
            ${shops ? this.switchButton("shops", da.shops) : nothing} ${this.differenceSlot()}
          </div>
          <button
            type="button"
            class="full-screen"
            aria-label=${da.fullScreen}
            aria-pressed=${String(this.fullScreen)}
            @click=${() => fire(this, "full-screen-toggle")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d=${this.fullScreen ? COLLAPSE : EXPAND} />
            </svg>
          </button>
        </div>
      </div>
      ${inPlace ? nothing : this.chips()}
      ${card === "shops" && this.hiddenWriteFailed
        ? html`<p class="line alert" role="alert">${da.saveFailed}</p>`
        : nothing}
      ${body}
    </section>`;
  }

  override render() {
    const single = this.fullScreen;
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
  .half-head.wraps {
    flex-wrap: wrap;
  }
  /* A zero basis lets a long title end in "…" rather than push the tools to a second line; they wrap only on a phone. */
  .half-head.wraps > .half-title {
    flex: 1 1 0;
    min-width: 10em;
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
  .card-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }
  .half-sum {
    flex: none;
    color: var(--hs-muted);
    font-variant-numeric: tabular-nums;
  }
  .card-tools {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    min-width: 0;
    gap: 8px;
  }
  .card-tools .full-screen {
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
    flex: 0 1 auto;
    display: inline-flex;
    flex-wrap: wrap;
    max-width: 100%;
  }
  /* The buttons draw the border, so it ends after the last shown one and the kept Forskel place stays outside it. */
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
  .card-switch.with-unit button:last-child,
  .card-switch:not(.with-unit) button:nth-last-child(2) {
    border-radius: 0 6px 6px 0;
  }
  .card-switch button.kept {
    visibility: hidden;
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
  .postings-search-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .postings-search-row .show-all {
    flex: none;
    padding: 0 14px;
    font: inherit;
    color: var(--hs-accent-text);
    background: var(--hs-card);
    border: 1px solid var(--hs-field);
    border-radius: 8px;
    cursor: pointer;
  }
  .postings-search-row .show-all:hover {
    border-color: var(--hs-accent-text);
  }
  .postings-search-row .show-all:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: -2px;
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
