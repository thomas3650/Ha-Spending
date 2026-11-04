import type { Grouping } from "@ha-spending/shared";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { type Chart, createChart, type EChartsCoreOption } from "../charts/echarts";
import { axisTickKr, barKr, kr, unitAxis } from "../format";
import { da } from "../i18n/da";
import type { FixedBar, FixedPart } from "../model/fixed";
import type { UnitSelection } from "./bars";

const FADED = 0.3;
const ESTIMATE_OPACITY = 0.55;
const HATCH = {
  symbol: "rect",
  dashArrayX: [1, 0],
  dashArrayY: [3, 3],
  rotation: -Math.PI / 4,
  color: "rgba(255, 255, 255, 0.75)",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function tooltip(bar: FixedBar): string {
  const lines = [bar.name, da.fixed.tooltipPaid(barKr(bar.paidSum))];
  if (bar.estimate.size > 0) {
    lines.push(da.fixed.tooltipEstimate(kr(bar.estimateSum)), da.fixed.tooltipTotal(kr(bar.paidSum + bar.estimateSum)));
  }
  return lines.map(escapeHtml).join("<br>");
}

/**
 * The fixed expenses per unit, stacked by part: paid solid, the estimates hatched above them (spec §5.4). ECharts draws
 * them; a hidden button per bar names each (D19), or a plain list item when the bars choose nothing. The legend is in
 * the DOM. Fires `unit-click` with the bar's unit.
 */
export class FixedBars extends LitElement {
  static override properties = {
    bars: { attribute: false },
    parts: { attribute: false },
    grouping: { attribute: false },
    buttons: { attribute: false },
    chosen: { attribute: false },
    today: { attribute: false },
  };

  declare bars: FixedBar[];
  /** Largest first, so the biggest part sits at the bottom of each bar. */
  declare parts: FixedPart[];
  declare grouping: Grouping;
  declare buttons: boolean;
  /** The chosen unit's fullStart. */
  declare chosen: string | null;
  declare today: string;

  private chart: Chart | null = null;
  private readonly chartEl = createRef<HTMLDivElement>();
  /** As in `hs-bars`: ECharts shows its tooltip again after a redraw until it sees the mouse leave, and can miss that. */
  private pointerAway = false;
  private readonly onWindowBlur = () => {
    this.pointerAway = true;
    this.chart?.hideTip();
  };

  constructor() {
    super();
    this.bars = [];
    this.parts = [];
    this.grouping = "month";
    this.buttons = false;
    this.chosen = null;
    this.today = "";
    this.addEventListener("pointerenter", () => {
      this.pointerAway = false;
    });
    this.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") this.pointerAway = true;
    });
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("blur", this.onWindowBlur);
    if (this.hasUpdated && this.chart === null) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    window.removeEventListener("blur", this.onWindowBlur);
    this.chart?.dispose();
    this.chart = null;
    super.disconnectedCallback();
  }

  private fire(bar: FixedBar | undefined): void {
    if (!bar || !this.buttons) return;
    this.dispatchEvent(
      new CustomEvent<UnitSelection>("unit-click", {
        detail: { fullStart: bar.unit.fullStart },
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
      this.chart = createChart(el, { pointerAway: () => this.pointerAway });
      this.chart.on("click", (p) => this.fire(this.bars[p.dataIndex]));
    }
    const keys = ["bars", "parts", "grouping", "buttons", "chosen", "today"] as const;
    if (!fresh && !keys.some((k) => changed.has(k))) return;
    if (!fresh && this.pointerAway) this.chart.hideTip();
    this.chart.setOption(this.option(), { notMerge: true });
  }

  private hasEstimates(): boolean {
    return this.bars.some((b) => b.estimate.size > 0);
  }

  /** ECharts draws outside CSS, so it gets the theme's tokens as values. */
  private option(): EChartsCoreOption {
    const style = getComputedStyle(this);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const muted = token("--hs-muted");
    const bars = this.bars;
    const faded = (bar: FixedBar) => this.chosen !== null && bar.unit.fullStart !== this.chosen;
    const series = (kind: "paid" | "estimate") =>
      this.parts.map((part) => ({
        type: "bar",
        stack: "fixed",
        barCategoryGap: "35%",
        barMaxWidth: 48,
        cursor: this.buttons ? "pointer" : "default",
        itemStyle: { color: part.colour, decal: kind === "estimate" ? HATCH : undefined },
        data: bars.map((bar) => {
          const value = (kind === "paid" ? bar.paid : bar.estimate).get(part.key);
          const opacity = (faded(bar) ? FADED : 1) * (kind === "estimate" ? ESTIMATE_OPACITY : 1);
          return { value: value === undefined ? null : value, itemStyle: { opacity } };
        }),
      }));
    const all: Record<string, unknown>[] = [...series("paid"), ...series("estimate")];
    const running = bars.find((b) => b.running);
    const last = bars.at(-1);
    if (all.length > 0 && running !== undefined && last !== undefined && last.unit.end > this.today) {
      all[0].markLine = {
        // Silent, or a click on the line would arrive as a click on a bar.
        silent: true,
        symbol: "none",
        lineStyle: { type: "dashed", color: token("--hs-text"), width: 1 },
        label: { formatter: da.fixed.todayMark, position: "end", color: token("--hs-text"), fontSize: 11 },
        data: [{ xAxis: running.unit.fullStart }],
      };
    }
    return {
      textStyle: { fontFamily: token("--hs-font") },
      grid: { left: 8, right: 8, top: 24, bottom: 8, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        // Inside the chart, so a narrow card never cuts a tooltip off.
        confine: true,
        formatter: (params: { dataIndex: number }[]) => {
          const bar = bars[params[0]?.dataIndex ?? -1];
          return bar ? tooltip(bar) : "";
        },
      },
      xAxis: {
        type: "category",
        // fullStart keeps every slot apart; two units can share an axis text.
        data: bars.map((b) => b.unit.fullStart),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: token("--hs-line") } },
        axisLabel: {
          color: muted,
          fontSize: 11,
          formatter: (_value: string, index: number) => {
            const bar = bars[index];
            return bar ? unitAxis(bar.unit, this.grouping) : "";
          },
        },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        axisLabel: { color: muted, fontSize: 11, formatter: (value: number) => axisTickKr(value) },
        splitLine: { lineStyle: { color: token("--hs-grid") } },
      },
      series: all,
    };
  }

  private legend() {
    return html`<div class="fixed-legend">
      ${this.parts.map(
        (part) => html`<span class="fixed-legend-item"
          ><span class="fixed-swatch" aria-hidden="true" style=${styleMap({ background: part.colour })}></span
          >${part.name}</span
        >`,
      )}
      ${this.hasEstimates()
        ? html`<span class="fixed-legend-item"
            ><span class="fixed-swatch hatched" aria-hidden="true"></span>${da.fixed.hatched}</span
          >`
        : nothing}
    </div>`;
  }

  override render() {
    return html`${this.legend()}
      <div class="fixed-bars">
        <div class="chart" aria-hidden="true" ${ref(this.chartEl)}></div>
        <div class="visually-hidden">
          <ul>
            ${this.bars.map((bar) =>
              this.buttons
                ? html`<li>
                    <button
                      type="button"
                      aria-pressed=${String(bar.unit.fullStart === this.chosen)}
                      @click=${() => this.fire(bar)}
                    >
                      ${bar.label}
                    </button>
                  </li>`
                : html`<li>${bar.label}</li>`,
            )}
          </ul>
        </div>
      </div>`;
  }
}

export const fixedBarsStyles = css`
  .fixed-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin: 0 0 4px;
    color: var(--hs-muted);
    font-size: 12px;
  }
  .fixed-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .fixed-swatch {
    display: inline-block;
    width: 14px;
    height: 12px;
    border-radius: 2px;
  }
  .fixed-swatch.hatched {
    background: repeating-linear-gradient(
      -45deg,
      var(--hs-muted) 0 2px,
      transparent 2px 5px
    );
    opacity: 0.6;
  }
  .fixed-bars .chart {
    height: 400px;
  }
`;

if (!customElements.get("hs-fixed-bars")) customElements.define("hs-fixed-bars", FixedBars);

declare global {
  interface HTMLElementTagNameMap {
    "hs-fixed-bars": FixedBars;
  }
}
