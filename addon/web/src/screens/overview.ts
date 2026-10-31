import { chosenUnitNumbers, type ClassifiedPosting, differences, keyNumbers, type Unit, within } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import "../components/bars";
import { chip, fire } from "../components/chip";
import "../components/circle";
import "../components/difference";
import type { DifferenceItem } from "../components/difference";
import "../components/postings";
import { kr, unitName } from "../format";
import { da } from "../i18n/da";
import { barItems, categoryColours, circleItems, circleSpan, circleTotal, partColours } from "../model/circle";
import { levelName, partName, type ViewContext } from "../model/context";
import { groupedPostings } from "../model/postings";
import type { Card } from "../state/view";

const LEFT_TITLE = "hs-left-title";
const RIGHT_TITLE = "hs-right-title";

export class Overview extends LitElement {
  static override properties = {
    ctx: { attribute: false },
  };

  declare ctx: ViewContext;

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

  private postings(inPeriod: ClassifiedPosting[]) {
    const ctx = this.ctx;
    const chosen = ctx.chosen;
    const list =
      chosen === null
        ? groupedPostings(inPeriod, ctx.units, ctx, true, categoryColours(ctx))
        : groupedPostings(within(inPeriod, chosen), [chosen], ctx, true, categoryColours(ctx));
    return html`<hs-postings .list=${list} .grouping=${ctx.timeline.grouping}></hs-postings>
      <p class="half-foot">
        ${da.postingsHint(ctx.timeline.grouping)}
        <button type="button" class="half-link" @click=${() => fire(this, "open-all-postings")}>${da.showAll}</button>
      </p>`;
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

  private chips() {
    const ctx = this.ctx;
    const level = ctx.state.level;
    const unit = ctx.chosen === null ? null : unitName(ctx.chosen, ctx.timeline.grouping);
    return html`${level.kind === "category" ? chip(levelName(level), () => fire(this, "remove-category")) : nothing}
    ${unit === null ? nothing : chip(unit, () => fire(this, "remove-unit"))}`;
  }

  private right() {
    const ctx = this.ctx;
    const card = ctx.state.card;
    const inPeriod = within(ctx.shown, ctx.timeline.period);
    const title = this.cardTitle(card);
    let body: unknown;
    if (inPeriod.length === 0) body = this.empty();
    else if (card === "difference" && ctx.chosen !== null) body = this.difference(ctx.chosen, title);
    else if (card === "postings") body = this.postings(inPeriod);
    else body = this.bars();
    return html`<section class="card half" role="region" aria-labelledby=${RIGHT_TITLE}>
      <div class="half-head">
        <div class="half-title">
          <h2 id=${RIGHT_TITLE}>${title}</h2>
          ${this.chips()}
        </div>
        <div class="card-switch" role="group" aria-label=${da.view}>
          ${this.switchButton("bars", da.bars)} ${this.switchButton("postings", da.postings)}
          ${ctx.chosen === null ? nothing : this.switchButton("difference", da.difference)}
        </div>
      </div>
      ${body}
    </section>`;
  }

  override render() {
    return html`<div class="halves">${this.left()} ${this.right()}</div>`;
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
  .card-switch button:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: -2px;
  }
  .half-foot {
    margin: 12px 0 0;
    color: var(--hs-muted);
    font-size: 12px;
  }
  .half-foot .half-link {
    padding: 0;
    font: inherit;
    color: var(--hs-accent-text);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .half-foot .half-link:hover,
  .half-foot .half-link:focus-visible {
    text-decoration: underline;
  }
`;

if (!customElements.get("hs-overview")) customElements.define("hs-overview", Overview);

declare global {
  interface HTMLElementTagNameMap {
    "hs-overview": Overview;
  }
}
