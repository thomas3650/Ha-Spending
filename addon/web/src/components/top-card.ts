import type { Account, Grouping } from "@ha-spending/shared";
import { css, html, LitElement } from "lit";
import { live } from "lit/directives/live.js";
import { da } from "../i18n/da";
import { partName } from "../model/context";
import { trailLevel } from "../state/actions";
import { toHash, type ViewState } from "../state/view";
import "./accounts-picker";
import "./period-picker";

const GROUPINGS: readonly Grouping[] = ["day", "week", "month", "quarter", "year"];

interface TrailPart {
  name: string;
  href: string;
}

function trail(state: ViewState): { links: TrailPart[]; current: string } {
  const level = state.level;
  const names = [da.allSpending];
  if (level.kind !== "all") names.push(partName(level.mainGroup, "mainGroup"));
  if (level.kind === "category") names.push(partName(level.category, "category"));
  if (state.screen === "allPostings") names.push(da.allPostings);
  const current = names.pop() ?? da.allSpending;
  const links = names.map((name, depth) => ({ name, href: `#${toHash(trailLevel(state, depth as 0 | 1 | 2))}` }));
  return { links, current };
}

/** The trail and the three dropdowns. Fires `hs-period`, `hs-grouping` and `hs-accounts`. */
export class TopCard extends LitElement {
  static override properties = {
    state: { attribute: false },
    today: { attribute: false },
    accounts: { attribute: false },
  };

  declare state: ViewState;
  declare today: string;
  declare accounts: Account[] | null;

  constructor() {
    super();
    this.accounts = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private onGrouping(event: Event): void {
    const grouping = (event.target as HTMLSelectElement).value as Grouping;
    this.dispatchEvent(new CustomEvent<Grouping>("hs-grouping", { detail: grouping, bubbles: true }));
  }

  override render() {
    const { links, current } = trail(this.state);
    return html`<div class="card top-card">
      <nav class="top-trail" aria-label=${da.trail}>
        ${links.map((l) => html`<a href=${l.href}>${l.name}</a><span class="top-sep" aria-hidden="true">›</span>`)}
        <h1>${current}</h1>
      </nav>
      <div class="top-filters">
        <hs-period-picker .choice=${this.state.period} .today=${this.today}></hs-period-picker>
        <label class="field">
          <small>${da.groupBy}</small>
          <select .value=${live(this.state.grouping)} @change=${(e: Event) => this.onGrouping(e)}>
            ${GROUPINGS.map(
              (g) => html`<option value=${g} ?selected=${g === this.state.grouping}>${da.groupings[g].label}</option>`,
            )}
          </select>
        </label>
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
  .top-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
  }
`;

if (!customElements.get("hs-top-card")) customElements.define("hs-top-card", TopCard);

declare global {
  interface HTMLElementTagNameMap {
    "hs-top-card": TopCard;
  }
}
