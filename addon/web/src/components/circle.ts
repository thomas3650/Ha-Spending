import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { type Chart, createChart, type EChartsCoreOption } from "../charts/echarts";
import { kr, partLabel, percent } from "../format";
import { da } from "../i18n/da";
import { visuallyHidden } from "../theme";

export interface CircleItem {
  key: string | null;
  name: string;
  amount: number;
  share: number | null;
  colour: string;
  piece: boolean;
}

export interface CircleSelection {
  key: string | null;
}

const SMALL = 0.05;
const FADED = 0.35;
/** The width a column of labels needs beside the ring, its lines and the edge included. */
const LABEL_ROOM = 150;
/** Below this chart width the labels lack room beside the ring, so the parts are listed under it instead. */
export const NARROW_CHART = 400;

/**
 * The ring's inner and outer radius in px: as big as the labels' room beside it allows, between 46 % and 62 % of half
 * the chart's shorter side.
 */
export function ringRadius(width: number, height: number): [number, number] {
  const half = Math.min(width, height) / 2;
  const outer = Math.max(0.46 * half, Math.min(0.62 * half, width / 2 - LABEL_ROOM));
  return [Math.round(outer * 0.74), Math.round(outer)];
}

/** The small pieces come last, so turning the ring by their half puts their middle at 9 o'clock (UI spec §3.2). */
export function ringStartAngle(items: CircleItem[]): number {
  const small = items
    .filter((i) => i.piece && i.share !== null && i.share < SMALL)
    .reduce((sum, i) => sum + (i.share ?? 0), 0);
  return small === 0 ? 90 : 180 - 180 * small;
}

/** ECharts' rich text has no escape, and a brace in a name would end its style block. */
function richSafe(text: string): string {
  return text.replace(/[{}]/g, "");
}

function amountText(item: CircleItem): string {
  return item.share === null ? kr(item.amount) : `${kr(item.amount)} · ${percent(item.share)}`;
}

/** When ECharts wraps a label it drops a newline between two styles, so the newline sits inside the amount's style. */
export function labelText(item: CircleItem): string {
  return `{name|${richSafe(item.name)}}{sub|\n${amountText(item)}}`;
}

/**
 * The ring of parts, drawn by ECharts and named by a hidden button per piece (D19). On a narrow chart the buttons are
 * shown as a list under the ring instead of the labels beside it. Fires `part-click` with the part's key.
 */
export class Circle extends LitElement {
  static override properties = {
    items: { attribute: false },
    centreName: { attribute: false },
    centreAmount: { attribute: false },
    selected: { attribute: false },
    selectable: { attribute: false },
    narrow: { attribute: false },
  };

  declare items: CircleItem[];
  declare centreName: string;
  declare centreAmount: number;
  declare selected: CircleSelection | null;
  declare selectable: boolean;
  /** Set from the chart's width. */
  declare narrow: boolean;

  private chart: Chart | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private ringSize = "";
  /** Set after a chart click, since ECharts toggles its own selection and the properties must win. */
  private chartStale = false;
  private readonly chartEl = createRef<HTMLDivElement>();

