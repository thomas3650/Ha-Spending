import { css, html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { live } from "lit/directives/live.js";
import { parseDanishAmount } from "../format";
import { da } from "../i18n/da";
import { type AmountFilter, type AmountKind, amountText, sameAmount } from "../model/amount";
import { fire } from "./chip";
import { Dropdown } from "./dropdown";

const KINDS: AmountKind[] = ["about", "under", "over", "between"];

const SYMBOLS: Record<AmountKind, string> = { about: "≈", under: "<", over: ">", between: "↔" };

let instances = 0;

type Bound = "first" | "second";

/** What the fields hold: a filter, null to clear, or nothing to apply yet. */
type Reading = { filter: AmountFilter | null } | { invalid: true } | { missing: Bound };

/**
 * The quick filter's Beløb pill (top-filter spec §4.2). It keeps its own kind and typed text until it applies them,
 * and fires `amount-change` with an `AmountFilter` or null once per apply, switch of an applied kind or ×.
 */
export class AmountPill extends Dropdown {
  static override properties: PropertyDeclarations = {
    amount: { attribute: false },
    kind: { state: true },
    first: { state: true },
    second: { state: true },
    invalid: { state: true },
  };

  declare amount: AmountFilter | null;
  declare private kind: AmountKind | null;
  /** The typed number, or Mellem's first bound. */
  declare private first: string;
  declare private second: string;
  declare private invalid: boolean;

  /** What the pill last fired or was given, so applying the same filter twice fires once. */
  private applied: AmountFilter | null = null;
  /** True while a choice re-renders the pill and moves the focus inside it; the focus leaving then is not a leave. */
  private moving = false;
  private readonly idBase = `hs-amount-${++instances}`;

  constructor() {
    super();
    this.amount = null;
    this.kind = null;
    this.first = "";
    this.second = "";
    this.invalid = false;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("amount") && !sameAmount(this.amount, this.applied)) {
      this.applied = this.amount;
      this.show(this.amount);
      this.open = false;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("focusout", this.onLeave);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("focusout", this.onLeave);
    super.disconnectedCallback();
  }

  private readonly onLeave = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (this.moving || (next instanceof Node && this.contains(next))) return;
    this.apply(false);
  };

  /** Escape's close moves the focus from a removed option to the opener, inside the pill. */
  protected override async close(focus: boolean): Promise<void> {
    if (!focus) return super.close(false);
    this.moving = true;
    await super.close(true);
    this.moving = false;
  }

  private show(filter: AmountFilter | null): void {
    this.kind = filter?.kind ?? null;
    this.first = filter === null ? "" : amountText(filter.kind === "between" ? filter.min : filter.value);
    this.second = filter?.kind === "between" ? amountText(filter.max) : "";
    this.invalid = false;
  }

  private read(kind: AmountKind): Reading {
    const text = (t: string) => (t.trim() === "" ? null : parseDanishAmount(t));
    const a = text(this.first);
    const b = text(this.second);
    if ((this.first.trim() !== "" && a === null) || (kind === "between" && this.second.trim() !== "" && b === null)) {
      return { invalid: true };
    }
    if (kind !== "between") return { filter: a === null ? null : { kind, value: a } };
    if (a === null && b === null) return { filter: null };
    if (a === null) return { missing: "first" };
    if (b === null) return { missing: "second" };
    return { filter: { kind, min: Math.min(a, b), max: Math.max(a, b) } };
  }

  private change(filter: AmountFilter | null): void {
    if (sameAmount(filter, this.applied)) return;
    this.applied = filter;
    fire(this, "amount-change", filter);
  }

  /** On Enter (`keep` the focus in the pill) or when the focus leaves it. */
  private apply(keep: boolean): void {
    if (this.kind === null) return;
    const reading = this.read(this.kind);
    if ("invalid" in reading) {
      this.invalid = true;
      return;
    }
    if ("missing" in reading) {
      // A half-typed Mellem left behind would show a filter the list does not use.
      if (keep) void this.focusField(reading.missing);
      else this.show(this.applied);
      return;
    }
    this.change(reading.filter);
    this.show(reading.filter);
    if (keep && reading.filter === null) void this.focusOpener();
  }

  private async choose(kind: AmountKind): Promise<void> {
    this.moving = true;
    this.open = false;
    if (kind !== this.kind) {
      if (kind === "between" || this.kind === "between") this.second = "";
      this.kind = kind;
      this.invalid = false;
      const reading = this.read(kind);
      if (this.applied !== null && "filter" in reading && reading.filter !== null) this.change(reading.filter);
    }
    await this.focusField(kind === "between" && this.first.trim() !== "" ? "second" : "first");
    this.moving = false;
  }

  private async clear(): Promise<void> {
    this.moving = true;
    this.change(null);
    this.show(null);
    this.open = false;
    await this.focusOpener();
    this.moving = false;
  }

  private async focusField(bound: Bound): Promise<void> {
    await this.updateComplete;
    this.querySelectorAll<HTMLInputElement>(".amount-number")[bound === "first" ? 0 : 1]?.focus();
  }

  private async focusOpener(): Promise<void> {
    await this.updateComplete;
    this.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
  }

  private typed(bound: Bound, text: string): void {
    this[bound] = text;
    this.invalid = false;
  }

  private onEnter(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    this.apply(true);
  }

  private number(bound: Bound, label: string) {
    const error = `${this.idBase}-invalid`;
    return html`<input
      class="amount-number"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      aria-label=${label}
      aria-invalid=${this.invalid ? "true" : nothing}
      aria-describedby=${this.invalid ? error : nothing}
      .value=${live(this[bound])}
      @input=${(e: Event) => this.typed(bound, (e.target as HTMLInputElement).value)}
      @keydown=${this.onEnter}
    />`;
  }

  private menu() {
    if (!this.open) return nothing;
    return html`<div class="dd-menu dd-end amount-menu" tabindex="-1" role="group" aria-label=${da.amountKindsLabel}>
      ${KINDS.map((kind) => {
        const hint: string | undefined = (da.amountHints as Partial<Record<AmountKind, string>>)[kind];
        const hintId = `${this.idBase}-${kind}-hint`;
        return html`<button
          type="button"
          class="amount-option"
          aria-label=${da.amountKinds[kind]}
          aria-describedby=${hint === undefined ? nothing : hintId}
          aria-pressed=${String(kind === this.kind)}
          @click=${() => void this.choose(kind)}
        >
          <span class="amount-symbol" aria-hidden="true">${SYMBOLS[kind]}</span>
          <span
            >${da.amountKinds[kind]}${hint === undefined
              ? nothing
              : html`<small id=${hintId} class="amount-hint">${hint}</small>`}</span
          >
        </button>`;
      })}
    </div>`;
  }

  private pill(kind: AmountKind) {
    return html`<div class="amount-pill" role="group" aria-label=${da.amountName(this.applied)}>
      <button
        type="button"
        class="amount-kind"
        aria-label=${da.amountKindButton}
        aria-haspopup="true"
        aria-expanded=${this.open ? "true" : "false"}
        @click=${() => this.toggle()}
      >
        <span aria-hidden="true">${SYMBOLS[kind]}</span>
      </button>
      ${kind === "between"
        ? html`${this.number("first", da.amountMin)}<span class="amount-dash" aria-hidden="true">–</span>${this.number(
              "second",
              da.amountMax,
            )}`
        : this.number("first", da.amountKinds[kind])}
      <span class="amount-kr">${da.kr}</span>
      <button type="button" class="amount-x" aria-label=${da.removeAmount} @click=${() => void this.clear()}>
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
          <path d="M2 2 8 8M8 2 2 8" />
        </svg>
      </button>
    </div>`;
  }

  override render() {
    const kind = this.kind;
    return html`<div class="dd">
      ${kind === null
        ? html`<button
            type="button"
            class="amount-pill amount-empty"
            aria-label=${da.amountName(null)}
            aria-haspopup="true"
            aria-expanded=${this.open ? "true" : "false"}
            @click=${() => this.toggle()}
          >
            <span aria-hidden="true">${da.kr}</span> ${da.amountEmpty}
          </button>`
        : this.pill(kind)}
      ${this.menu()}
      ${this.invalid ? html`<p id="${this.idBase}-invalid" class="amount-error">${da.amountInvalid}</p>` : nothing}
    </div>`;
  }
}

