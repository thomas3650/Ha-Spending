import { type Grouping, type Level, type SpendingData, unitsOf } from "@ha-spending/shared";
import { type AmountRange, type Card, type PeriodChoice, periodOf, type Sort, type ViewState } from "./view";

const ALL: Level = { kind: "all" };

function withoutUnit(s: ViewState): ViewState {
  return { ...s, unit: null, card: s.card === "difference" ? "bars" : s.card };
}

export function setPeriod(s: ViewState, period: PeriodChoice): ViewState {
  return withoutUnit({ ...s, period });
}

export function setGrouping(s: ViewState, grouping: Grouping): ViewState {
  return withoutUnit({ ...s, grouping });
}

/** Every id ticked is all accounts, so an account added later shows by itself (D20). */
export function setAccounts(s: ViewState, ids: string[], all: string[]): ViewState {
  const ticked = all.filter((id) => ids.includes(id));
  return { ...s, accounts: ticked.length === all.length ? null : ticked };
}

export function openPart(s: ViewState, key: string | null): ViewState {
  const level = s.level;
  switch (level.kind) {
    case "all":
      return { ...s, level: { kind: "mainGroup", mainGroup: key } };
    case "mainGroup":
      return { ...s, level: { kind: "category", mainGroup: level.mainGroup, category: key } };
    case "category":
      return {
        ...s,
        level:
          level.category === key
            ? { kind: "mainGroup", mainGroup: level.mainGroup }
            : { kind: "category", mainGroup: level.mainGroup, category: key },
      };
  }
}

export function chooseUnit(s: ViewState, fullStart: string): ViewState {
  return s.unit === fullStart ? withoutUnit(s) : { ...s, unit: fullStart, card: "postings" };
}

export function setCard(s: ViewState, card: Card): ViewState {
  return { ...s, card };
}

export function openAllPostings(s: ViewState): ViewState {
  return { ...s, screen: "allPostings", sort: "newest", amount: null };
}

function levelAt(level: Level, depth: 0 | 1 | 2): Level {
  if (depth === 0 || level.kind === "all") return ALL;
  if (depth === 1 || level.kind === "mainGroup") return { kind: "mainGroup", mainGroup: level.mainGroup };
  return level;
}

export function trailLevel(s: ViewState, depth: 0 | 1 | 2): ViewState {
  return { ...s, level: levelAt(s.level, depth), screen: "overview", sort: "newest", amount: null };
}

/** A category implies its main group, so it goes too (D21). */
export function removeMainGroup(s: ViewState): ViewState {
  return { ...s, level: ALL };
}

export function removeCategory(s: ViewState): ViewState {
  return { ...s, level: levelAt(s.level, 1) };
}

export function removeUnit(s: ViewState): ViewState {
  return withoutUnit(s);
}

export function setMainGroup(s: ViewState, key: string | null): ViewState {
  return { ...s, level: { kind: "mainGroup", mainGroup: key } };
}

export function setCategory(s: ViewState, mainGroup: string | null, category: string | null): ViewState {
  return { ...s, level: { kind: "category", mainGroup, category } };
}

export function setSearch(s: ViewState, search: string): ViewState {
  return { ...s, search };
}

export function setSort(s: ViewState, sort: Sort): ViewState {
  return { ...s, sort };
}

export function setAmount(s: ViewState, amount: AmountRange | null): ViewState {
  return { ...s, amount: amount && (amount.min !== null || amount.max !== null) ? amount : null };
}

function knownLevel(level: Level, data: SpendingData): Level {
  if (level.kind === "all") return level;
  if (level.mainGroup !== null && !data.mainGroups.includes(level.mainGroup)) return ALL;
  if (level.kind === "mainGroup" || level.category === null) return level;
  const known = data.categories.some((c) => c.name === level.category && c.mainGroup === level.mainGroup);
  return known ? level : { kind: "mainGroup", mainGroup: level.mainGroup };
}

/** Drops what the answer does not know. */
export function normalise(s: ViewState, data: SpendingData, today: string): ViewState {
  const accounts = s.accounts && s.accounts.filter((id) => data.accounts.some((a) => a.id === id));
  const units = unitsOf(periodOf(s.period, today), s.grouping, today);
  const unit = s.unit !== null && units.some((u) => u.fullStart === s.unit) ? s.unit : null;
  const card = s.card === "difference" && unit === null ? "bars" : s.card;
  return { ...s, accounts, level: knownLevel(s.level, data), unit, card };
}
