import type { Account } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import { da } from "../i18n/da";
import { partName } from "../model/context";
import { backToOverview, clearChoices, keepDetail } from "../state/actions";
import { toHash, type ViewState } from "../state/view";
import { fire } from "./chip";
import "./accounts-picker";
import "./period-picker";

interface Step {
  name: string;
  remove: string;
}

function steps(state: ViewState, unitName: string | null): Step[] {
  const level = state.level;
  const chosen: Step[] = [];
  if (unitName !== null) chosen.push({ name: unitName, remove: "remove-unit" });
  if (level.kind !== "all") chosen.push({ name: partName(level.mainGroup, "mainGroup"), remove: "remove-main-group" });
  if (level.kind === "category") chosen.push({ name: partName(level.category, "category"), remove: "remove-category" });
  return chosen;
}

const SEP = html` <span class="top-sep" aria-hidden="true">›</span> `;

const X = html`<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
  <path d="M1 1 9 9M9 1 1 9" />
</svg>`;

/**
 * The trail and the two dropdowns. Fires `hs-period`, `hs-accounts`, and from the trail's ×
 * `remove-unit`, `remove-main-group` and `remove-category`.
 */
export class TopCard extends LitElement {
  static override properties = {
    state: { attribute: false },
    today: { attribute: false },
    accounts: { attribute: false },
    earliest: { attribute: false },
    unitName: { attribute: false },
  };

  declare state: ViewState;
  declare today: string;
  declare accounts: Account[] | null;
  declare earliest: string | null | undefined;
  /** The chosen unit's name, null while the answer loads or with no unit: the answer decides which units exist. */
  declare unitName: string | null;

  constructor() {
    super();
    this.accounts = null;
    this.unitName = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private trail() {
    const state = this.state;
    const home = (next: ViewState) => html`<a href=${`#${toHash(keepDetail(state, next))}`}>${da.allSpending}</a>${SEP}`;
    if (state.screen === "allPostings") {
      return html`${home(backToOverview(state))}<h1 tabindex="-1">${da.allPostings}</h1>`;
    }
    const chosen = steps(state, this.unitName);
    if (chosen.length === 0) return html`<h1 tabindex="-1">${da.allSpending}</h1>`;
    const last = chosen.length - 1;
    return html`${home(clearChoices(state))}${chosen.map(
      (step, i) => html`${this.step(step, i === last)}${i === last ? nothing : SEP}`,
    )}`;
  }

  /** The step and its × in one unbreakable box, so a wrap never parts them. */
  private step(step: Step, last: boolean) {
    const name = last ? html`<h1 tabindex="-1">${step.name}</h1>` : html`<span>${step.name}</span>`;
    const label = da.remove(step.name);
    return html`<div class="trail-step"
      >${name}<button
        type="button"
        class="trail-x"
        aria-label=${label}
        title=${label}
        @click=${() => fire(this, step.remove)}
      >${X}</button></div
    >`;
  }

  override render() {
    return html`<div class="card top-card">
      <nav class="top-trail" aria-label=${da.trail}>${this.trail()}</nav>
      <div class="top-filters">
        <hs-period-picker .choice=${this.state.period} .today=${this.today} .earliest=${this.earliest}></hs-period-picker>
        <hs-accounts-picker .accounts=${this.accounts} .chosen=${this.state.accounts}></hs-accounts-picker>
      </div>
    </div>`;
  }
}

export const topCardStyles = css`
  .top-card {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  .top-trail {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
  }
  .top-trail a {
    color: var(--hs-accent-text);
    text-decoration: none;
  }
  .top-trail a:hover,
  .top-trail a:focus-visible {
    text-decoration: underline;
  }
  .top-trail .top-sep {
    color: var(--hs-muted);
    font-weight: 400;
  }
  .top-trail h1 {
    margin: 0;
    font: inherit;
  }
  .trail-step {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    white-space: nowrap;
  }
  .trail-x {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 24px;
    height: 24px;
    margin: -4px 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: var(--hs-muted);
    background: transparent;
    cursor: pointer;
  }
  .trail-x svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
  }
  .trail-x:hover,
  .trail-x:focus-visible {
    color: var(--hs-text);
    background: var(--hs-soft);
  }
  .trail-x:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 1px;
  }
  .top-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
  }
  .top-filters,
  .top-filters > * {
    min-width: 0;
    max-width: 100%;
  }
  hs-period-picker {
    --hs-field-width: 360px;
  }
`;

if (!customElements.get("hs-top-card")) customElements.define("hs-top-card", TopCard);

declare global {
  interface HTMLElementTagNameMap {
    "hs-top-card": TopCard;
  }
}
