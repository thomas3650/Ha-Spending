import type { Chart } from "../src/charts/echarts";

export interface FakeChart extends Chart {
  calls: { setOption: number; highlight: number[]; downplay: number[]; hideTip: number };
  /** The setOption and hideTip calls in the order they came. */
  order: ("setOption" | "hideTip")[];
  clickHandlers: ((p: { dataIndex: number }) => void)[];
  /** The last option set. */
  option: unknown;
}

/** Every chart made since the last `forgetCharts()`, so a test can check calls and invoke its click handlers. */
export const charts: FakeChart[] = [];

export function forgetCharts(): void {
  charts.length = 0;
}

export function createChart(): Chart {
  const chart: FakeChart = {
    calls: { setOption: 0, highlight: [], downplay: [], hideTip: 0 },
    clickHandlers: [],
    order: [],
    option: undefined,
    setOption(option) {
      chart.option = option;
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

interface BarsOption {
  xAxis?: unknown;
  tooltip: { formatter: (p: { dataIndex: number }) => string };
}

/** The last bar chart made: the circle has no x-axis. */
export function barChart(): FakeChart {
  const chart = [...charts].reverse().find((c) => (c.option as BarsOption | undefined)?.xAxis !== undefined);
  if (chart === undefined) throw new Error("no bar chart");
  return chart;
}

/** The tooltip of bar `index` on the last bar chart made. */
export function barTooltipAt(index: number): string {
  return (barChart().option as BarsOption).tooltip.formatter({ dataIndex: index });
}
