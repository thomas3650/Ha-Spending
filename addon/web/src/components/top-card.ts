import type { Account } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import { da } from "../i18n/da";
import type { LevelRow } from "../model/circle";
import { partName } from "../model/context";
import type { ObjectGroupRow, ObjectGroupStep } from "../model/fixed";
import { clearChoices, keepDetail } from "../state/actions";
import { toHash, type ViewState } from "../state/view";
import { fire } from "./chip";
import "./accounts-picker";
import { LevelMenu } from "./level-menu";
import "./object-group-menu";
import "./period-picker";
import { type UnitMenu, type UnitStep } from "./unit-menu";
import "./unit-menu";

/** What `set-category` fires: a category keeps its main group. */
export interface CategoryChoice {
  mainGroup: string | null;
  category: string | null;
}

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
 * The trail and Konti. The trail is the top filter: "Alt forbrug", the period, the unit, the main group and the
 * category, then a dashed button for the next level. Fires `hs-period`, `hs-accounts`, `set-unit` with a unit's
 * `fullStart`, `set-main-group`, `set-category`, and from the trail's × `remove-unit`, `remove-main-group` and
 * `remove-category`. In the fixed-expenses view the trail has the object group after "Alt forbrug", which fires
 * `set-object-group` (null is Alle). The Til overs view's trail is "Alt forbrug", "Til overs" and the period, then the
 * unit word and Hovedgruppe greyed, with Konti greyed. In both views "Alt forbrug" is a link to `leaveHref` whose plain
 * click fires `leave`.
 */
export class TopCard extends LitElement {
  static override properties = {
    state: { attribute: false },
    today: { attribute: false },
    accounts: { attribute: false },
    earliest: { attribute: false },
    unitStep: { attribute: false },
    lists: { attribute: false },
    fixed: { attribute: false },
    leftOver: { attribute: false },
    objectGroups: { attribute: false },
    objectGroupStep: { attribute: false },
    leaveHref: { attribute: false },
  };

  declare state: ViewState;
  declare today: string;
  declare accounts: Account[] | null;
  declare earliest: string | null | undefined;
  /** null where the bars are not buttons, so there is no unit to choose. */
  declare unitStep: UnitStep | null;
  declare lists: LevelLists | null;
  /** The fixed-expenses view's trail. */
  declare fixed: boolean;
  /** The Til overs view's trail: it covers every month of the period over all accounts (spec §4.1). */
  declare leftOver: boolean;
  /** The object-group step's rows, Alle last; null while the answer loads and on an error. */
  declare objectGroups: ObjectGroupRow[] | null;
  declare objectGroupStep: ObjectGroupStep;
  /** Where "Alt forbrug" leads in a view: a new tab or a copied link lands on the overview. */
  declare leaveHref: string;

  constructor() {
    super();
    this.accounts = null;
    this.unitStep = null;
    this.lists = null;
    this.fixed = false;
    this.leftOver = false;
    this.objectGroups = null;
    this.objectGroupStep = { title: "", single: false };
    this.leaveHref = "#";
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** The heading may sit in a step's own element, so a focus after an update waits for the steps too. */
  protected override async getUpdateComplete(): Promise<boolean> {
    const done = await super.getUpdateComplete();
    const steps = [...this.querySelectorAll<LitElement>("hs-period-picker, hs-object-group-menu, hs-unit-menu, hs-level-menu")];
    await Promise.all(steps.map((step) => step.updateComplete));
    return done;
  }

  /** Focuses the button of the step a choice from a dashed list has just made; it is a new element, not the list's own. */
  focusStep(step: "unit" | "mainGroup" | "category"): void {
    const menus = [...this.querySelectorAll<LevelMenu | UnitMenu>(step === "unit" ? "hs-unit-menu" : "hs-level-menu")];
    const menu = menus.find((m) => !(m instanceof LevelMenu) || m.level === step);
    menu?.querySelector<HTMLElement>("button.trail-dd")?.focus();
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

  /** A click with a modifier or another button follows the href, so a new tab opens on the overview. */
  private leave() {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      fire(this, "leave");
    };
    return html`<a href=${this.leaveHref} @click=${onClick}>${da.allSpending}</a>`;
  }

  private trail() {
    if (this.leftOver) {
      const note = da.leftOver.wholePeriodNote;
      const unit = this.unitStep === null ? nothing : html` <hs-unit-menu .step=${this.unitStep} .greyed=${note}></hs-unit-menu>`;
      return html`${this.leave()}${SEP}<span>${da.leftOver.name}</span>${SEP}${this.period(true)}${unit}
        <hs-level-menu .level=${"mainGroup"} .name=${null} .greyed=${note}></hs-level-menu>`;
    }
    const state = this.state;
    const level = state.level;
    const unit = this.unitStep?.chosen ?? null;
    const mainGroup = level.kind === "all" ? undefined : level.mainGroup;
    const category = level.kind === "category" ? level.category : undefined;
    const last: Last =
      category !== undefined ? "category" : mainGroup !== undefined ? "mainGroup" : unit !== null ? "unit" : "period";
    const root = this.fixed
      ? this.leave()
      : last === "period"
        ? html`<span>${da.allSpending}</span>`
        : this.home(clearChoices(state));
    const unitStep = this.unit(last === "unit");
    const mainGroupStep =
      mainGroup === undefined ? nothing : html`${SEP}${this.levelStep("mainGroup", mainGroup, last === "mainGroup")}`;
    const categoryStep = category === undefined ? nothing : html`${SEP}${this.levelStep("category", category, true)}`;
    const next = category === undefined ? this.dashed(mainGroup === undefined ? "mainGroup" : "category") : nothing;
    const objectGroup = this.fixed ? html`${SEP}${this.objectGroup()}` : nothing;
    return html`${root}${objectGroup}${SEP}${this.period(last === "period")}${unitStep}${mainGroupStep}${categoryStep}
    ${next}`;
  }

  private objectGroup() {
    const step = this.objectGroupStep;
    if (step.single) return html`<span>${step.title}</span>`;
    return html`<hs-object-group-menu
      .rows=${this.objectGroups}
      .name=${step.title}
      @object-group-choose=${(e: CustomEvent<string | null>) => fire(this, "set-object-group", e.detail)}
    ></hs-object-group-menu>`;
  }

  /** The dashed button sits right after the period, before the "›" to the main group (spec §3.2). */
  private unit(last: boolean) {
    const step = this.unitStep;
    if (step === null) return nothing;
    const menu = html`<hs-unit-menu
      .step=${step}
      .heading=${last}
      @unit-choose=${(e: CustomEvent<string>) => fire(this, "set-unit", e.detail)}
    ></hs-unit-menu>`;
    if (step.chosen === null) return html` ${menu}`;
    return html`${SEP}<div class="trail-step">${menu}${this.x(step.chosen, "remove-unit")}</div>`;
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
        <hs-accounts-picker
          .accounts=${this.accounts}
          .chosen=${this.state.accounts}
          .greyed=${this.leftOver ? da.leftOver.allAccountsNote : null}
        ></hs-accounts-picker>
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
  .top-card [aria-disabled="true"],
  .top-card [aria-disabled="true"] small {
    color: var(--hs-muted);
    cursor: default;
  }
  .trail-add[aria-disabled="true"],
  .trail-add[aria-disabled="true"]:hover {
    color: var(--hs-leader);
    border-color: var(--hs-leader);
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
