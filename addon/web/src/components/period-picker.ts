import { PRESETS } from "@ha-spending/shared";
import { css, html, nothing, type PropertyDeclarations, type PropertyValues, unsafeCSS } from "lit";
import { live } from "lit/directives/live.js";
import { Calendar, months, type Options } from "vanilla-calendar-pro";
import layoutCss from "vanilla-calendar-pro/styles/layout.css?inline";
import monthsCss from "vanilla-calendar-pro/styles/months.css?inline";
import lightCss from "vanilla-calendar-pro/styles/themes/light.css?inline";
import { longDate, parseTypedDate, rangeText, typedDate } from "../format";
import { da } from "../i18n/da";
import { type PeriodChoice, periodOf } from "../state/view";
import { Dropdown } from "./dropdown";

const TWO_MONTHS = "(min-width: 600px)";
const FRAME_MARGIN = 8;
const YEARS_BEFORE_EARLIEST = 5;

/** `earliest` is undefined until the first answer, when "Alt"'s dates are not known yet. */
export function periodClosedText(choice: PeriodChoice, today: string, earliest: string | null | undefined): string {
  if (choice.preset === "all" && earliest === undefined) return da.presets.all;
  const label = choice.preset === "custom" ? da.customLabel : da.presets[choice.preset];
  return da.periodClosed(label, rangeText(periodOf(choice, today, earliest ?? null)));
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

function monthOf(date: string): number {
  return Number(date.slice(5, 7)) - 1;
}

/** The month `shift` months from the date's, as the calendar's 0-based month and its year. */
function monthFrom(date: string, shift: number): { month: number; year: number } {
  const index = yearOf(date) * 12 + monthOf(date) + shift;
  return { month: index % 12, year: Math.floor(index / 12) };
}

/** Fires `hs-period` with the chosen PeriodChoice. */
export class PeriodPicker extends Dropdown {
  static override properties: PropertyDeclarations = {
    choice: { attribute: false },
    today: { attribute: false },
    earliest: { attribute: false },
    fromText: { state: true },
    toText: { state: true },
  };

  declare choice: PeriodChoice;
  declare today: string;
  declare earliest: string | null | undefined;
  declare fromText: string;
  declare toText: string;

  private calendar: Calendar | null = null;
  private monthsShown = 1;

  constructor() {
    super();
    this.choice = { preset: "thisYear" };
    this.today = "";
    this.fromText = "";
    this.toText = "";
  }

  /** A redraw of the calendar removes the focused day and leaves focus nowhere; that is not leaving the menu. */
  protected override keepsOpenOn = (event: FocusEvent): boolean => event.relatedTarget === null;

  protected override toggle(): void {
    if (!this.open) {
      const period = periodOf(this.choice, this.today, this.earliest ?? null);
      this.fromText = typedDate(period.start);
      this.toText = typedDate(period.end);
    }
    super.toggle();
  }

  override disconnectedCallback(): void {
    this.destroyCalendar();
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (!changed.has("open")) return;
    if (this.open) {
      this.createCalendar();
      this.keepInFrame();
    } else {
      this.destroyCalendar();
    }
  }

  private get from(): string | null {
    return parseTypedDate(this.fromText);
  }

  private get to(): string | null {
    return parseTypedDate(this.toText);
  }

  private get customValid(): boolean {
    const { from, to } = this;
    return from !== null && to !== null && from <= to && to <= this.today;
  }

  private choose(choice: PeriodChoice): void {
    void this.close(true);
    this.dispatchEvent(new CustomEvent<PeriodChoice>("hs-period", { detail: choice, bubbles: true }));
  }

  /** The year list starts five years before the earliest posting's year, or earlier for an earlier picked date. */
  private firstYear(): number {
    const base = yearOf(this.earliest ?? this.today) - YEARS_BEFORE_EARLIEST;
    const picked = [this.from, this.to].filter((date): date is string => date !== null).map(yearOf);
    return Math.min(base, ...picked);
  }

  private selection(): string[] {
    const { from, to } = this;
    if (from === null || from > this.today) return [];
    if (to === null || to < from || to > this.today) return [from];
    return [`${from}:${to}`];
  }

  private bounds(): Pick<Options, "dateMin" | "displayDateMin"> {
    const first = `${String(this.firstYear()).padStart(4, "0")}-01-01` as const;
    return { dateMin: first as Options["dateMin"], displayDateMin: first as Options["displayDateMin"] };
  }

  private createCalendar(): void {
    const element = this.querySelector<HTMLElement>(".period-calendar > div");
    if (element === null) return;
    this.monthsShown = matchMedia(TWO_MONTHS).matches ? 2 : 1;
    const shown = monthFrom(this.to ?? this.today, 1 - this.monthsShown);
    this.calendar = new Calendar(element, {
      ...(this.monthsShown === 2 ? { type: "multiple", extensions: [months] } : { type: "default" }),
      displayMonthsCount: this.monthsShown as 1 | 2,
      monthsToSwitch: 1,
      selectionDatesMode: "multiple-ranged",
      enableDateToggle: false,
      locale: da.calendarLocale,
      labels: da.calendar,
      firstWeekday: 1,
      selectedTheme: "light",
      ...this.bounds(),
      // No displayDateMax: when it is before the wall clock, the library ignores selectedMonth.
      dateMax: this.today as Options["dateMax"],
      displayDatesOutside: false,
      selectedDates: this.selection(),
      selectedMonth: shown.month as Options["selectedMonth"],
      selectedYear: shown.year,
      onCreateDateEls: (_self, dateElement) => {
        const date = dateElement.dataset.vcDate;
        if (date !== undefined) dateElement.querySelector("button")?.setAttribute("aria-label", longDate(date));
      },
      onClickDate: (self) => this.picked(self.context.selectedDates),
    });
    this.calendar.init();
  }

  private destroyCalendar(): void {
    this.calendar?.destroy();
    this.calendar = null;
  }

  private picked(dates: readonly (string | undefined)[]): void {
    const days = dates.filter((date): date is string => typeof date === "string" && date !== "").sort();
    this.fromText = days.length > 0 ? typedDate(days[0]) : "";
    this.toText = days.length > 1 ? typedDate(days[days.length - 1]) : "";
  }

  /** Keeps the calendar's days in step with the fields, and moves it to a typed date: the start in the first month
   * shown, the end in the last. */
  private typed(field: "from" | "to", text: string): void {
    if (field === "from") this.fromText = text;
    else this.toText = text;
    if (this.calendar === null) return;
    const date = parseTypedDate(text);
    const move = date !== null && date <= this.today ? monthFrom(date, field === "from" ? 0 : 1 - this.monthsShown) : null;
    this.calendar.set({
      ...this.bounds(),
      selectedDates: this.selection(),
      ...(move === null
        ? {}
        : { selectedMonth: move.month as Options["selectedMonth"], selectedYear: move.year }),
    });
  }

  /** Shifts the open menu left as far as needed, and possible, to keep it inside the frame. */
  private keepInFrame(): void {
    const menu = this.querySelector<HTMLElement>(".period-menu");
    if (menu === null) return;
    menu.style.left = "";
    const rect = menu.getBoundingClientRect();
    const overflow = rect.right - (document.documentElement.clientWidth - FRAME_MARGIN);
    if (overflow <= 0) return;
    const shift = Math.min(overflow, Math.max(0, rect.left - FRAME_MARGIN));
    menu.style.left = `${-shift}px`;
  }

  private statusText(): string {
    const { from, to } = this;
    if (from === null) return "";
    return da.picked(longDate(from), to === null ? null : longDate(to));
  }

  override render() {
    const closed = periodClosedText(this.choice, this.today, this.earliest);
    return html`<div class="dd">
      <button
        class="field"
        type="button"
        aria-expanded=${this.open ? "true" : "false"}
        aria-label=${`${da.period} ${closed}`}
        @click=${() => this.toggle()}
      >
        <small>${da.period}</small><span>${closed}</span>
      </button>
      ${this.open
        ? html`<div class="dd-menu period-menu" tabindex="-1" role="group" aria-label=${da.period}>
            <div class="period-presets">
              ${PRESETS.map(
                (preset) =>
                  html`<button
                    class="dd-option"
                    type="button"
                    aria-pressed=${this.choice.preset === preset ? "true" : "false"}
                    @click=${() => this.choose({ preset })}
                  >
                    ${da.presets[preset]}
                  </button>`,
              )}
            </div>
            <div class="period-custom">
              <div class="period-dates">
                <label class="period-date"
                  ><small>${da.from}</small
                  ><input
                    type="text"
                    autocomplete="off"
                    placeholder=${da.datePlaceholder}
                    .value=${live(this.fromText)}
                    @input=${(e: Event) => this.typed("from", (e.target as HTMLInputElement).value)}
                /></label>
                <span class="period-dash" aria-hidden="true">–</span>
                <label class="period-date"
                  ><small>${da.to}</small
                  ><input
                    type="text"
                    autocomplete="off"
                    placeholder=${da.datePlaceholder}
                    .value=${live(this.toText)}
                    @input=${(e: Event) => this.typed("to", (e.target as HTMLInputElement).value)}
                /></label>
              </div>
              <div class="period-calendar"><div></div></div>
              <div class="visually-hidden" role="status">${this.statusText()}</div>
              <button
                class="period-show"
                type="button"
                ?disabled=${!this.customValid}
                @click=${() => {
                  const { from, to } = this;
                  if (from !== null && to !== null) this.choose({ preset: "custom", start: from, end: to });
                }}
              >
                ${da.show}
              </button>
            </div>
          </div>`
        : nothing}
    </div>`;
  }
}

/** The library's own light theme, then the page's colours over it. */
export const calendarStyles = [
  unsafeCSS(layoutCss),
  unsafeCSS(monthsCss),
  unsafeCSS(lightCss),
  css`
    .period-calendar {
      --vc-bg: transparent;
      --vc-color: var(--hs-text);
      --vc-header-color: var(--hs-text);
      --vc-title-color: var(--hs-text);
      --vc-title-color-hover: var(--hs-accent-text);
      --vc-title-color-disabled: var(--hs-leader);
      --vc-focus-outline-color: var(--hs-accent-text);
      --vc-week-day-color: var(--hs-muted);
      --vc-week-day-color-hover: var(--hs-text);
      --vc-week-day-off-color: var(--hs-muted);
      --vc-week-day-off-color-hover: var(--hs-text);
      --vc-date-bg: transparent;
      --vc-date-color: var(--hs-text);
      --vc-date-weekend-color: var(--hs-text);
      --vc-date-bg-hover: var(--hs-soft);
      --vc-date-weekend-bg-hover: var(--hs-soft);
      --vc-date-hover-bg: var(--hs-soft);
      --vc-date-weekend-hover-bg: var(--hs-soft);
      --vc-date-hover-edge-bg: var(--hs-chip-x);
      --vc-date-weekend-hover-edge-bg: var(--hs-chip-x);
      --vc-date-disabled-color: var(--hs-leader);
      --vc-date-weekend-disabled-color: var(--hs-leader);
      --vc-date-weekend-disabled-outside-color: var(--hs-leader);
      --vc-date-today-bg: transparent;
      --vc-date-today-color: var(--hs-accent-text);
      --vc-date-weekend-today-color: var(--hs-accent-text);
      --vc-date-weekend-today-disabled-color: var(--hs-leader);
      --vc-date-today-outside-color: var(--hs-muted);
      --vc-date-weekend-today-outside-color: var(--hs-muted);
      --vc-date-outside-color: var(--hs-muted);
      --vc-date-weekend-outside-color: var(--hs-muted);
      --vc-date-weekend-outside-bg: transparent;
      --vc-date-weekend-outside-bg-hover: var(--hs-soft);
      --vc-date-weekend-outside-hover-bg: var(--hs-soft);
      --vc-date-selected-bg: var(--hs-accent);
      --vc-date-selected-color: #fff;
      --vc-date-weekend-selected-bg: var(--hs-accent);
      --vc-date-weekend-selected-color: #fff;
      --vc-date-selected-outside-bg: var(--hs-accent-soft);
      --vc-date-selected-outside-color: var(--hs-muted);
      --vc-date-range-middle-bg: var(--hs-accent-soft);
      --vc-date-range-middle-color: var(--hs-text);
      --vc-date-range-middle-weekend-bg: var(--hs-accent-soft);
      --vc-date-range-middle-weekend-color: var(--hs-text);
      --vc-date-range-middle-outside-bg: var(--hs-accent-soft);
      --vc-date-range-middle-outside-color: var(--hs-muted);
      --vc-date-popup-bg: var(--hs-card);
      --vc-date-popup-color: var(--hs-text);
      --vc-date-range-tooltip-bg: var(--hs-card);
      --vc-date-range-tooltip-color: var(--hs-muted);
      --vc-months-years-bg: transparent;
      --vc-months-years-color: var(--hs-text);
      --vc-months-years-bg-hover: var(--hs-soft);
      --vc-months-years-bg-selected: var(--hs-accent);
      --vc-months-years-color-selected: #fff;
      --vc-months-years-color-disabled: var(--hs-leader);
    }
    .period-calendar .vc {
      padding: 4px 0 0;
      font: inherit;
    }
  `,
];

export const periodPickerStyles = css`
  .dd-menu.period-menu {
    flex-direction: row;
    padding: 0;
    width: max-content;
    max-width: calc(100vw - ${FRAME_MARGIN * 2}px);
  }
  .period-presets {
    display: flex;
    flex-direction: column;
    padding: 6px 0;
    border-right: 1px solid var(--hs-line);
  }
  .period-custom {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .period-dates {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .period-dash {
    color: var(--hs-muted);
  }
  .period-date {
    border: 1px solid var(--hs-field);
    border-radius: 6px;
    padding: 5px 10px;
    display: flex;
    flex-direction: column;
    width: 120px;
  }
  .period-date:focus-within {
    border-color: var(--hs-accent);
  }
  .period-date small {
    color: var(--hs-muted);
    font-size: 11px;
  }
  .period-date input {
    border: 0;
    padding: 0;
    font: inherit;
    color: var(--hs-text);
    background: none;
    outline: none;
    min-width: 0;
  }
  .period-show {
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
  .period-show:disabled {
    background: var(--hs-field);
    cursor: default;
  }
  @media (max-width: 599px) {
    .dd-menu.period-menu {
      flex-direction: column;
    }
    .period-presets {
      border-right: 0;
      border-bottom: 1px solid var(--hs-line);
    }
  }
`;

if (!customElements.get("hs-period-picker")) customElements.define("hs-period-picker", PeriodPicker);

declare global {
  interface HTMLElementTagNameMap {
    "hs-period-picker": PeriodPicker;
  }
}
