import {
  type ClassifiedPosting,
  classify,
  type Level,
  select,
  type SpendingData,
  type Timeline,
  total,
  type Unit,
  unitsOf,
  within,
} from "@ha-spending/shared";
import { da } from "../i18n/da";
import { periodOf, type ViewState } from "../state/view";

export interface ViewContext {
  data: SpendingData;
  state: ViewState;
  /** The app's today, which may differ from data.today. */
  today: string;
  timeline: Timeline;
  units: Unit[];
  chosen: Unit | null;
  /** Every level, within the chosen accounts and the fetched range. */
  postings: ClassifiedPosting[];
  /** The key numbers', the bars' and Posteringer's postings. */
  shown: ClassifiedPosting[];
  circleLevel: Level;
  /** The circle's and Forskel's postings. */
  circlePostings: ClassifiedPosting[];
  parentLevel: Level | null;
  parentTotal: number | null;
}

const ALL: Level = { kind: "all" };

function parentOf(level: Level): Level | null {
  switch (level.kind) {
    case "all":
      return null;
    case "mainGroup":
      return ALL;
    case "category":
      return { kind: "mainGroup", mainGroup: level.mainGroup };
  }
}

export function viewContext(data: SpendingData, state: ViewState, today: string): ViewContext {
  const timeline: Timeline = {
    period: periodOf(state.period, today),
    grouping: state.grouping,
    today,
    earliest: data.earliestPostingDate,
  };
  const units = unitsOf(timeline.period, timeline.grouping, today);
  const chosen = units.find((u) => u.fullStart === state.unit) ?? null;
  const accounts = state.accounts === null ? null : new Set(state.accounts);
  const postings = select(classify(data.postings, data.categories), ALL, accounts);
  const circleLevel: Level = state.level.kind === "all" ? ALL : { kind: "mainGroup", mainGroup: state.level.mainGroup };
  const parentLevel = parentOf(state.level);
  const span = chosen ?? timeline.period;
  return {
    data,
    state,
    today,
    timeline,
    units,
    chosen,
    postings,
    shown: select(postings, state.level, null),
    circleLevel,
    circlePostings: select(postings, circleLevel, null),
    parentLevel,
    parentTotal: parentLevel === null ? null : total(within(select(postings, parentLevel, null), span)),
  };
}

export function partName(key: string | null, of: "mainGroup" | "category"): string {
  return key ?? (of === "mainGroup" ? da.noMainGroup : da.noCategory);
}

export function levelName(level: Level): string {
  switch (level.kind) {
    case "all":
      return da.allSpending;
    case "mainGroup":
      return partName(level.mainGroup, "mainGroup");
    case "category":
      return partName(level.category, "category");
  }
}
