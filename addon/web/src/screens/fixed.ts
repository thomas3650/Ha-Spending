import { css, html, LitElement, nothing } from "lit";
import "../components/fixed-bars";
import "../components/fixed-list";
import { fire } from "../components/chip";
import { fullScreenButton } from "../components/full-screen-button";
import { da } from "../i18n/da";
import type { FixedView } from "../model/fixed";
import type { FixedList } from "../model/fixed-list";
import type { FixedCard } from "../state/view";

const BARS_TITLE = "hs-fixed-bars-title";
const LIST_TITLE = "hs-fixed-list-title";

/** The fixed-expenses view below its key numbers: the bars on the left, the payments on the right (spec §5, §6). */
export class Fixed extends LitElement {
  static override properties = {
    view: { attribute: false },
    list: { attribute: false },
    groupTitle: { attribute: false },
    full: { attribute: false },
  };

  declare view: FixedView;
  declare list: FixedList;
  /** The object-group step's text, which the bars' title starts with. */
  declare groupTitle: string;
  /** The card that fills the page, if any (spec §3). */
  declare full: FixedCard | null;

  constructor() {
    super();
    this.full = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private head(id: string, title: string, card: FixedCard) {
    return html`<div class="half-head">
      <div class="half-title"><h2 id=${id} tabindex="-1" title=${title}>${title}</h2></div>
      <div class="card-tools">
        ${fullScreenButton(da.fullScreenOf(title), this.full === card, () => fire(this, "fixed-full-toggle", card))}
      </div>
    </div>`;
  }

  private bars() {
    const view = this.view;
    const fill = this.full === "bars" ? "fill" : "";
    return html`<section class="card half ${fill}" role="region" aria-labelledby=${BARS_TITLE}>
      ${this.head(BARS_TITLE, da.levelPer(this.groupTitle, view.grouping), "bars")}
      <hs-fixed-bars
        .bars=${view.bars}
        .parts=${view.parts}
        .grouping=${view.grouping}
        .buttons=${view.buttons}
        .chosen=${view.chosen?.fullStart ?? null}
        .today=${view.today}
      ></hs-fixed-bars>
    </section>`;
  }

  private payments() {
    const list = this.list;
    return html`<section class="card half" role="region" aria-labelledby=${LIST_TITLE}>
      ${this.head(LIST_TITLE, list.title, "list")}
      ${list.empty === null
        ? html`<p class="fixed-summary">${list.summary}</p>
            <hs-fixed-list .list=${list}></hs-fixed-list>`
        : html`<p class="empty">${list.empty}</p>`}
    </section>`;
  }

  /** The card that stays in full screen keeps its place in the template, so it keeps its DOM and the focus. */
  override render() {
    const full = this.full;
    return html`<div class="halves fixed-halves ${full === null ? "" : "single"}">
      ${full === "list" ? nothing : this.bars()} ${full === "bars" ? nothing : this.payments()}
    </div>`;
  }
}

export const fixedStyles = css`
  @media (min-width: 1024px) {
    .halves.fixed-halves:not(.single) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .fixed-summary {
    margin: 0 0 10px;
    color: var(--hs-muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
`;

if (!customElements.get("hs-fixed")) customElements.define("hs-fixed", Fixed);

declare global {
  interface HTMLElementTagNameMap {
    "hs-fixed": Fixed;
  }
}
