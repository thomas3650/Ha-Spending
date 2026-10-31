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

function labelText(item: CircleItem): string {
  const sub = item.share === null ? kr(item.amount) : `${kr(item.amount)} · ${percent(item.share)}`;
  return `{name|${richSafe(item.name)}}\n{sub|${sub}}`;
}

/**
 * The ring of parts, drawn by ECharts and named by a hidden button per piece (D19). Fires `part-click` with the
 * part's key.
 */
export class Circle extends LitElement {
  static override properties = {
    items: { attribute: false },
    centreName: { attribute: false },
    centreAmount: { attribute: false },
    selected: { attribute: false },
    selectable: { attribute: false },
  };

  declare items: CircleItem[];
  declare centreName: string;
  declare centreAmount: number;
  declare selected: CircleSelection | null;
  declare selectable: boolean;

  private chart: Chart | null = null;
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
    }
    if (fresh || this.chartStale || changed.has("items") || changed.has("selected") || changed.has("selectable")) {
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
    return {
      textStyle: { fontFamily: token("--hs-font") },
      series: [
        {
          type: "pie",
          radius: ["42%", "60%"],
          startAngle: ringStartAngle(this.items),
          clockwise: true,
          avoidLabelOverlap: true,
          selectedMode: this.selectable ? "single" : false,
          selectedOffset: 8,
          itemStyle: { borderColor: token("--hs-card"), borderWidth: 2 },
          label: { alignTo: "edge", edgeDistance: 8, padding: [2, 4], borderRadius: 4 },
          labelLine: { length: 10, length2: 14, lineStyle: { color: token("--hs-leader") } },
          emphasis: {
            scale: true,
            scaleSize: 6,
            label: { backgroundColor: token("--hs-accent-soft") },
            labelLine: { lineStyle: { color: token("--hs-accent") } },
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
                  name: { fontSize: 13, color: text, fontWeight: weight, lineHeight: 17 },
                  sub: { fontSize: 11, color: muted, lineHeight: 15 },
                },
              },
              labelLine: { lineStyle: { opacity } },
              emphasis: {
                label: {
                  opacity: 1,
                  rich: {
                    name: { fontSize: 13, color: accentText, fontWeight: weight, lineHeight: 17 },
                    sub: { fontSize: 11, color: muted, lineHeight: 15 },
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
    return html`<div class="circle">
      <div class="ring">
        <div class="chart" aria-hidden="true" ${ref(this.chartEl)}></div>
        <div class="centre">
          <div class="centre-name">${this.centreName}</div>
          <div class="centre-amount">${kr(this.centreAmount)}</div>
        </div>
      </div>
      <ul class="visually-hidden">
        ${this.pieces.map(
          (item, i) =>
            html`<li>
              <button
                type="button"
                aria-pressed=${this.pressed(item)}
                @click=${() => this.fire(item)}
                @focus=${() => this.chart?.highlight(i)}
                @blur=${() => this.chart?.downplay(i)}
              >
                ${partLabel(item.name, item.amount, item.share)}
              </button>
            </li>`,
        )}
      </ul>
      ${rest.length === 0
        ? nothing
        : html`<div class="no-piece" role="group" aria-label=${da.noPiece}>
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
    .ring {
      position: relative;
    }
    .ring .chart {
      height: 340px;
    }
    .centre {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      text-align: center;
    }
    .centre-name {
      color: var(--hs-muted);
      font-size: 13px;
    }
    .centre-amount {
      font-size: 20px;
      font-variant-numeric: tabular-nums;
    }
    .no-piece {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      color: var(--hs-muted);
      font-size: 12px;
    }
    .no-piece button {
      font: inherit;
      color: var(--hs-text);
      background: var(--hs-soft);
      border: 1px solid var(--hs-line);
      border-radius: 12px;
      padding: 2px 8px;
      cursor: pointer;
    }
    .no-piece button:hover,
    .no-piece button:focus-visible {
      background: var(--hs-accent-soft);
      color: var(--hs-accent-text);
    }
    .no-piece button[aria-pressed="true"] {
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