/** The pill renders into its host's tree, so the host adds these beside `dropdownStyles`. */
export const amountPillStyles = css`
  hs-amount-pill {
    flex: none;
  }
  .amount-pill {
    box-sizing: border-box;
    height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px 0 4px;
    border: 1px solid var(--hs-chip-x);
    border-radius: 18px;
    background: var(--hs-accent-soft);
    color: var(--hs-text);
    font: inherit;
  }
  .amount-pill:focus-within {
    border-color: var(--hs-accent);
  }
  .amount-empty {
    padding: 0 14px;
    gap: 4px;
    border: 1px dashed var(--hs-field);
    background: var(--hs-card);
    color: var(--hs-muted);
    cursor: pointer;
  }
  .amount-empty:hover,
  .amount-empty[aria-expanded="true"] {
    border-color: var(--hs-accent);
    color: var(--hs-accent-text);
  }
  .amount-empty:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
  .amount-kind {
    display: inline-grid;
    place-items: center;
    min-width: 26px;
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: 13px;
    background: var(--hs-accent-text);
    color: var(--hs-card);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .amount-kind:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
  .amount-number {
    width: 7ch;
    min-width: 3ch;
    padding: 0;
    border: 0;
    background: none;
    color: var(--hs-text);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
    outline: none;
  }
  @supports (field-sizing: content) {
    .amount-number {
      width: auto;
      max-width: 14ch;
      field-sizing: content;
    }
  }
  .amount-number[aria-invalid="true"] {
    color: var(--hs-up);
  }
  .amount-kr,
  .amount-dash {
    color: var(--hs-muted);
  }
  .amount-x {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--hs-muted);
    cursor: pointer;
  }
  .amount-x svg {
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  .amount-x:hover,
  .amount-x:focus-visible {
    background: var(--hs-chip-x);
    color: var(--hs-accent-text);
    outline: none;
  }
  .dd-menu.amount-menu {
    width: 230px;
    padding: 6px;
  }
  .amount-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--hs-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .amount-option:hover,
  .amount-option:focus-visible {
    background: var(--hs-soft);
    outline: none;
  }
  .amount-option[aria-pressed="true"] {
    background: var(--hs-accent-soft);
  }
  .amount-symbol {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--hs-expected-soft);
    font-weight: 600;
  }
  .amount-option[aria-pressed="true"] .amount-symbol {
    background: var(--hs-accent-text);
    color: var(--hs-card);
  }
  .amount-hint {
    display: block;
    color: var(--hs-muted);
    font-size: 11px;
  }
  .amount-error {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    margin: 0;
    white-space: nowrap;
    color: var(--hs-up);
    font-size: 12px;
  }
`;

if (!customElements.get("hs-amount-pill")) customElements.define("hs-amount-pill", AmountPill);

declare global {
  interface HTMLElementTagNameMap {
    "hs-amount-pill": AmountPill;
  }
}
