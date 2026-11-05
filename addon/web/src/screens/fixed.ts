import type { Level } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import { detailSplit } from "../components/detail";
import "../components/fixed-bars";
import "../components/fixed-list";
import { fire } from "../components/chip";
import { fullScreenButton } from "../components/full-screen-button";
import "../components/subscriptions";
import { objectGroupSums } from "../components/subscriptions";
import { da } from "../i18n/da";
import { levelName } from "../model/context";
import type { DetailView } from "../model/detail";
import type { FixedView } from "../model/fixed";
import type { FixedList } from "../model/fixed-list";
import type { SubscriptionTable } from "../model/subscriptions";
import type { DetailKey, FixedCard, FixedTab } from "../state/view";

const BARS_TITLE = "hs-fixed-bars-title";
const LIST_TITLE = "hs-fixed-list-title";

/**
 * The fixed-expenses view below its key numbers: the bars on the left; on the right the payments or every fixed expense
 * (spec §3). It fires `fixed-tab-change` with the tab, and `detail-close`.
 */
export class Fixed extends LitElement {
  static override properties = {
    view: { attribute: false },
    list: { attribute: false },
    groupTitle: { attribute: false },
    full: { attribute: false },
    tab: { attribute: false },
    table: { attribute: false },
    level: { attribute: false },
    detail: { attribute: false },
    marked: { attribute: false },
  };

  declare view: FixedView;
  declare list: FixedList;
  /** The object-group step's text, which the bars' title starts with. */
  declare groupTitle: string;
  /** The card that fills the page, if any (spec §3). */
  declare full: FixedCard | null;
  declare tab: FixedTab;
  /** Alle faste udgifter's table; null on Poster i perioden. */
  declare table: SubscriptionTable | null;
  /** The level, which the empty table's text names. */
  declare level: Level;
  declare detail: DetailView | null;
  /** The row whose detail is open. */
  declare marked: DetailKey | null;

  constructor() {
    super();
    this.full = null;
    this.tab = "payments";
    this.table = null;
    this.level = { kind: "all" };
    this.detail = null;
    this.marked = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Waits for the lists too, so the app can focus a row's button or the detail once they show. */
  protected override async getUpdateComplete(): Promise<boolean> {
    const done = await super.getUpdateComplete();
    const children = [...this.querySelectorAll<LitElement>("hs-fixed-list, hs-subscriptions, hs-detail")];
    await Promise.all(children.map((c) => c.updateComplete));
    return done;
  }

  private fullButton(title: string, card: FixedCard) {
    return fullScreenButton(da.fullScreenOf(title), this.full === card, () => fire(this, "fixed-full-toggle", card));
  }

  private head(id: string, title: string, card: FixedCard) {
    return html`<div class="half-head">
      <div class="half-title"><h2 id=${id} tabindex="-1" title=${title}>${title}</h2></div>
      <div class="card-tools">${this.fullButton(title, card)}</div>
    </div>`;
  }

  private tabButton(tab: FixedTab, label: string) {
    const pressed = this.tab === tab;
    return html`<button
      type="button"
      aria-pressed=${String(pressed)}
      @click=${() => (pressed ? undefined : fire(this, "fixed-tab-change", tab))}
    >
      ${label}
    </button>`;
  }

  /** The tabs keep their places in the template, so a tab change keeps the focus on the pressed button. */
  private listHead(title: string, inPlace: boolean) {
    return html`<div class="half-head with-tools">
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
        <h2 id=${LIST_TITLE} tabindex="-1" title=${title}>${title}</h2>
      </div>
      <div class="card-tools">
        <div class="card-switch" role="group" aria-label=${da.view}>
          ${this.tabButton("payments", da.fixed.inPeriod)} ${this.tabButton("all", da.allFixed)}
        </div>
        ${this.fullButton(title, "list")}
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
    return list.empty === null
      ? html`<p class="fixed-summary">${list.summary}</p>
          <hs-fixed-list .list=${list}></hs-fixed-list>`
      : html`<p class="empty">${list.empty}</p>`;
  }

  /** In the normal card the detail takes the list's place; in full screen it stands beside it (spec §3.5). */
  private all(table: SubscriptionTable | null, inPlace: boolean) {
    if (table === null || table.rows.length === 0) {
      return html`<p class="empty">${da.noSubscriptions(levelName(this.level))}</p>`;
    }
    const list = html`<hs-subscriptions .table=${table} .label=${da.allFixed} .marked=${this.marked}></hs-subscriptions>
      <p class="half-foot">${da.subscriptionsFoot}</p>`;
    return detailSplit(objectGroupSums(table, da.objectGroupSums(da.allFixed)), list, this.detail, inPlace);
  }

  private right() {
    const all = this.tab === "all";
    const title = all ? da.allFixed : this.list.title;
    const besideList = this.full === "list";
    const inPlace = all && this.detail !== null && !besideList;
    return html`<section class="card half right" role="region" aria-labelledby=${LIST_TITLE}>
      ${this.listHead(title, inPlace)} ${all ? this.all(this.table, !besideList) : this.payments()}
    </section>`;
  }

  /** The card that stays in full screen keeps its place in the template, so it keeps its DOM and the focus. */
  override render() {
    const full = this.full;
    return html`<div class="halves fixed-halves ${full === null ? "" : "single"}">
      ${full === "list" ? nothing : this.bars()} ${full === "bars" ? nothing : this.right()}
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
