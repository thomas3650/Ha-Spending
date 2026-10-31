import type { Unit } from "@ha-spending/shared";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { type Chart, createChart, type EChartsCoreOption } from "../charts/echarts";
import { axisKr, kr, rangeText } from "../format";
import { da } from "../i18n/da";
import { visuallyHidden } from "../theme";

export interface BarItem {
  unit: Unit;
  axis: string;
  name: string;
  amount: number;
  /** Runs on today; a unit after today is an empty slot. */
  running: boolean;
}

export function isRunning(unit: Unit, today: string): boolean {
  return unit.partial && unit.fullStart <= today;
}

export interface BarsAverage {
  amount: number;
  label: string;
}

export interface UnitSelection {
  fullStart: string;
}

const RUNNING = 0.5;
const FADED = 0.3;
/** About the width of one character of an 11 px axis label, and the gap between two labels. */
const LABEL_CHAR = 6;
const LABEL_GAP = 8;
/** About the y-axis labels and the grid's sides. */
const PLOT_INSET = 110;
/** The room on the right of the plot for the average line's label. */
const AVERAGE_ROOM = 72;
const FOCUS_SHADE = 0.3;

/**
 * With many bars only every few gets a label, so the texts never run together. The running unit always keeps its
 * "i gang", and a label too close to it gives way.
 */
export function axisLabelShown(index: number, count: number, running: number, most: number): boolean {
  const step = Math.ceil(count / Math.max(1, most));
  if (index === running) return true;
  return index % step === 0 && (running < 0 || Math.abs(index - running) >= step);
}

