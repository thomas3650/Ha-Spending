import { css, html, LitElement, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { da } from "../i18n/da";
import type { FixedGroup, FixedList as List, FixedRow } from "../model/fixed-list";

/** The fixed-expenses view's payments (spec §6): no sort, and the rows open nothing (§6.4). */
export class FixedList extends LitElement {
  static override properties = {
    list: { attribute: false },
  };

  declare list: List;

  constructor() {
    super();
    this.list = { title: "", summary: "", showCategory: true, groups: null, rows: [], empty: null };
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** A year unit's rows are one per fixed expense, with no date and no status (spec §6.3). */
  private get perBill(): boolean {
    return this.list.rows.length > 0 && this.list.rows[0].date === null;
  }

  private columns(): number {
    return (this.perBill ? 2 : 4) + (this.list.showCategory ? 1 : 0);
  }

  private row(r: FixedRow) {
    const status = r.status;
    return html`<tr class=${r.estimate ? "fixed-row estimate" : "fixed-row"}>
      ${this.perBill ? nothing : html`<td class="fixed-nowrap">${r.date}</td>`}
      <td class="fixed-name">
        <span class="fixed-name-line"
          ><span class="fixed-dot" aria-hidden="true" style=${styleMap({ background: r.colour })}></span
          ><span class="fixed-clip" title=${r.name}>${r.name}</span
          ><span class="object-group-mark" title=${r.objectGroup}>${r.objectGroup}</span></span
        >
        ${r.sub === null ? nothing : html`<span class="fixed-sub fixed-clip" title=${r.sub}>${r.sub}</span>`}
      </td>
      ${this.list.showCategory ? html`<td class="fixed-clip fixed-category" title=${r.category}>${r.category}</td>` : nothing}
      <td class="fixed-amount">${r.amount}</td>
      ${status === null
        ? nothing
        : html`<td>
            <span class="fixed-status ${status.kind}">${status.text}</span>
          </td>`}
    </tr>`;
  }

  private group(g: FixedGroup) {
    return html`<tbody>
      <tr class="fixed-group">
        <th scope="rowgroup" colspan=${this.columns() - (this.perBill ? 1 : 2)}>
          ${g.name}<span class="fixed-group-count">${g.count}</span>
        </th>
        <td class="fixed-amount">${g.sum}</td>
        ${this.perBill ? nothing : html`<td></td>`}
      </tr>
      ${g.rows.map((r) => this.row(r))}
    </tbody>`;
  }

  override render() {
    const { groups, rows, showCategory, title } = this.list;
    const c = da.subscriptionColumns;
    return html`<div class="fixed-list" tabindex="0" role="group" aria-label=${title}>
      <table>
        <thead>
          <tr>
            ${this.perBill ? nothing : html`<th scope="col">${da.fixed.dateColumn}</th>`}
            <th scope="col">${c.name}</th>
            ${showCategory ? html`<th scope="col">${c.category}</th>` : nothing}
            <th scope="col" class="fixed-amount">${c.amount}</th>
            ${this.perBill ? nothing : html`<th scope="col">${c.status}</th>`}
          </tr>
        </thead>
        ${groups === null
          ? html`<tbody>
              ${rows.map((r) => this.row(r))}
            </tbody>`
          : groups.map((g) => this.group(g))}
      </table>
    </div>`;
  }
}

export const fixedListStyles = css`
  .fixed-list {
    overflow-x: auto;
  }
  .fixed-list:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
  .fixed-list table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .fixed-list th,
  .fixed-list td {
    padding: 7px 6px;
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--hs-line);
  }
  .fixed-list thead th {
    color: var(--hs-muted);
    font-weight: normal;
  }
  /* No cell wraps: the name takes what the others leave, and a long text ends in "…" (spec §6.3). */
  .fixed-list td.fixed-name {
    width: 100%;
    max-width: 0;
    min-width: 9em;
  }
  .fixed-list .fixed-name-line {
    display: flex;
    align-items: baseline;
    min-width: 0;
  }
  .fixed-list .fixed-clip {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The badge gives way before the name does. */
  .fixed-list .fixed-name-line .fixed-clip {
    flex: 0 1 auto;
    min-width: 4em;
  }
  .fixed-list .fixed-name-line .object-group-mark {
    flex: 0 100 auto;
    min-width: 0;
    margin-left: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fixed-list td.fixed-category {
    max-width: 9em;
  }
  .fixed-list .fixed-sub {
    display: block;
    color: var(--hs-muted);
    font-size: 12px;
  }
  .fixed-list .fixed-dot {
    flex: none;
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
  }
  .fixed-list .fixed-amount {
    text-align: right;
  }
  .fixed-list tr.estimate td {
    color: var(--hs-expected);
  }
  .fixed-list tr.estimate td.fixed-amount {
    font-style: italic;
  }
  .fixed-list .fixed-group th,
  .fixed-list .fixed-group td {
    background: var(--hs-soft);
    font-weight: bold;
  }
  .fixed-list .fixed-group-count {
    margin-left: 6px;
    color: var(--hs-muted);
    font-weight: normal;
  }
  .fixed-status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }
  .fixed-status.paid {
    color: var(--hs-paid);
    background: var(--hs-paid-soft);
  }
  .fixed-status.estimate {
    color: var(--hs-expected);
    background: var(--hs-expected-soft);
    border: 1px dashed var(--hs-muted);
  }
  .fixed-status.notSeen {
    color: var(--hs-not-seen);
    background: var(--hs-not-seen-soft);
  }
`;

if (!customElements.get("hs-fixed-list")) customElements.define("hs-fixed-list", FixedList);

declare global {
  interface HTMLElementTagNameMap {
    "hs-fixed-list": FixedList;
  }
}
