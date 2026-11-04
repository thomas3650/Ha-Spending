import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { da } from "../i18n/da";
import type { DetailBar, DetailView } from "../model/detail";
import { fire } from "./chip";

const ROWS_SHOWN = 10;
const TITLE = "hs-detail-title";

/**
 * The newest `size` rows, newest first, when the marked row is among them; else the marked row with 4 newer and 5
 * older, shifted to newer when fewer than 5 are older.
 */
export function rowWindow<T extends { marked: boolean }>(rows: T[], size: number): T[] {
  const at = rows.findIndex((r) => r.marked);
  if (at < size) return rows.slice(0, size);
  const start = Math.max(0, Math.min(at - 4, rows.length - size));
  return rows.slice(start, start + size);
}

function keyOf(view: DetailView | undefined): string | null {
  return view === undefined ? null : `${view.key.kind}:${view.key.id}`;
}

/**
 * A click anywhere on a row opens its posting, once: the second click of a double click is not another tab, and a
 * click on the date's own link is left to the link.
 */
function openRow(event: MouseEvent, href: string | null): void {
  if (href === null || event.detail > 1 || (event.target as Element).closest("a")) return;
  window.open(href, "_blank", "noopener,noreferrer");
}

/**
 * The detail of a fixed expense, a subscription or a shop (detail spec §2). "Vis alle" is kept here, not in the hash.
 * "Luk" fires `detail-close`.
 */
export class Detail extends LitElement {
  static override properties = {
    view: { attribute: false },
    closable: { attribute: false },
    all: { state: true },
  };

  declare view: DetailView;
  /** True in the split, which has no other way to close it; the normal page closes it from the card's head. */
  declare closable: boolean;
  declare private all: boolean;
  private shownKey: string | null = null;

  constructor() {
    super();
    this.closable = false;
    this.all = false;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** By the key's fields: the hash makes a new key object on every change, also when the detail stays the same. */
  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has("view")) return;
    const key = keyOf(this.view);
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.all = false;
  }

  private bars(bars: DetailBar[]) {
    const top = Math.max(0, ...bars.map((b) => b.amount));
    const thinned = bars.some((b) => b.name === "");
    return html`<ul class="detail-bars ${thinned ? "thinned" : ""}" role="list" aria-label=${this.view.per}>
      ${bars.map(
        (b) => html`<li title=${b.label}>
          <span class="detail-bar-space" aria-hidden="true">
            ${b.amount > 0 && top > 0
              ? html`<span
                  class="detail-bar ${b.running ? "running" : ""}"
                  style=${styleMap({ height: `${(b.amount / top) * 100}%` })}
                ></span>`
              : nothing}
          </span>
          <span class="detail-bar-name" aria-hidden="true">${b.name}</span>
          <span class="visually-hidden">${b.label}</span>
        </li>`,
      )}
    </ul>`;
  }

  private rows() {
    const all = this.view.rows;
    if (all.length === 0) return html`<p class="empty">${da.noDetailRows}</p>`;
    const rows = this.all ? all : rowWindow(all, ROWS_SHOWN);
    return html`<table class="detail-rows">
        <tbody>
          ${rows.map(
            (r) => html`<tr
              aria-current=${r.marked ? "true" : nothing}
              class=${r.href === null ? "" : "detail-row-link"}
              @click=${(e: MouseEvent) => openRow(e, r.href)}
            >
              <td>
                ${r.href === null
                  ? r.date
                  : html`<a href=${r.href} target="_blank" rel="noopener noreferrer">${r.date}</a>`}
              </td>
              <td>${r.account}</td>
              <td class="detail-amount-cell">${r.amount}</td>
            </tr>`,
          )}
        </tbody>
      </table>
      ${all.length > ROWS_SHOWN
        ? html`<button type="button" class="detail-more" @click=${() => (this.all = !this.all)}>
            ${this.all ? da.showFewer : da.showAllN(all.length)}
          </button>`
        : nothing}`;
  }

  override render() {
    const v = this.view;
    return html`<div class="detail" role="group" aria-labelledby=${TITLE}>
      ${this.closable
        ? html`<button type="button" class="detail-close" aria-label=${da.close} @click=${() => fire(this, "detail-close")}>
            <span aria-hidden="true">✕</span>
          </button>`
        : nothing}
      <p class="detail-context">${v.context}</p>
      <h3 id=${TITLE} tabindex="-1">${v.title}</h3>
      <p class="detail-head">
        <span class="detail-big">${v.amount}</span>
        ${v.status === null
          ? nothing
          : html`<span class="subscription-status status-${v.status.kind}">${v.status.text}</span>`}
        ${v.aside === null ? nothing : html`<span class="detail-aside">${v.aside}</span>`}
      </p>
      <dl class="detail-boxes">
        ${v.boxes.map(
          (b) => html`<div>
            <dt>${b.label}</dt>
            <dd>
              <span class="detail-box-value">${b.value}</span>${b.count === undefined
                ? nothing
                : html` <span class="detail-box-count">${b.count}</span>`}
            </dd>
          </div>`,
        )}
      </dl>
      <p class="detail-per" aria-hidden="true">${v.per}</p>
      ${this.bars(v.bars)} ${this.rows()}
      ${v.href === null
        ? nothing
        : html`<a class="detail-link" href=${v.href} target="_blank" rel="noopener noreferrer"
            >${da.openInFirefly} <span aria-hidden="true">↗</span></a
          >`}
    </div>`;
  }
}

/**
 * The rows above a list, the list and an open detail (detail spec §1.2). In place, on the normal page, the detail takes
 * the list's place; else it goes beside the list. The rows and the list stay rendered, only hidden, so the list keeps
 * its folds and "Vis flere" and its row can take the focus back after a close. The shape is the same in every state,
 * so Lit keeps the elements when a detail opens or closes or full screen turns.
 */
