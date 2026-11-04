import type { Account } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import { da } from "../i18n/da";
import type { LevelRow } from "../model/circle";
import { partName } from "../model/context";
import { backToOverview, clearChoices, keepDetail } from "../state/actions";
import { toHash, type ViewState } from "../state/view";
import { fire } from "./chip";
import "./accounts-picker";
import "./level-menu";
import "./period-picker";

/** The rows of the trail's two lists; null while the answer loads and on an error. */
export interface LevelLists {
  mainGroup: LevelRow[];
  category: LevelRow[];
}

const SEP = html` <span class="top-sep" aria-hidden="true">›</span> `;

const X = html`<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
  <path d="M1 1 9 9M9 1 1 9" />
</svg>`;

type Last = "period" | "unit" | "mainGroup" | "category";

/**
 * The trail and Konti. The trail is the top filter: "Alt forbrug", the period, the chosen unit, the main group and the
 * category, then a dashed button for the next level. Fires `hs-period`, `hs-accounts`, `set-main-group`,
 * `set-category`, and from the trail's × `remove-unit`, `remove-main-group` and `remove-category`.
 */
export class TopCard extends LitElement {
  static override properties = {
    state: { attribute: false },
    today: { attribute: false },
    accounts: { attribute: false },
    earliest: { attribute: false },
    unitName: { attribute: false },
    lists: { attribute: false },
  };

  declare state: ViewState;
  declare today: string;
  declare accounts: Account[] | null;
  declare earliest: string | null | undefined;
  /** The chosen unit's name, null while the answer loads or with no unit: the answer decides which units exist. */
  declare unitName: string | null;
  declare lists: LevelLists | null;

  constructor() {
    super();
    this.accounts = null;
    this.unitName = null;
    this.lists = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** The heading may sit in a step's own element, so a focus after an update waits for the steps too. */
  protected override async getUpdateComplete(): Promise<boolean> {
    const done = await super.getUpdateComplete();
    const steps = [...this.querySelectorAll<LitElement>("hs-period-picker, hs-level-menu")];
    await Promise.all(steps.map((step) => step.updateComplete));
    return done;
  }

  private period(heading: boolean) {
    return html`<hs-period-picker
      .choice=${this.state.period}
      .today=${this.today}
      .earliest=${this.earliest}
      .heading=${heading}
    ></hs-period-picker>`;
  }

  private home(next: ViewState) {
    return html`<a href=${`#${toHash(keepDetail(this.state, next))}`}>${da.allSpending}</a>`;
  }

  private trail() {
    const state = this.state;
    if (state.screen === "allPostings") {
      return html`${this.home(backToOverview(state))}${SEP}${this.period(false)}${SEP}<h1 tabindex="-1">${da.allPostings}</h1>`;
    }
    const level = state.level;
    const unit = this.unitName;
    const mainGroup = level.kind === "all" ? undefined : level.mainGroup;
    const category = level.kind === "category" ? level.category : undefined;
    const last: Last =
      category !== undefined ? "category" : mainGroup !== undefined ? "mainGroup" : unit !== null ? "unit" : "period";
    const root = last === "period" ? html`<span>${da.allSpending}</span>` : this.home(clearChoices(state));
    const unitStep = unit === null ? nothing : html`${SEP}${this.unitStep(unit, last === "unit")}`;
    const mainGroupStep =
      mainGroup === undefined ? nothing : html`${SEP}${this.levelStep("mainGroup", mainGroup, last === "mainGroup")}`;
    const categoryStep = category === undefined ? nothing : html`${SEP}${this.levelStep("category", category, true)}`;
    const next = category === undefined ? this.dashed(mainGroup === undefined ? "mainGroup" : "category") : nothing;
    return html`${root}${SEP}${this.period(last === "period")}${unitStep}${mainGroupStep}${categoryStep} ${next}`;
  }

  private unitStep(name: string, last: boolean) {
    return html`<div class="trail-step">
      ${last ? html`<h1 tabindex="-1">${name}</h1>` : html`<span>${name}</span>`}${this.x(name, "remove-unit")}
    </div>`;
  }

  private levelStep(of: "mainGroup" | "category", key: string | null, last: boolean) {
    const name = partName(key, of);
    return html`<div class="trail-step">
      <hs-level-menu
        .level=${of}
        .rows=${this.lists?.[of] ?? null}
        .name=${name}
        .heading=${last}
        @level-choose=${(e: CustomEvent<string | null>) => this.choose(of, e.detail)}
      ></hs-level-menu
      >${this.x(name, of === "mainGroup" ? "remove-main-group" : "remove-category")}
    </div>`;
  }

  private dashed(of: "mainGroup" | "category") {
    return html`<hs-level-menu
      .level=${of}
      .rows=${this.lists?.[of] ?? null}
      .name=${null}
      .heading=${false}
      @level-choose=${(e: CustomEvent<string | null>) => this.choose(of, e.detail)}
    ></hs-level-menu>`;
  }

  private choose(of: "mainGroup" | "category", key: string | null): void {
    const level = this.state.level;
    if (of === "mainGroup") fire(this, "set-main-group", key);
    else if (level.kind !== "all") fire(this, "set-category", { mainGroup: level.mainGroup, category: key });
  }

  /** The × sits beside its step in one unbreakable box, so a wrap never parts them. */
  private x(name: string, remove: string) {
    const label = da.remove(name);
    return html`<button type="button" class="trail-x" aria-label=${label} title=${label} @click=${() => fire(this, remove)}>
      ${X}
    </button>`;
  }

  override render() {
    return html`<div class="card top-card">
      <nav class="top-trail" aria-label=${da.trail}>${this.trail()}</nav>
      <div class="top-filters">
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
    align-items: center;
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
  .top-trail .dd-menu {
    font-size: 14px;
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
  .trail-dd,
  .trail-add {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: 6px;
    font: inherit;
    cursor: pointer;
  }
  .trail-dd {
    border: 1px solid var(--hs-field);
    color: var(--hs-text);
    background: var(--hs-soft);
  }
  .trail-add {
    border: 1px dashed var(--hs-field);
    color: var(--hs-muted);
    background: transparent;
    font-size: 13px;
    font-weight: 400;
  }
  .trail-dd:hover,
  .trail-add:hover:enabled {
    border-color: var(--hs-accent);
  }
  .trail-dd[aria-expanded="true"] {
    border-color: var(--hs-accent);
    box-shadow: 0 0 0 1px var(--hs-accent);
  }
  .trail-dd:focus-visible,
  .trail-add:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 1px;
  }
  .trail-dd:disabled,
  .trail-add:disabled {
    cursor: default;
  }
  .trail-add:disabled {
    color: var(--hs-leader);
  }
  .trail-dd:disabled .trail-caret {
    stroke: var(--hs-leader);
  }
  .trail-caret {
    flex: none;
    fill: none;
    stroke: var(--hs-muted);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
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
`;

if (!customElements.get("hs-top-card")) customElements.define("hs-top-card", TopCard);

declare global {
  interface HTMLElementTagNameMap {
    "hs-top-card": TopCard;
  }
}