/** A darker shade of a #rrggbb colour, for the focused bar. */
function shade(colour: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(colour);
  if (!m) return colour;
  const n = Number.parseInt(m[1], 16);
  const part = (shift: number) => Math.round(((n >> shift) & 0xff) * (1 - FOCUS_SHADE));
  return `#${[16, 8, 0].map((s) => part(s).toString(16).padStart(2, "0")).join("")}`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function buttonName(item: BarItem): string {
  const name = item.running ? `${item.name} (${da.inProgress})` : item.name;
  return `${name}, ${kr(item.amount)}`;
}

/**
 * One bar per unit, drawn by ECharts and named by a hidden button per bar (D19). An empty unit keeps its slot (UI
 * spec §3.3). Fires `unit-click` with the unit's fullStart.
 */
export class Bars extends LitElement {
  static override properties = {
    items: { attribute: false },
    colour: { attribute: false },
    average: { attribute: false },
    chosen: { attribute: false },
  };

  declare items: BarItem[];
  declare colour: string;
  declare average: BarsAverage | null;
  declare chosen: string | null;

  private chart: Chart | null = null;
  /** Set after a chart click, so the chosen bar comes from the properties whatever ECharts did. */
  private chartStale = false;
  private readonly chartEl = createRef<HTMLDivElement>();

  constructor() {
    super();
    this.items = [];
    this.colour = "";
    this.average = null;
    this.chosen = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.chart === null) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.chart?.dispose();
    this.chart = null;
    super.disconnectedCallback();
  }

  private isChosen(item: BarItem): boolean {
    return item.unit.fullStart === this.chosen;
  }

  private fire(item: BarItem | undefined): void {
    if (!item) return;
    this.dispatchEvent(
      new CustomEvent<UnitSelection>("unit-click", {
        detail: { fullStart: item.unit.fullStart },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override updated(changed: PropertyValues<this>): void {
    const el = this.chartEl.value;
    if (!el) return;
    let fresh = false;
    if (this.chart === null) {
      fresh = true;
      this.chart = createChart(el);
      this.chart.on("click", (p) => {
        this.fire(this.items[p.dataIndex]);
        this.chartStale = true;
        this.requestUpdate();
      });
    }
    if (
      fresh ||
      this.chartStale ||
      changed.has("items") ||
      changed.has("colour") ||
      changed.has("average") ||
      changed.has("chosen")
    ) {
      this.chartStale = false;
      this.chart.setOption(this.option(), { notMerge: true });
    }
  }

  private labelsThatFit(): number {
    const width = this.chartEl.value?.clientWidth ?? 0;
    // "i gang" sits on a second line, under its neighbours' empty one, so only the first line counts.
    const longest = Math.max(1, ...this.items.map((i) => i.axis.length));
    return Math.floor((width - PLOT_INSET) / (longest * LABEL_CHAR + LABEL_GAP));
  }

  /** ECharts draws outside CSS, so it gets the theme's tokens as values. */
  private option(): EChartsCoreOption {
    const style = getComputedStyle(this);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const muted = token("--hs-muted");
    const colour = this.colour || token("--hs-accent");
    const anyChosen = this.chosen !== null;
    const items = this.items;
    const running = items.findIndex((i) => i.running);
    return {
      textStyle: { fontFamily: token("--hs-font") },
      grid: { left: 8, right: this.average === null ? 8 : AVERAGE_ROOM, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        formatter: (p: { dataIndex: number }) => {
          const item = items[p.dataIndex];
          if (!item) return "";
          const range = rangeText({ start: item.unit.start, end: item.unit.end });
          return `${escapeHtml(item.name)}<br>${escapeHtml(range)}<br>${escapeHtml(kr(item.amount))}`;
        },
      },
      xAxis: {
        type: "category",
        // fullStart keeps every slot apart; two units can share an axis text, such as a day in two years.
        data: items.map((i) => i.unit.fullStart),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: token("--hs-line") } },
        axisLabel: {
          color: muted,
          fontSize: 11,
          // ECharts asks again on a resize, so the width is read here.
          interval: (index: number) => axisLabelShown(index, items.length, running, this.labelsThatFit()),
          formatter: (_value: string, index: number) => {
            const item = items[index];
            if (!item) return "";
            return item.running ? `${item.axis}\n${da.inProgress}` : item.axis;
          },
        },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        axisLabel: { color: muted, fontSize: 11, formatter: (value: number) => axisKr(value) },
        splitLine: { lineStyle: { color: token("--hs-grid") } },
      },
      series: [
        {
          type: "bar",
          barCategoryGap: "35%",
          // A focused or hovered bar is marked by itself; the other bars keep their look.
          emphasis: {
            focus: "none",
            itemStyle: { color: shade(colour), opacity: 1, borderColor: token("--hs-text"), borderWidth: 2 },
          },
          data: items.map((item) => {
            const faded = anyChosen && !this.isChosen(item);
            const opacity = faded ? FADED : item.running ? RUNNING : 1;
            return { value: item.amount, itemStyle: { color: colour, opacity } };
          }),
          markLine:
            this.average === null
              ? undefined
              : {
                  // Silent, or a click on the line would arrive as a click on the first bar.
                  silent: true,
                  symbol: "none",
                  lineStyle: { type: "dashed", color: muted, width: 1 },
                  label: {
                    // Outside the plot, in the grid's room on the right, so it never covers a bar.
                    position: "end",
                    formatter: this.average.label,
                    color: muted,
                    fontSize: 11,
                    width: AVERAGE_ROOM - 8,
                    overflow: "break",
                  },
                  data: [{ yAxis: this.average.amount }],
                },
        },
      ],
    };
  }

  override render() {
    return html`<div class="bars">
      <div class="chart" aria-hidden="true" ${ref(this.chartEl)}></div>
      <div class="visually-hidden">
        <ul>
          ${this.items.map(
            (item, i) =>
              html`<li>
                <button
                  type="button"
                  aria-pressed=${String(this.isChosen(item))}
                  @click=${() => this.fire(item)}
                  @focus=${() => this.chart?.highlight(i)}
                  @blur=${() => this.chart?.downplay(i)}
                >
                  ${buttonName(item)}
                </button>
              </li>`,
          )}
        </ul>
        ${this.average === null ? nothing : html`<p>${this.average.label}</p>`}
      </div>
    </div>`;
  }
}

export const barsStyles = [
  visuallyHidden,
  css`
    .bars .chart {
      height: 400px;
    }
  `,
];

if (!customElements.get("hs-bars")) customElements.define("hs-bars", Bars);

declare global {
  interface HTMLElementTagNameMap {
    "hs-bars": Bars;
  }
}
