import type { Chart } from "../src/charts/echarts";

export interface FakeChart extends Chart {
  calls: { setOption: number; highlight: number[]; downplay: number[]; hideTip: number };
  /** The series each highlight and downplay named; undefined is the wrapper's default, the first. */
  series: { highlight: (number[] | undefined)[]; downplay: (number[] | undefined)[] };
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
    series: { highlight: [], downplay: [] },
    clickHandlers: [],
    order: [],
    setOption() {
      chart.calls.setOption += 1;
      chart.order.push("setOption");
    },
    on(_event, handler) {
      chart.clickHandlers.push(handler);
    },
    highlight(dataIndex, series) {
      chart.calls.highlight.push(dataIndex);
      chart.series.highlight.push(series);
    },
    downplay(dataIndex, series) {
      chart.calls.downplay.push(dataIndex);
      chart.series.downplay.push(series);
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

/** The last chart made inside an `hs-fixed-bars`. */
export function fixedBarChart(): FakeChart {
  const chart = [...charts].reverse().find((c) => c.el.closest("hs-fixed-bars") !== null);
  if (chart === undefined) throw new Error("no fixed bar chart");
  return chart;
}

/** The last chart made inside an `hs-bars`. */
export function barChart(): FakeChart {
  const chart = [...charts].reverse().find((c) => c.el.closest("hs-bars") !== null);
  if (chart === undefined) throw new Error("no bar chart");
  return chart;
}
