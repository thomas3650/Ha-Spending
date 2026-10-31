import { type ClassifiedPosting, keyNumbers, within } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import "../components/bars";
import "../components/circle";
import "../components/postings";
import { kr } from "../format";
import { da } from "../i18n/da";
import { barItems, categoryColours, circleItems, circleTotal } from "../model/circle";
import { levelName, type ViewContext } from "../model/context";
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

  private fire(name: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private empty() {
    return html`<p class="empty">${da.noSpending}</p>`;
  }

  private left() {
    const ctx = this.ctx;
    const all = ctx.circleLevel.kind === "all";
    const items = circleItems(ctx);
    const whole = circleTotal(ctx);
    const empty = within(ctx.circlePostings, ctx.timeline.period).length === 0;
    return html`<section class="card half" role="region" aria-labelledby=${LEFT_TITLE}>
      <div class="half-head">
        <h2 id=${LEFT_TITLE}>${all ? da.mainGroups : da.categories}</h2>
        <span class="half-sum">${kr(whole)}</span>
      </div>
      ${empty
        ? this.empty()
        : html`<hs-circle .items=${items} .centreName=${levelName(ctx.circleLevel)} .centreAmount=${whole}></hs-circle>
            <p class="foot">${all ? da.circleHintAll : da.circleHintGroup}</p>`}
    </section>`;
  }

  private switchButton(card: Card, label: string) {
    const pressed = this.ctx.state.card === card;
    return html`<button
      type="button"
      aria-pressed=${String(pressed)}
      @click=${() => this.fire("card-change", card)}
    >
      ${label}
    </button>`;
  }

  private bars() {
    const ctx = this.ctx;
    const g = ctx.timeline.grouping;
    const avg = keyNumbers(ctx.shown, ctx.timeline).average.amount;
    const average = avg === null ? null : { amount: avg, label: da.average(kr(avg)) };
    return html`<hs-bars .items=${barItems(ctx)} .average=${average} .chosen=${ctx.state.unit}></hs-bars>
      <p class="foot">${da.barsHint(g)}</p>`;
  }

  private postings(inPeriod: ClassifiedPosting[]) {
    const ctx = this.ctx;
    const list = groupedPostings(inPeriod, ctx.units, ctx, true, categoryColours(ctx));
    return html`<hs-postings .list=${list} .grouping=${ctx.timeline.grouping}></hs-postings>
      <p class="foot">
        ${da.postingsHint(ctx.timeline.grouping)}
        <button type="button" class="link" @click=${() => this.fire("open-all-postings")}>${da.showAll}</button>
      </p>`;
  }

  private right() {
    const ctx = this.ctx;
    const card = ctx.state.card;
    const inPeriod = within(ctx.shown, ctx.timeline.period);
    const title = card === "postings" ? da.postingsTitle : card === "bars" ? da.per(ctx.timeline.grouping) : da.difference;
    let body: unknown = nothing;
    if (inPeriod.length === 0) body = this.empty();
    else if (card === "bars") body = this.bars();
    else if (card === "postings") body = this.postings(inPeriod);
    return html`<section class="card half" role="region" aria-labelledby=${RIGHT_TITLE}>
      <div class="half-head">
        <h2 id=${RIGHT_TITLE}>${title}</h2>
        <div class="switch" role="group" aria-label=${da.view}>
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
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .half-head h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  .half-sum {
    color: var(--hs-muted);
    font-variant-numeric: tabular-nums;
  }
  .switch {
    display: inline-flex;
    border: 1px solid var(--hs-field);
    border-radius: 6px;
    overflow: hidden;
  }
  .switch button {
    font: inherit;
    padding: 6px 14px;
    color: var(--hs-text);
    background: var(--hs-card);
    border: 0;
    cursor: pointer;
  }
  .switch button + button {
    border-left: 1px solid var(--hs-field);
  }
  .switch button[aria-pressed="true"] {
    color: #fff;
    font-weight: 600;
    background: var(--hs-accent);
  }
  .switch button:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: -2px;
  }
  .foot {
    margin: 12px 0 0;
    color: var(--hs-muted);
    font-size: 12px;
  }
  .foot .link {
    padding: 0;
    font: inherit;
    color: var(--hs-accent-text);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .foot .link:hover,
  .foot .link:focus-visible {
    text-decoration: underline;
  }
`;

if (!customElements.get("hs-overview")) customElements.define("hs-overview", Overview);

declare global {
  interface HTMLElementTagNameMap {
    "hs-overview": Overview;
  }
}
