import type { Chart } from "../src/charts/echarts";

export interface FakeChart extends Chart {
  calls: { setOption: number; highlight: number[]; downplay: number[] };
  clickHandlers: ((p: { dataIndex: number }) => void)[];
}

/** Every chart made since the last `forgetCharts()`, so a test can check calls and invoke its click handlers. */
export const charts: FakeChart[] = [];

export function forgetCharts(): void {
  charts.length = 0;
}

export function createChart(): Chart {
  const chart: FakeChart = {
    calls: { setOption: 0, highlight: [], downplay: [] },
    clickHandlers: [],
    setOption() {
      chart.calls.setOption += 1;
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
    dispose() {},
  };
  charts.push(chart);
  return chart;
}
