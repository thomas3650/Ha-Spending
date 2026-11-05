import { css, html, LitElement, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { da } from "../i18n/da";
import { DEFAULT_SUBSCRIPTION_SORT, type SubscriptionGroup, type SubscriptionRow, type SubscriptionTable } from "../model/subscriptions";
import type { DetailKey, SubscriptionColumn } from "../state/view";
import { fire } from "./chip";
import { sortHeader } from "./sort-header";

/** The sum per year of each object group, apart from the table so that the split keeps them above it. */
export function objectGroupSums(table: SubscriptionTable, label: string) {
  return html`<ul class="object-group-sums" role="list" aria-label=${label}>
    ${table.objectGroups.map(
      (g) => html`<li>
        <span class="object-group-sum-name">${g.name}</span>
        <span class="object-group-sum-value">${g.perYear}</span>
      </li>`,
    )}
  </ul>`;
}

/** The Faste udgifter card's table (subscriptions spec §1.2). */
export class Subscriptions extends LitElement {
  static override properties = {
    table: { attribute: false },
    label: { attribute: false },
    marked: { attribute: false },
  };

  /** Its `sort` is the one the headers show; a header click fires `subscription-sort` with its column. */
  declare table: SubscriptionTable;
  /** The card's title, which names the scroll box. */
  declare label: string;
  /** The row whose detail is open. */
  declare marked: DetailKey | null;

  constructor() {
    super();
    this.table = { objectGroups: [], groups: null, showCategory: false, rows: [], sort: DEFAULT_SUBSCRIPTION_SORT };
    this.label = "";
    this.marked = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** The click is the row's, so a click beside the name opens the detail too; the button gives the keyboard a way. */
  private row(r: SubscriptionRow, showCategory: boolean) {
    const marked = this.marked?.kind === "subscription" && this.marked.id === r.id;
    return html`<tr
      class="subscription-row"
      aria-current=${marked ? "true" : nothing}
      @click=${() => fire(this, "detail-open", { kind: "subscription", id: r.id })}
    >
      <td>
        <span class="subscription-name"
          ><button type="button" class="row-name" data-detail=${`s:${r.id}`}>${r.name}</button>
          <span class="object-group-mark">${r.objectGroup}</span></span
        >
        ${r.next === null ? nothing : html`<span class="subscription-next">${da.nextOn(r.next)}</span>`}
      </td>
      ${showCategory ? html`<td>${r.category}</td>` : nothing}
      <td class="subscription-amount">
        <span class="subscription-payment">${r.amount}</span>
        <span class="subscription-repeat">${r.repeat}</span>
      </td>
      <td
        class="subscription-amount subscription-nowrap ${r.notInSum === null ? "" : "subscription-not-in-sum"}"
        title=${r.notInSum ?? nothing}
      >
        ${r.perYear}${r.notInSum === null ? nothing : html` <span class="visually-hidden">${r.notInSum}</span>`}
      </td>
      <td><span class="subscription-status status-${r.status.due ? "due" : r.status.kind}">${r.status.text}</span></td>
    </tr>`;
  }

  private group(g: SubscriptionGroup, showCategory: boolean) {
    return html`<tbody>
      <tr class="subscription-group">
        <th scope="rowgroup" colspan=${showCategory ? 3 : 2}>
          <span class="subscription-dot" aria-hidden="true" style=${styleMap({ background: g.colour })}></span>
          <span class="subscription-group-name">${g.name}</span>
          <span class="subscription-group-count">${g.count}</span>
        </th>
        <td class="subscription-amount subscription-nowrap">${g.perYear}</td>
        <td></td>
      </tr>
      ${g.rows.map((r) => this.row(r, showCategory))}
    </tbody>`;
  }

  override render() {
    const c = da.subscriptionColumns;
    const header = (column: SubscriptionColumn, label: string, className = "") =>
      sortHeader(column, label, this.table.sort, (col) => fire(this, "subscription-sort", col), className);
    const { groups, showCategory, rows } = this.table;
    // The columns do not fit a 420 px card, so the box scrolls sideways there and must be reachable by keyboard.
    return html`<div class="subscriptions" tabindex="0" role="group" aria-label=${this.label}>
      <table>
        <thead>
          <tr>
            ${header("name", c.name)} ${showCategory ? header("category", c.category) : nothing}
            ${header("amount", c.amount, "subscription-amount")} ${header("perYear", c.perYear, "subscription-amount")}
            ${header("status", c.status)}
          </tr>
        </thead>
        ${groups === null
          ? html`<tbody>
              ${rows.map((r) => this.row(r, showCategory))}
            </tbody>`
          : groups.map((g) => this.group(g, showCategory))}
      </table>
    </div>`;
  }
}

export const subscriptionsStyles = css`
  .object-group-sums {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }
  .object-group-sums li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 140px;
    padding: 8px 12px;
    background: var(--hs-soft);
    border-radius: 8px;
  }
  .object-group-sum-name {
    color: var(--hs-muted);
    font-size: 12px;
  }
  .object-group-sum-value {
    font-size: 16px;
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }
  .subscriptions {
    overflow-x: auto;
  }
  .subscriptions:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
  .subscriptions table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .subscriptions th,
  .subscriptions td {
    padding: 8px 6px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--hs-line);
  }
  .subscriptions thead th {
    color: var(--hs-muted);
    font-weight: normal;
  }
  .subscriptions .subscription-group th,
  .subscriptions .subscription-group td {
    background: var(--hs-soft);
    font-weight: bold;
    vertical-align: middle;
  }
  .subscriptions .subscription-group-count {
    margin-left: 6px;
    font-weight: normal;
  }
  .subscriptions .subscription-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
  }
  .subscriptions .subscription-amount {
    text-align: right;
  }
  .subscriptions .subscription-nowrap {
    white-space: nowrap;
  }
  .subscriptions .subscription-name,
  .subscriptions .subscription-next,
  .subscriptions .subscription-payment,
  .subscriptions .subscription-repeat {
    display: block;
  }
  .subscriptions .subscription-next,
  .subscriptions .subscription-repeat {
    color: var(--hs-muted);
    font-size: 12px;
  }
  .subscriptions tr.subscription-row {
    cursor: pointer;
  }
  .subscriptions tr.subscription-row:hover {
    background: var(--hs-soft);
  }
  .subscription-status {
    display: inline-block;
    white-space: nowrap;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }
  .subscription-status.status-notSeen {
    color: var(--hs-not-seen);
    background: var(--hs-not-seen-soft);
  }
  .subscription-status.status-risen {
    color: var(--hs-risen);
    background: var(--hs-risen-soft);
  }
  .subscription-status.status-expected {
    color: var(--hs-expected);
    background: var(--hs-expected-soft);
  }
  .subscription-status.status-due {
    color: var(--hs-not-seen);
    background: var(--hs-not-seen-soft);
  }
  .subscription-status.status-paid {
    color: var(--hs-paid);
    background: var(--hs-paid-soft);
  }
  .subscription-status.status-next,
  .subscription-status.status-ended {
    color: var(--hs-muted);
  }
  .subscription-not-in-sum {
    color: var(--hs-muted);
  }
`;

if (!customElements.get("hs-subscriptions")) customElements.define("hs-subscriptions", Subscriptions);

declare global {
  interface HTMLElementTagNameMap {
    "hs-subscriptions": Subscriptions;
  }
}
