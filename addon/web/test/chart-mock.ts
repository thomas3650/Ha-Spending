import type { Chart } from "../src/charts/echarts";

export interface FakeChart extends Chart {
  calls: { setOption: number; highlight: number[]; downplay: number[]; hideTip: number };
  /** The setOption and hideTip calls in the order they came. */
  order: ("setOption" | "hideTip")[];
  clickHandlers: ((p: { dataIndex: number }) => void)[];
  /** The element the chart was made on. */
  el: HTMLElement;
}

/** Every chart made since the last `forgetCharts()`, so a test can check calls and invoke its click handlers. */
export const charts: FakeChart[] = [];

export function forgetCharts(): void {
  charts.length = 0;
}

export function createChart(el: HTMLElement): Chart {
  const chart: FakeChart = {
    el,
    calls: { setOption: 0, highlight: [], downplay: [], hideTip: 0 },
    clickHandlers: [],
    order: [],
    setOption() {
      chart.calls.setOption += 1;
      chart.order.push("setOption");
    },
    on(_event, handler) {
      chart.clickHandlers.push(handler);
    },
    highlight(dataIndex) {
      chart.calls.highlight.push(dataIndex);
    },
    downplay(dataIndex) {
      chart.calls.downplay.push(dataIndex);
    },
    hideTip() {
      chart.calls.hideTip += 1;
      chart.order.push("hideTip");
    },
    dispose() {},
  };
  charts.push(chart);
  return chart;
}

/** The last chart made inside an `hs-bars`. */
export function barChart(): FakeChart {
  const chart = [...charts].reverse().find((c) => c.el.closest("hs-bars") !== null);
  if (chart === undefined) throw new Error("no bar chart");
  return chart;
}
