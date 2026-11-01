import { css, html, LitElement, nothing } from "lit";
import { da } from "../i18n/da";
import type { SubscriptionRow } from "../model/subscriptions";

/** Abonnementer's table (subscriptions spec §1.2). */
export class Subscriptions extends LitElement {
  static override properties = {
    rows: { attribute: false },
  };

  declare rows: SubscriptionRow[];

  constructor() {
    super();
    this.rows = [];
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private row(r: SubscriptionRow) {
    const name = r.href ? html`<a href=${r.href} target="_blank" rel="noopener noreferrer">${r.name}</a>` : r.name;
    return html`<tr>
      <td>
        <span class="subscription-name">${name}</span>
        ${r.next === null ? nothing : html`<span class="subscription-next">${da.nextOn(r.next)}</span>`}
      </td>
      <td class="subscription-amount">${r.amount}</td>
      <td class="subscription-amount">${r.perYear}</td>
      <td><span class="subscription-status status-${r.status.kind}">${r.status.text}</span></td>
    </tr>`;
  }

  override render() {
    const c = da.subscriptionColumns;
    return html`<div class="subscriptions">
      <table>
        <thead>
          <tr>
            <th scope="col">${c.name}</th>
            <th scope="col" class="subscription-amount">${c.amount}</th>
            <th scope="col" class="subscription-amount">${c.perYear}</th>
            <th scope="col">${c.status}</th>
          </tr>
        </thead>
        <tbody>
          ${this.rows.map((r) => this.row(r))}
        </tbody>
      </table>
    </div>`;
  }
}

export const subscriptionsStyles = css`
  .subscriptions {
    overflow-x: auto;
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
  .subscriptions .subscription-amount {
    text-align: right;
    white-space: nowrap;
  }
  .subscriptions .subscription-name,
  .subscriptions .subscription-next {
    display: block;
  }
  .subscriptions .subscription-next {
    color: var(--hs-muted);
    font-size: 12px;
  }
  .subscriptions a {
    color: inherit;
    text-decoration: none;
  }
  .subscriptions a:hover,
  .subscriptions a:focus-visible {
    color: var(--hs-accent-text);
    text-decoration: underline;
  }
  .subscriptions .subscription-status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    white-space: nowrap;
  }
  .subscriptions .status-notSeen {
    color: #b71c1c;
    background: #fdecea;
  }
  .subscriptions .status-risen {
    color: #9a4a00;
    background: #fff1e0;
  }
  .subscriptions .status-expected {
    color: #37474f;
    background: #eceff1;
  }
  .subscriptions .status-paid {
    color: #1b5e20;
    background: #e8f5e9;
  }
`;

if (!customElements.get("hs-subscriptions")) customElements.define("hs-subscriptions", Subscriptions);

declare global {
  interface HTMLElementTagNameMap {
    "hs-subscriptions": Subscriptions;
  }
}
