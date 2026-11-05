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
    this.list = {
      title: "",
      summary: "",
      showCategory: true,
      perBill: false,
      groups: null,
      rows: [],
      empty: null,
      full: false,
    };
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private get perBill(): boolean {
    return this.list.perBill;
  }

  private columns(): number {
    return (this.perBill ? 2 : 4) + (this.list.showCategory ? 1 : 0);
  }

  private row(r: FixedRow) {
    const status = r.status;
    return html`<tr class=${r.estimate ? "fixed-row estimate" : "fixed-row"}>
      ${this.perBill ? nothing : html`<td class="fixed-fixed">${r.date}</td>`}
      <td class="fixed-name">
        <span class="fixed-name-line"
          ><span class="fixed-dot" aria-hidden="true" style=${styleMap({ background: r.colour })}></span
          ><span class="fixed-clip" title=${r.nameTitle}>${r.name}</span
          >${r.badge
            ? html`<span class="object-group-mark" title=${r.objectGroup}>${r.objectGroup}</span>`
            : nothing}</span
        >
        ${r.sub === null
          ? nothing
          : html`<span class="fixed-fit fixed-sub"><span class="fixed-clip" title=${r.sub}>${r.sub}</span></span>`}
      </td>
      ${this.list.showCategory
        ? html`<td class="fixed-category">
            <span class="fixed-fit"><span class="fixed-clip" title=${r.category}>${r.category}</span></span>
          </td>`
        : nothing}
      <td class="fixed-fixed fixed-amount">${r.amount}</td>
      ${status === null
        ? nothing
        : html`<td class="fixed-fixed">
            <span class="fixed-status ${status.kind} ${status.due ? "due" : ""}">${status.text}</span>
          </td>`}
    </tr>`;
  }

  private group(g: FixedGroup) {
    return html`<tbody>
      <tr class="fixed-group">
        <th scope="rowgroup" colspan=${this.columns() - (this.perBill ? 1 : 2)}>
          <span class="fixed-fit"
            ><span class="fixed-clip" title=${`${g.name} · ${g.count}`}
              >${g.name}<span class="fixed-group-count">${g.count}</span></span
            ></span
          >
        </th>
        <td class="fixed-fixed fixed-amount" colspan=${this.perBill ? 1 : 2}>${g.sum}</td>
      </tr>
      ${g.rows.map((r) => this.row(r))}
    </tbody>`;
  }

  override render() {
    const { full, groups, rows, showCategory, title } = this.list;
    const c = da.subscriptionColumns;
    return html`<div class="fixed-list" tabindex="0" role="group" aria-label=${title}>
      <table class=${full ? "full" : ""}>
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
  /* No cell wraps, and a long text ends in "…" with its tooltip (spec §6.3). Dato, Beløb and Status keep their
     width, so what is short comes from the name and the category, each down to 6em (spec §2.2). */
  .fixed-list td.fixed-fixed {
    width: 1px;
  }
  .fixed-list td.fixed-name,
  .fixed-list td.fixed-category {
    min-width: 6em;
  }
  /* A grid track of minmax(0, max-content) asks for its text's width but lets the table give it less. */
  .fixed-list .fixed-fit {
    display: grid;
    grid-template-columns: minmax(0, max-content);
  }
  .fixed-list .fixed-name-line {
    display: grid;
    grid-template-columns: auto minmax(0, max-content) auto;
    justify-content: start;
    align-items: baseline;
  }
  .fixed-list .fixed-clip {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fixed-list .fixed-name-line .object-group-mark {
    margin-left: 6px;
  }
  /* Full screen's badge (spec §3.3) has a cap, and the line holds the dot, 6em of name and a capped badge, so a narrow
     card cuts a long name no shorter than 6em. The room left over falls after the badge, so short names keep no gap. */
  .fixed-list table.full .fixed-name-line {
    min-width: calc(8px + 6px + 6em + 6px + 120px);
  }
  .fixed-list table.full .object-group-mark {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fixed-list .fixed-sub {
    color: var(--hs-muted);
    font-size: 12px;
  }
  .fixed-list .fixed-dot {
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
  .fixed-status.estimate.due,
  .fixed-status.notSeen {
    color: var(--hs-not-seen);
    background: var(--hs-not-seen-soft);
  }
  /* Dashed, since a due payment is still an estimate (spec §5.2). */
  .fixed-status.estimate.due {
    border-color: var(--hs-not-seen);
  }
`;

if (!customElements.get("hs-fixed-list")) customElements.define("hs-fixed-list", FixedList);

declare global {
  interface HTMLElementTagNameMap {
    "hs-fixed-list": FixedList;
  }
}