export function detailSplit(above: unknown, list: unknown, view: DetailView | null, inPlace: boolean) {
  const hide = view !== null && inPlace;
  return html`<div class="split-above" ?hidden=${hide}>${above}</div>
    <div class="detail-split ${view !== null && !inPlace ? "open" : ""}">
      <div class="split-list" ?hidden=${hide}>${list}</div>
      ${view === null
        ? nothing
        : html`<div class="split-detail"><hs-detail .view=${view} .closable=${!inPlace}></hs-detail></div>`}
    </div>`;
}

export const detailStyles = css`
  .split-above[hidden],
  .split-list[hidden] {
    display: none;
  }
  .detail-split.open {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
  }
  .detail-split.open > .split-list {
    padding-right: 16px;
  }
  .detail-split.open > .split-detail {
    position: sticky;
    top: 0;
    align-self: start;
    /* Room for the card's and the page's padding under the split, so at the list's end its top stays in view. */
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    padding-left: 16px;
    border-left: 1px solid var(--hs-line);
  }
  /* Where the halves stack (D24), a four-column table does not fit beside the detail. */
  @media (max-width: 1023px) {
    .detail-split.open {
      grid-template-columns: minmax(0, 1fr);
    }
    .detail-split.open > .split-list {
      display: none;
    }
    .detail-split.open > .split-detail {
      position: static;
      max-height: none;
      overflow-y: visible;
      padding-left: 0;
      border-left: 0;
    }
  }
  .row-name {
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .row-name:hover,
  .row-name:focus-visible {
    color: var(--hs-accent-text);
    text-decoration: underline;
  }
  tr[aria-current="true"] > * {
    background: var(--hs-accent-soft);
  }
  tr[aria-current="true"] > :first-child {
    box-shadow: inset 3px 0 0 var(--hs-accent);
  }
  .detail {
    position: relative;
  }
  .detail-close {
    position: absolute;
    top: 0;
    right: 0;
    width: 32px;
    height: 32px;
    font: inherit;
    color: var(--hs-muted);
    background: none;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
  }
  .detail-close:hover {
    color: var(--hs-text);
    background: var(--hs-soft);
  }
  .detail-close:focus-visible,
  .detail-more:focus-visible,
  .detail-link:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
  .detail-context {
    margin: 0;
    color: var(--hs-muted);
  }
  .detail h3 {
    margin: 2px 0 0;
    font-size: 22px;
    font-weight: 600;
  }
  .detail h3:focus {
    outline: none;
  }
  .detail-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    margin: 4px 0 14px;
  }
  .detail-big {
    font-size: 26px;
    font-variant-numeric: tabular-nums;
  }
  .detail-aside {
    color: var(--hs-muted);
  }
  .detail-boxes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 16px;
  }
  .detail-boxes > div {
    padding: 8px 14px;
    background: var(--hs-soft);
    border-radius: 8px;
  }
  .detail-boxes > div:first-child {
    background: var(--hs-accent-soft);
  }
  .detail-boxes dt {
    color: var(--hs-muted);
    font-size: 12px;
  }
  .detail-boxes dd {
    margin: 2px 0 0;
    font-variant-numeric: tabular-nums;
  }
  .detail-box-value,
  .detail-box-count {
    display: block;
  }
  .detail-box-count {
    color: var(--hs-muted);
    font-size: 12px;
  }
  .detail-boxes > div:first-child .detail-box-value {
    font-size: 20px;
    font-weight: bold;
  }
  .detail-per {
    margin: 0 0 6px;
    color: var(--hs-muted);
  }
  .detail-bars {
    display: flex;
    gap: 4px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }
  .detail-bars li {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .detail-bar-space {
    display: flex;
    align-items: flex-end;
    height: 80px;
    border-bottom: 1px solid var(--hs-line);
  }
  .detail-bar {
    width: 100%;
    background: var(--hs-accent);
    border-radius: 2px 2px 0 0;
  }
  .detail-bar.running {
    opacity: var(--hs-running-opacity);
  }
  .detail-bar-name {
    margin-top: 4px;
    overflow: hidden;
    color: var(--hs-muted);
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .detail-bars.thinned li {
    padding-bottom: 20px;
  }
  .detail-bars.thinned .detail-bar-name {
    position: absolute;
    bottom: 0;
    left: 50%;
    overflow: visible;
    text-overflow: clip;
    transform: translateX(-50%);
  }
  .detail-rows {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .detail-rows td {
    padding: 8px 6px;
    border-bottom: 1px solid var(--hs-line);
  }
  .detail-row-link {
    cursor: pointer;
  }
  .detail-row-link:not([aria-current="true"]):hover td {
    background: var(--hs-soft);
  }
  .detail-rows a {
    color: inherit;
    text-decoration: none;
  }
  .detail-rows a:hover {
    text-decoration: underline;
  }
  .detail-rows .detail-amount-cell {
    text-align: right;
    white-space: nowrap;
  }
  .detail-more {
    margin-top: 8px;
    padding: 0;
    font: inherit;
    color: var(--hs-accent-text);
    background: none;
    border: 0;
    cursor: pointer;
    display: block;
  }
  .detail-link {
    display: block;
    width: fit-content;
    margin-top: 12px;
    color: var(--hs-accent-text);
    text-decoration: none;
  }
  .detail-link:hover {
    text-decoration: underline;
  }
  @media (max-width: 480px) {
    .detail-boxes {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;

if (!customElements.get("hs-detail")) customElements.define("hs-detail", Detail);

declare global {
  interface HTMLElementTagNameMap {
    "hs-detail": Detail;
  }
}
