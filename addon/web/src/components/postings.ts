import type { Grouping } from "@ha-spending/shared";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { count, postingAmount, tableDate } from "../format";
import { da } from "../i18n/da";
import type { PostingGroup, PostingList, PostingRow } from "../model/postings";

const GROUPS_STEP = 12;
const ROWS_STEP = 100;
const OPEN_AT_FIRST = 2;

function resetKey(list: PostingList, query: string, shop: string | null): string {
  const first = list.kind === "grouped" ? `grouped:${list.groups[0]?.key ?? ""}` : `flat:${list.rows[0]?.posting.id ?? ""}`;
  return `${first}|${query}|${shop ?? ""}`;
}

/**
 * Posteringer's table (UI spec §4.2): one `<tbody>` per unit with a group line that folds it in and out, or one flat
 * list. Folding and showing more are kept here, not in the view state (D20).
 */
export class Postings extends LitElement {
  static override properties = {
    list: { attribute: false },
    query: { attribute: false },
    shop: { attribute: false },
    showCategory: { attribute: false },
    grouping: { attribute: false },
    toggled: { state: true },
    shown: { state: true },
  };

  declare list: PostingList;
  declare query: string;
  declare shop: string | null;
  declare showCategory: boolean;
  declare grouping: Grouping;
  /** The groups folded the other way from how they start. */
  declare private toggled: ReadonlySet<string>;
  /** Groups, or rows of a flat list. */
  declare private shown: number;
  private shownFor: string | null = null;

  constructor() {
    super();
    this.list = { kind: "flat", rows: [] };
    this.query = "";
    this.shop = null;
    this.showCategory = false;
    this.grouping = "month";
    this.toggled = new Set();
    this.shown = 0;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("list") && !changed.has("query") && !changed.has("shop")) return;
    const key = resetKey(this.list, this.query, this.shop);
    if (key === this.shownFor) return;
    this.shownFor = key;
    this.toggled = new Set();
    this.shown = this.list.kind === "grouped" ? GROUPS_STEP : ROWS_STEP;
  }

  /** The first two in the shown order, oldest first too: they are the groups in view. */
  private isOpen(group: PostingGroup, index: number): boolean {
    return index < OPEN_AT_FIRST !== this.toggled.has(group.key);
  }

  private toggle(key: string): void {
    const next = new Set(this.toggled);
    if (!next.delete(key)) next.add(key);
    this.toggled = next;
  }

  private columns(): number {
    return this.showCategory ? 5 : 4;
  }

  private row(r: PostingRow) {
    const p = r.posting;
    const shown = p.shop ?? p.text;
    const text = r.href
      ? html`<a href=${r.href} target="_blank" rel="noopener noreferrer">${shown}</a>`
      : shown;
    return html`<tr class="posting">
      <td class="posting-date">${tableDate(p.date)}</td>
      <td title=${p.shop === null ? nothing : p.text}>${text}</td>
      ${this.showCategory
        ? html`<td>
            <span class="posting-dot" aria-hidden="true" style=${styleMap({ background: r.colour })}></span>${r.category}
          </td>`
        : nothing}
      <td>${r.account}</td>
      <td class="posting-amount">${postingAmount(p.amount)}</td>
    </tr>`;
  }

  private group(group: PostingGroup, index: number) {
    const open = this.isOpen(group, index);
    const n = count(group.rows.length);
    const sum = postingAmount(group.total);
    return html`<tbody>
      <tr class="group-line">
        <th scope="rowgroup" colspan=${this.columns()}>
          <button
            type="button"
            aria-expanded=${String(open)}
            aria-label=${`${group.name}, ${n}, ${sum}`}
            @click=${() => this.toggle(group.key)}
          >
            <span class="group-name">${group.name}</span>
            <span class="group-count">· ${n}</span>
            <span class="group-sum">${sum}</span>
          </button>
        </th>
      </tr>
      ${open ? group.rows.map((r) => this.row(r)) : nothing}
    </tbody>`;
  }

  private more(label: string, step: number) {
    return html`<button type="button" class="postings-more" @click=${() => (this.shown += step)}>${label}</button>`;
  }

  override render() {
    const list = this.list;
    const head = html`<thead>
      <tr>
        <th scope="col">${da.columns.unitAndDate(this.grouping)}</th>
        <th scope="col">${da.columns.text}</th>
        ${this.showCategory ? html`<th scope="col">${da.columns.category}</th>` : nothing}
        <th scope="col">${da.columns.account}</th>
        <th scope="col" class="posting-amount">${da.columns.amount}</th>
      </tr>
    </thead>`;
    if (list.kind === "grouped") {
      const groups = list.groups.slice(0, this.shown);
      return html`<div class="postings">
        <table>
          ${head} ${groups.map((g, i) => this.group(g, i))}
        </table>
        ${list.groups.length > groups.length
          ? this.more(list.newestFirst ? da.showOlder : da.showNewer, GROUPS_STEP)
          : nothing}
      </div>`;
    }
    const rows = list.rows.slice(0, this.shown);
    return html`<div class="postings">
      <table>
        ${head}
        <tbody>
          ${rows.map((r) => this.row(r))}
        </tbody>
      </table>
      ${list.rows.length > rows.length ? this.more(da.showMore, ROWS_STEP) : nothing}
    </div>`;
  }
}

export const postingsStyles = css`
  .postings table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .postings th,
  .postings td {
    padding: 8px 6px;
    text-align: left;
    border-bottom: 1px solid var(--hs-line);
  }
  .postings thead th {
    color: var(--hs-muted);
    font-weight: normal;
  }
  .postings .posting-amount {
    text-align: right;
  }
  .postings .posting-date {
    padding-left: 24px;
  }
  .postings .group-line th {
    padding: 0;
    background: var(--hs-soft);
  }
  .postings .group-line button {
    display: flex;
    gap: 6px;
    width: 100%;
    padding: 8px 6px;
    font: inherit;
    font-weight: bold;
    color: var(--hs-text);
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .postings .group-line button::before {
    content: "▸";
    font-size: 10px;
    align-self: center;
  }
  .postings .group-line button[aria-expanded="true"]::before {
    content: "▾";
  }
  .postings .group-count {
    font-weight: normal;
  }
  .postings .group-sum {
    margin-left: auto;
  }
  .postings .group-line button:hover,
  .postings .group-line button:focus-visible {
    background: var(--hs-accent-soft);
  }
  .postings a {
    color: inherit;
    text-decoration: none;
  }
  .postings a:hover,
  .postings a:focus-visible {
    color: var(--hs-accent-text);
    text-decoration: underline;
  }
  .postings .posting-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
  }
  .postings .postings-more {
    margin-top: 8px;
    padding: 0;
    font: inherit;
    color: var(--hs-accent-text);
    background: none;
    border: 0;
    cursor: pointer;
  }
`;

if (!customElements.get("hs-postings")) customElements.define("hs-postings", Postings);

declare global {
  interface HTMLElementTagNameMap {
    "hs-postings": Postings;
  }
}
