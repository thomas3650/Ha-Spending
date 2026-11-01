import { chosenUnitNumbers, differences, keyNumbers, total, type Unit, within } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import "../components/bars";
import { chip, fire } from "../components/chip";
import "../components/circle";
import "../components/difference";
import type { DifferenceItem } from "../components/difference";
import "../components/postings";
import "../components/search";
import "../components/subscriptions";
import { count, kr, unitName } from "../format";
import { da } from "../i18n/da";
import { barItems, categoryColours, circleItems, circleSpan, circleTotal, partColours } from "../model/circle";
import { levelName, partName, type ViewContext } from "../model/context";
import { matches, shopSuggestions } from "../model/filter";
import { groupedPostings } from "../model/postings";
import { subscriptionsYear, subscriptionTable } from "../model/subscriptions";
import type { Card } from "../state/view";

const LEFT_TITLE = "hs-left-title";
const RIGHT_TITLE = "hs-right-title";
const EXPAND = "M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7";
const COLLAPSE = "M14 4v6h6M14 10l7-7M10 20v-6H4M10 14l-7 7";

export class Overview extends LitElement {
  static override properties = {
    ctx: { attribute: false },
    fullScreen: { attribute: false },
  };

  declare ctx: ViewContext;
  declare fullScreen: boolean;

  constructor() {
    super();
    this.fullScreen = false;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
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
    const hint = all ? da.circleHintAll : selected ? da.chosenHint(name) : da.circleHintGroup;
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
            <p class="half-foot">${hint}</p>`}
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
    const g = ctx.timeline.grouping;
    const avg = keyNumbers(ctx.shown, ctx.timeline).average.amount;
    const average = avg === null ? null : { amount: avg, label: da.average(kr(avg)) };
    const level = ctx.state.level;
    const colour = level.kind === "category" ? (partColours(ctx).get(level.category) ?? "") : "";
    return html`<hs-bars
        .items=${barItems(ctx)}
        .colour=${colour}
        .average=${average}
        .chosen=${ctx.state.unit}
      ></hs-bars>
      <p class="half-foot">${da.barsHint(g)}</p>`;
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
    }
    else {
      const list = groupedPostings(postings, chosen === null ? ctx.units : [chosen], ctx, true, categoryColours(ctx));
      body = html`<hs-postings .list=${list} .query=${search} .shop=${shop} .grouping=${g}></hs-postings>
        <p class="half-foot">${da.postingsHint(g)}</p>`;
    }
    return html`<div class="postings-search-row">
        <hs-search .search=${search} .shop=${shop} .suggestions=${shopSuggestions(base, search)}></hs-search>
        <button type="button" class="show-all" @click=${() => fire(this, "open-all-postings")}>${da.showAll}</button>
      </div>
      <p class="postings-summary">${da.summary(count(postings.length), kr(total(postings)))}</p>
      ${body}`;
  }

  private differenceTitle(unit: Unit): string {
    const ctx = this.ctx;
    const g = ctx.timeline.grouping;
    const name = unitName(unit, g);
    const basis = chosenUnitNumbers(ctx.shown, ctx.timeline, unit).average.basis;
    return basis === "before" ? da.differenceTitleBefore(name) : da.differenceTitle(name, g);
  }

  private cardTitle(card: Card): string {
    const level = this.ctx.state.level;
    const g = this.ctx.timeline.grouping;
    const all = level.kind === "all";
    if (card === "subscriptions") return all ? da.subscriptions : da.subscriptionsIn(levelName(level));
    if (card === "difference" && this.ctx.chosen !== null) return this.differenceTitle(this.ctx.chosen);
    if (card === "postings") return all ? da.postingsTitle : da.postingsOf(levelName(level));
    return all ? da.per(g) : da.levelPer(levelName(level), g);
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
    return html`${level.kind === "category" ? chip(levelName(level), () => fire(this, "remove-category")) : nothing}
    ${unit === null ? nothing : chip(unit, () => fire(this, "remove-unit"))}`;
  }

  private subscriptions(title: string) {
    const table = subscriptionTable(this.ctx);
    if (table.rows.length === 0) return html`<p class="empty">${da.noSubscriptions(levelName(this.ctx.state.level))}</p>`;
    return html`<hs-subscriptions .table=${table} .label=${title}></hs-subscriptions>
      <p class="half-foot">${da.subscriptionsFoot}</p>`;
  }

  private right() {
    const ctx = this.ctx;
    const card = ctx.state.card;
    const inPeriod = within(ctx.shown, ctx.timeline.period);
    const title = this.cardTitle(card);
    let body: unknown;
    if (card === "subscriptions") body = this.subscriptions(title);
    else if (card === "postings") body = this.postings();
    else if (inPeriod.length === 0) body = this.empty();
    else if (card === "difference" && ctx.chosen !== null) body = this.difference(ctx.chosen, title);
    else body = this.bars();
    return html`<section class="card half" role="region" aria-labelledby=${RIGHT_TITLE}>
      <div class="half-head ${ctx.data.subscriptions.length === 0 ? "" : "wraps"}">
        <div class="half-title">
          <h2 id=${RIGHT_TITLE}>${title}</h2>
          ${this.chips()}
        </div>
        ${card === "subscriptions"
          ? html`<span class="half-sum">${da.perYear(kr(subscriptionsYear(ctx)))}</span>`
          : nothing}
        <div class="card-tools">
          <div class="card-switch" role="group" aria-label=${da.view}>
            ${this.switchButton("bars", da.bars)} ${this.switchButton("postings", da.postings)}
            ${ctx.chosen === null ? nothing : this.switchButton("difference", da.difference)}
            ${ctx.data.subscriptions.length === 0 ? nothing : this.switchButton("subscriptions", da.subscriptions)}
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
  .half-head h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  .half-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    min-width: 0;
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
    flex: none;
    display: inline-flex;
    border: 1px solid var(--hs-field);
    border-radius: 6px;
    overflow: hidden;
  }
  .card-switch button {
    font: inherit;
    padding: 6px 14px;
    color: var(--hs-text);
    background: var(--hs-card);
    border: 0;
    cursor: pointer;
  }
  .card-switch button + button {
    border-left: 1px solid var(--hs-field);
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
