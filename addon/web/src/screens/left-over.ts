import { css, html, LitElement, nothing } from "lit";
import { fire } from "../components/chip";
import { da } from "../i18n/da";
import type { Cell, Column, LeftOverTable, Row } from "../model/left-over";

/**
 * The Til overs view below its trail: one table of months, newest first, closed by "I alt" (spec §4.2). A month's
 * button fires `month-open` with its `YYYY-MM`. With no table yet it shows `placeholders` busy rows.
 */
export class LeftOver extends LitElement {
  static override properties = {
    table: { attribute: false },
    placeholders: { attribute: false },
  };

  declare table: LeftOverTable | null;
  declare placeholders: number;

  constructor() {
    super();
    this.table = null;
    this.placeholders = 0;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private cell(cell: Cell) {
    const members = cell.members;
    return html`<td class="lo-${cell.tone}">
      ${cell.text} ${members === undefined ? nothing : html`<span class="lo-members">${members}</span>`}
    </td>`;
  }

  private row(row: Row, columns: Column[]) {
    const name = row.running ? `${row.name} ${da.leftOver.running}` : row.name;
    return html`<tr>
      <th scope="row">
        <button type="button" class="lo-month" @click=${() => fire(this, "month-open", row.month)}>${name}</button>
      </th>
      ${columns.map((c) => this.cell(row.cells[c]))}
    </tr>`;
  }

  private body() {
    const table = this.table;
    if (table === null) {
      return html`<tbody>
        ${Array.from({ length: this.placeholders }, () => html`<tr class="lo-placeholder"><td></td></tr>`)}
      </tbody>`;
    }
    const columns = table.columns;
    return html`<thead>
        <tr>
          <th scope="col">${da.leftOver.monthColumn}</th>
          ${columns.map((c) => html`<th scope="col">${da.leftOver.columns[c]}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${table.rows.map((r) => this.row(r, columns))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">${table.total.name}</th>
          ${columns.map((c) => this.cell(table.total.cells[c]))}
        </tr>
      </tfoot>`;
  }

  override render() {
    return html`<section class="card left-over">
      <div class="lo-scroll">
        <table aria-busy=${this.table === null ? "true" : "false"}>
          <caption tabindex="-1">${da.leftOver.table}</caption>
          ${this.body()}
        </table>
      </div>
      <p class="lo-note">${da.leftOver.note}</p>
    </section>`;
  }
}

export const leftOverStyles = css`
  .left-over .lo-scroll {
    overflow-x: auto;
  }
  .left-over table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .left-over caption {
    text-align: left;
    font-size: 16px;
    font-weight: 600;
    padding-bottom: 10px;
  }
  .left-over caption:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
  .left-over th,
  .left-over td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--hs-line);
    text-align: right;
    vertical-align: top;
    white-space: nowrap;
  }
  .left-over th:first-child {
    text-align: left;
  }
  .left-over thead th {
    color: var(--hs-muted);
    font-size: 13px;
    font-weight: 600;
  }
  .left-over tfoot th,
  .left-over tfoot td {
    border-top: 2px solid var(--hs-line);
    border-bottom: 0;
    font-weight: 600;
  }
  .left-over .lo-month {
    padding: 0;
    border: 0;
    background: none;
    color: var(--hs-accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .left-over .lo-month:hover,
  .left-over .lo-month:focus-visible {
    text-decoration: underline;
  }
  .left-over .lo-month:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
  .left-over .lo-members {
    display: block;
    color: var(--hs-muted);
    font-size: 12px;
    font-weight: 400;
  }
  .left-over .lo-success {
    color: var(--hs-paid);
  }
  .left-over .lo-danger {
    color: var(--hs-up);
  }
  .left-over .lo-placeholder td {
    height: 37px;
    background: linear-gradient(var(--hs-soft), var(--hs-soft)) 10px 50% / calc(100% - 20px) 14px no-repeat;
  }
  .left-over .lo-note {
    margin: 10px 0 0;
    color: var(--hs-muted);
    font-size: 13px;
  }
`;

if (!customElements.get("hs-left-over")) customElements.define("hs-left-over", LeftOver);

declare global {
  interface HTMLElementTagNameMap {
    "hs-left-over": LeftOver;
  }
}
