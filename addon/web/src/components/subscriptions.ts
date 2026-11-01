import { css, html, LitElement, nothing } from "lit";
import { da } from "../i18n/da";
import type { SubscriptionRow } from "../model/subscriptions";

/** Abonnementer's table (subscriptions spec §1.2). */
export class Subscriptions extends LitElement {
  static override properties = {
    rows: { attribute: false },
    label: { attribute: false },
  };

  declare rows: SubscriptionRow[];
  /** The card's title, which names the scroll box. */
  declare label: string;

  constructor() {
    super();
    this.rows = [];
    this.label = "";
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
      <td class="subscription-amount subscription-nowrap">${r.perYear}</td>
      <td><span class="subscription-status status-${r.status.kind}">${r.status.text}</span></td>
    </tr>`;
  }

  override render() {
    const c = da.subscriptionColumns;
    // Four columns do not fit a 420 px card, so the box scrolls sideways there and must be reachable by keyboard.
    return html`<div class="subscriptions" tabindex="0" role="group" aria-label=${this.label}>
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
  .subscriptions .subscription-amount {
    text-align: right;
  }
  .subscriptions .subscription-nowrap {
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
  }
  .subscriptions .status-notSeen {
    color: var(--hs-not-seen);
    background: var(--hs-not-seen-soft);
  }
  .subscriptions .status-risen {
    color: var(--hs-risen);
    background: var(--hs-risen-soft);
  }
  .subscriptions .status-expected {
    color: var(--hs-expected);
    background: var(--hs-expected-soft);
  }
  .subscriptions .status-paid {
    color: var(--hs-paid);
    background: var(--hs-paid-soft);
  }
`;

if (!customElements.get("hs-subscriptions")) customElements.define("hs-subscriptions", Subscriptions);

declare global {
  interface HTMLElementTagNameMap {
    "hs-subscriptions": Subscriptions;
  }
}