  constructor() {
    super();
    this.items = [];
    this.centreName = "";
    this.centreAmount = 0;
    this.selected = null;
    this.selectable = false;
    this.narrow = false;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.chart === null) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.chart?.dispose();
    this.chart = null;
    super.disconnectedCallback();
  }

  private get pieces(): CircleItem[] {
    return this.items.filter((i) => i.piece);
  }

  private isChosen(item: CircleItem): boolean {
    return this.selected !== null && item.key === this.selected.key;
  }

  private fire(item: CircleItem | undefined): void {
    if (!item) return;
    this.dispatchEvent(
      new CustomEvent<CircleSelection>("part-click", { detail: { key: item.key }, bubbles: true, composed: true }),
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
        this.fire(this.pieces[p.dataIndex]);
        this.chartStale = true;
        this.requestUpdate();
      });
      this.resizeObserver = new ResizeObserver(() => {
        if (el.clientWidth > 0) this.narrow = el.clientWidth < NARROW_CHART;
        if (`${el.clientWidth}x${el.clientHeight}` === this.ringSize) return;
        this.chartStale = true;
        this.requestUpdate();
      });
      this.resizeObserver.observe(el);
    }
    if (fresh || this.chartStale || changed.has("items") || changed.has("selected") || changed.has("selectable") ||
      changed.has("narrow")) {
      this.chartStale = false;
      this.chart.setOption(this.option(), { notMerge: true });
    }
  }

  /** ECharts draws outside CSS, so it gets the theme's tokens as values. */
  private option(): EChartsCoreOption {
    const style = getComputedStyle(this);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const text = token("--hs-text");
    const muted = token("--hs-muted");
    const accentText = token("--hs-accent-text");
    const anyChosen = this.selected !== null;
    const el = this.chartEl.value;
    this.ringSize = el ? `${el.clientWidth}x${el.clientHeight}` : "";
    const radius = this.narrow
      ? ["62%", "86%"]
      : el && el.clientWidth > 0
        ? ringRadius(el.clientWidth, el.clientHeight)
        : ["34%", "46%"];
    const labelled = !this.narrow;
    return {
      textStyle: { fontFamily: token("--hs-font") },
      series: [
        {
          type: "pie",
          radius,
          startAngle: ringStartAngle(this.items),
          clockwise: true,
          avoidLabelOverlap: true,
          selectedMode: this.selectable ? "single" : false,
          selectedOffset: 8,
          itemStyle: { borderColor: token("--hs-card"), borderWidth: 2 },
          // A name is never cut: without "break" ECharts truncates it to the room between the edge and its line.
          label: {
            show: labelled,
            alignTo: "edge",
            edgeDistance: 4,
            padding: [2, 4],
            borderRadius: 4,
            overflow: "break",
            // Room for a chosen piece's label, which moves out with its piece after the labels are spread.
            minMargin: 8,
          },
          labelLine: { show: labelled, length: 6, length2: 8, lineStyle: { color: token("--hs-leader") } },
          emphasis: {
            scale: true,
            scaleSize: 6,
            label: { show: labelled, backgroundColor: token("--hs-accent-soft") },
            labelLine: { show: labelled, lineStyle: { color: token("--hs-accent") } },
          },
          data: this.pieces.map((item) => {
            const chosen = this.isChosen(item);
            const opacity = anyChosen && !chosen ? FADED : 1;
            const weight = chosen ? "bold" : "normal";
            return {
              name: item.name,
              value: item.amount,
              selected: chosen,
              itemStyle: { color: item.colour, opacity },
              label: {
                formatter: labelText(item),
                opacity,
                rich: {
                  name: { fontSize: 14, color: text, fontWeight: weight, lineHeight: 18 },
                  sub: { fontSize: 12, color: muted, lineHeight: 15 },
                },
              },
              labelLine: { lineStyle: { opacity } },
              emphasis: {
                label: {
                  opacity: 1,
                  rich: {
                    name: { fontSize: 14, color: accentText, fontWeight: weight, lineHeight: 18 },
                    sub: { fontSize: 12, color: muted, lineHeight: 15 },
                  },
                },
              },
            };
          }),
        },
      ],
    };
  }

  private pressed(item: CircleItem) {
    return this.selectable ? String(this.isChosen(item)) : nothing;
  }

  override render() {
    const rest = this.items.filter((i) => !i.piece);
    return html`<div class=${this.narrow ? "circle circle-narrow" : "circle"}>
      <div class="circle-ring">
        <div class="chart" aria-hidden="true" ${ref(this.chartEl)}></div>
        <div class="circle-centre">
          <div class="circle-centre-name">${this.centreName}</div>
          <div class="circle-centre-amount">${kr(this.centreAmount)}</div>
        </div>
      </div>
      <ul class=${this.narrow ? "circle-list" : "visually-hidden"}>
        ${this.pieces.map(
          (item, i) =>
            html`<li>
              <button
                type="button"
                aria-label=${partLabel(item.name, item.amount, item.share)}
                aria-pressed=${this.pressed(item)}
                @click=${() => this.fire(item)}
                @focus=${() => this.chart?.highlight(i)}
                @blur=${() => this.chart?.downplay(i)}
              >
                ${this.narrow
                  ? html`<span class="circle-dot" style=${`background: ${item.colour}`}></span
                      ><span class="circle-list-name">${item.name}</span
                      ><span class="circle-list-amount">${amountText(item)}</span>`
                  : partLabel(item.name, item.amount, item.share)}
              </button>
            </li>`,
        )}
      </ul>
      ${rest.length === 0
        ? nothing
        : html`<div class="circle-no-piece" role="group" aria-label=${da.noPiece}>
            <span aria-hidden="true">${da.noPiece}</span>
            ${rest.map(
              (item) =>
                html`<button type="button" aria-pressed=${this.pressed(item)} @click=${() => this.fire(item)}>
                  ${partLabel(item.name, item.amount, item.share)}
                </button>`,
            )}
          </div>`}
    </div>`;
  }
}

export const circleStyles = [
  visuallyHidden,
  css`
    .circle-ring {
      position: relative;
    }
    .circle-ring .chart {
      height: 400px;
    }
    .circle-narrow .circle-ring .chart {
      height: 240px;
    }
    .circle-list {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
    }
    .circle-list button {
      display: flex;
      align-items: baseline;
      gap: 8px;
      width: 100%;
      padding: 6px 4px;
      border: 0;
      border-radius: 4px;
      background: none;
      color: var(--hs-text);
      font: inherit;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
    }
    .circle-list button:hover,
    .circle-list button:focus-visible {
      background: var(--hs-accent-soft);
      color: var(--hs-accent-text);
    }
    .circle-list button[aria-pressed="true"] {
      font-weight: bold;
    }
    .circle-dot {
      flex: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .circle-list-name {
      flex: 1;
      min-width: 0;
    }
    .circle-list-amount {
      color: var(--hs-muted);
      font-size: 12px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .circle-centre {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      text-align: center;
    }
    .circle-centre-name {
      color: var(--hs-muted);
      font-size: 13px;
    }
    .circle-centre-amount {
      font-size: 20px;
      font-variant-numeric: tabular-nums;
    }
    .circle-no-piece {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      color: var(--hs-muted);
      font-size: 12px;
    }
    .circle-no-piece button {
      font: inherit;
      color: var(--hs-text);
      background: var(--hs-soft);
      border: 1px solid var(--hs-line);
      border-radius: 12px;
      padding: 2px 8px;
      cursor: pointer;
    }
    .circle-no-piece button:hover,
    .circle-no-piece button:focus-visible {
      background: var(--hs-accent-soft);
      color: var(--hs-accent-text);
    }
    .circle-no-piece button[aria-pressed="true"] {
      font-weight: bold;
    }
  `,
];

if (!customElements.get("hs-circle")) customElements.define("hs-circle", Circle);

declare global {
  interface HTMLElementTagNameMap {
    "hs-circle": Circle;
  }
}
