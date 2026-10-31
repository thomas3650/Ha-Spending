import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { type Chart, createChart, type EChartsCoreOption } from "../charts/echarts";
import { signedKr } from "../format";
import { da } from "../i18n/da";
import { visuallyHidden } from "../theme";

export interface DifferenceItem {
  key: string | null;
  name: string;
  /** null when there is no average to differ from. */
  difference: number | null;
  chosen: boolean;
}

const ROW = 26;
const PAD = 8;

function amountText(item: DifferenceItem): string {
  return item.difference === null ? da.none : signedKr(item.difference);
}

/**
 * Forskel (UI spec §4.4): per part, a bar right for more and left for less than the average unit, drawn by ECharts
 * and named by a hidden table (D19).
 */
export class Difference extends LitElement {
  static override properties = {
    items: { attribute: false },
    title: { attribute: false },
  };

  declare items: DifferenceItem[];
  declare title: string;

  private chart: Chart | null = null;
  private readonly chartEl = createRef<HTMLDivElement>();

  constructor() {
    super();
    this.items = [];
    this.title = "";
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

  protected override updated(changed: PropertyValues<this>): void {
    const el = this.chartEl.value;
    if (!el) return;
    let fresh = false;
    if (this.chart === null) {
      fresh = true;
      this.chart = createChart(el);
    }
    if (fresh || changed.has("items")) this.chart.setOption(this.option(), { notMerge: true });
  }

  /** ECharts draws outside CSS, so it gets the theme's tokens as values. */
  private option(): EChartsCoreOption {
    const style = getComputedStyle(this);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const text = token("--hs-text");
    const more = token("--hs-more");
    const less = token("--hs-less");
    const items = this.items;
    // Symmetric, so zero sits in the middle whatever the signs.
    const reach = Math.max(1, ...items.map((i) => Math.abs(i.difference ?? 0)));
    return {
      textStyle: { fontFamily: token("--hs-font") },
      animation: false,
      grid: { left: PAD, right: PAD, top: 0, bottom: 0, containLabel: true },
      xAxis: { type: "value", min: -reach * 1.35, max: reach * 1.35, show: false },
      yAxis: {
        type: "category",
        inverse: true,
        // The index keeps every row apart; the names are the labels.
        data: items.map((item, i) => ({
          value: String(i),
          textStyle: { fontWeight: item.chosen ? "bold" : "normal" },
        })),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: text,
          fontSize: 13,
          formatter: (_value: string, index: number) => items[index]?.name ?? "",
        },
      },
      series: [
        {
          type: "bar",
          silent: true,
          barWidth: 14,
          data: items.map((item) => {
            const value = item.difference ?? 0;
            const colour = value < 0 ? less : more;
            return {
              value,
              itemStyle: { color: colour, borderRadius: 3 },
              label: {
                show: true,
                position: value < 0 ? "left" : "right",
                formatter: amountText(item),
                color: value > 0 ? token("--hs-up") : text,
                fontSize: 12,
                fontWeight: item.chosen ? "bold" : "normal",
              },
            };
          }),
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { type: "solid", color: token("--hs-leader"), width: 1 },
            data: [{ xAxis: 0 }],
          },
        },
      ],
    };
  }

  override render() {
    const height = `${this.items.length * ROW + PAD}px`;
    return html`<div class="difference">
      <div class="heads" aria-hidden="true"><span>${da.less}</span><span>${da.more}</span></div>
      <div class="chart" aria-hidden="true" style=${styleMap({ height })} ${ref(this.chartEl)}></div>
      <table class="visually-hidden">
        <caption>
          ${this.title}
        </caption>
        <tbody>
          ${this.items.map(
            (item) =>
              html`<tr aria-current=${item.chosen ? "true" : nothing}>
                <th scope="row">${item.name}</th>
                <td>${amountText(item)}</td>
              </tr>`,
          )}
        </tbody>
      </table>
    </div>`;
  }
}

export const differenceStyles = [
  visuallyHidden,
  css`
    .difference .heads {
      display: flex;
      justify-content: space-around;
      margin-bottom: 4px;
      color: var(--hs-muted);
      font-size: 12px;
    }
  `,
];

if (!customElements.get("hs-difference")) customElements.define("hs-difference", Difference);

declare global {
  interface HTMLElementTagNameMap {
    "hs-difference": Difference;
  }
}
