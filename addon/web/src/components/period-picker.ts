import { isDate, PRESETS } from "@ha-spending/shared";
import { css, html, nothing, type PropertyDeclarations } from "lit";
import { live } from "lit/directives/live.js";
import { rangeText } from "../format";
import { da } from "../i18n/da";
import { type PeriodChoice, periodOf } from "../state/view";
import { Dropdown } from "./dropdown";

export function periodClosedText(choice: PeriodChoice, today: string): string {
  const label = choice.preset === "custom" ? da.customLabel : da.presets[choice.preset];
  return da.periodClosed(label, rangeText(periodOf(choice, today)));
}

/** Fires `hs-period` with the chosen PeriodChoice. */
export class PeriodPicker extends Dropdown {
  static override properties: PropertyDeclarations = {
    choice: { attribute: false },
    today: { attribute: false },
    from: { state: true },
    to: { state: true },
  };

  declare choice: PeriodChoice;
  declare today: string;
  declare from: string;
  declare to: string;

  constructor() {
    super();
    this.choice = { preset: "thisYear" };
    this.today = "";
    this.from = "";
    this.to = "";
  }

  protected override toggle(): void {
    if (!this.open) {
      const period = periodOf(this.choice, this.today);
      this.from = period.start;
      this.to = period.end;
    }
    super.toggle();
  }

  private choose(choice: PeriodChoice): void {
    void this.close(true);
    this.dispatchEvent(new CustomEvent<PeriodChoice>("hs-period", { detail: choice, bubbles: true }));
  }

  private get customValid(): boolean {
    return isDate(this.from) && isDate(this.to) && this.from <= this.to;
  }

  override render() {
    const closed = periodClosedText(this.choice, this.today);
    return html`<div class="dd">
      <button
        class="sel"
        type="button"
        aria-expanded=${this.open ? "true" : "false"}
        aria-label=${`${da.period} ${closed}`}
        @click=${() => this.toggle()}
      >
        <small>${da.period}</small><span>${closed}</span>
      </button>
      ${this.open
        ? html`<div class="menu" role="group" aria-label=${da.period}>
            ${PRESETS.map(
              (preset) =>
                html`<button
                  class="o"
                  type="button"
                  aria-pressed=${this.choice.preset === preset ? "true" : "false"}
                  @click=${() => this.choose({ preset })}
                >
                  ${da.presets[preset]}
                </button>`,
            )}
            <hr />
            <div class="custom">
              <span>${da.custom}</span>
              <div class="dates">
                <label class="date"
                  ><small>${da.from}</small
                  ><input
                    type="date"
                    .value=${live(this.from)}
                    @input=${(e: Event) => (this.from = (e.target as HTMLInputElement).value)}
                /></label>
                <label class="date"
                  ><small>${da.to}</small
                  ><input
                    type="date"
                    .value=${live(this.to)}
                    @input=${(e: Event) => (this.to = (e.target as HTMLInputElement).value)}
                /></label>
              </div>
              <button
                class="btn"
                type="button"
                ?disabled=${!this.customValid}
                @click=${() => this.choose({ preset: "custom", start: this.from, end: this.to })}
              >
                ${da.show}
              </button>
            </div>
          </div>`
        : nothing}
    </div>`;
  }
}

export const periodPickerStyles = css`
  .custom {
    padding: 8px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dates {
    display: flex;
    gap: 8px;
  }
  .date {
    border: 1px solid var(--hs-field);
    border-radius: 6px;
    padding: 5px 10px;
    display: flex;
    flex-direction: column;
    min-width: 130px;
  }
  .date small {
    color: var(--hs-muted);
    font-size: 11px;
  }
  .date input {
    border: 0;
    padding: 0;
    font: inherit;
    color: var(--hs-text);
    background: none;
  }
  .btn {
    align-self: flex-end;
    background: var(--hs-accent);
    color: #fff;
    border: 0;
    border-radius: 16px;
    padding: 6px 16px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .btn:disabled {
    background: var(--hs-field);
    cursor: default;
  }
`;

if (!customElements.get("hs-period-picker")) customElements.define("hs-period-picker", PeriodPicker);

declare global {
  interface HTMLElementTagNameMap {
    "hs-period-picker": PeriodPicker;
  }
}
