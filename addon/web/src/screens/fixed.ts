import { css, html, LitElement } from "lit";
import "../components/fixed-bars";
import "../components/fixed-list";
import { da } from "../i18n/da";
import type { FixedView } from "../model/fixed";
import type { FixedList } from "../model/fixed-list";

const BARS_TITLE = "hs-fixed-bars-title";
const LIST_TITLE = "hs-fixed-list-title";

/** The fixed-expenses view below its key numbers: the bars on the left, the payments on the right (spec §5, §6). */
export class Fixed extends LitElement {
  static override properties = {
    view: { attribute: false },
    list: { attribute: false },
    groupTitle: { attribute: false },
  };

  declare view: FixedView;
  declare list: FixedList;
  /** The object-group step's text, which the bars' title starts with. */
  declare groupTitle: string;

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render() {
    const view = this.view;
    const list = this.list;
    return html`<div class="halves fixed-halves">
      <section class="card half" role="region" aria-labelledby=${BARS_TITLE}>
        <div class="half-head">
          <h2 id=${BARS_TITLE} tabindex="-1">${da.levelPer(this.groupTitle, view.grouping)}</h2>
        </div>
        <hs-fixed-bars
          .bars=${view.bars}
          .parts=${view.parts}
          .grouping=${view.grouping}
          .buttons=${view.buttons}
          .chosen=${view.chosen?.fullStart ?? null}
          .today=${view.today}
        ></hs-fixed-bars>
      </section>
      <section class="card half" role="region" aria-labelledby=${LIST_TITLE}>
        <div class="half-head">
          <h2 id=${LIST_TITLE}>${list.title}</h2>
        </div>
        ${list.empty === null
          ? html`<p class="fixed-summary">${list.summary}</p>
              <hs-fixed-list .list=${list}></hs-fixed-list>`
          : html`<p class="empty">${list.empty}</p>`}
      </section>
    </div>`;
  }
}

export const fixedStyles = css`
  .halves.fixed-halves {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  @media (max-width: 1023px) {
    .halves.fixed-halves {
      grid-template-columns: minmax(0, 1fr);
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
