import { BarChart, PieChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { type EChartsCoreOption, init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";

export type { EChartsCoreOption };

use([PieChart, BarChart, GridComponent, MarkLineComponent, TooltipComponent, SVGRenderer]);

export interface Chart {
  setOption(option: EChartsCoreOption, opts?: { notMerge?: boolean }): void;
  on(event: "click", handler: (p: { dataIndex: number }) => void): void;
  highlight(dataIndex: number): void;
  downplay(dataIndex: number): void;
  hideTip(): void;
  dispose(): void;
}

export interface ChartOptions {
  /** True when the mouse is known to be away, so a resize must not bring a tooltip back. */
  pointerAway?: () => boolean;
}

/** The only door to ECharts, so the component tests can replace it: happy-dom has no canvas to measure text with. */
export function createChart(el: HTMLElement, opts: ChartOptions = {}): Chart {
  const chart = init(el, null, { renderer: "svg" });
  const hideTip = () => chart.dispatchAction({ type: "hideTip" });
  const observer = new ResizeObserver(() => {
    if (opts.pointerAway?.()) hideTip();
    chart.resize();
  });
  observer.observe(el);
  return {
    setOption: (option, opts) => chart.setOption(option, opts),
    on: (event, handler) => chart.on(event, (p) => handler({ dataIndex: (p as { dataIndex: number }).dataIndex })),
    highlight: (dataIndex) => chart.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex }),
    downplay: (dataIndex) => chart.dispatchAction({ type: "downplay", seriesIndex: 0, dataIndex }),
    hideTip,
    dispose: () => {
      observer.disconnect();
      chart.dispose();
    },
  };
}
