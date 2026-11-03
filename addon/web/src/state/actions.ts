import { type Grouping, type Level, type SpendingData, unitsOf } from "@ha-spending/shared";
import {
  type AmountRange,
  type Card,
  DEFAULT_STATE,
  type DetailKey,
  type PeriodChoice,
  periodOf,
  type Sort,
  type ViewState,
} from "./view";

const ALL: Level = { kind: "all" };

function withoutUnit(s: ViewState): ViewState {
  return { ...s, unit: null };
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
  return { ...s, screen: "allPostings", sort: DEFAULT_STATE.sort, amount: null, objectGroup: null };
}

/** The key number's way in: the search and the chosen shop go, unlike "Vis alle" (D31, D35). */
export function openAllPostingsFresh(s: ViewState): ViewState {
  return { ...openAllPostings(s), search: "", shop: null };
}

/** The object group's key number: its count follows the chosen unit, so the unit stays. */
export function openObjectGroupPostings(s: ViewState, title: string): ViewState {
  return { ...openAllPostingsFresh(s), objectGroup: title };
}

function levelAt(level: Level, depth: 0 | 1 | 2): Level {
  if (depth === 0 || level.kind === "all") return ALL;
  if (depth === 1 || level.kind === "mainGroup") return { kind: "mainGroup", mainGroup: level.mainGroup };
  return level;
}

export function trailLevel(s: ViewState, depth: 0 | 1 | 2): ViewState {
  return {
    ...s,
    level: levelAt(s.level, depth),
    screen: "overview",
    sort: DEFAULT_STATE.sort,
    amount: null,
    objectGroup: null,
  };
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

export function chooseShop(s: ViewState, name: string): ViewState {
  return { ...s, shop: name, search: "" };
}

/** One push, so Back returns to Butikker. */
export function openShop(s: ViewState, name: string): ViewState {
  return { ...chooseShop(s, name), card: "postings" };
}

export function removeShop(s: ViewState): ViewState {
  return { ...s, shop: null };
}

export function setSort(s: ViewState, sort: Sort): ViewState {
  return { ...s, sort };
}

export function setAmount(s: ViewState, amount: AmountRange | null): ViewState {
  return { ...s, amount: amount && (amount.min !== null || amount.max !== null) ? amount : null };
}

export function setObjectGroup(s: ViewState, title: string | null): ViewState {
  return { ...s, objectGroup: title };
}

export function openDetail(s: ViewState, key: DetailKey): ViewState {
  return { ...s, detail: key };
}

export function closeDetail(s: ViewState): ViewState {
  return { ...s, detail: null };
}

/** The detail belongs to the card and the screen it was opened on; every other choice keeps it (spec §5). */
export function keepDetail(prev: ViewState, next: ViewState): ViewState {
  return next.card === prev.card && next.screen === prev.screen ? next : closeDetail(next);
}

/** Spec §5's "Where it resolves", on the answer as it came; the detail itself ignores the level and the unit. */
export function detailResolves(s: ViewState, data: SpendingData, today: string): boolean {
  const key = s.detail;
  if (key === null) return true;
  const overview = s.screen === "overview";
  const listed = (id: string) => data.subscriptions.some((b) => b.id === id);
  if (key.kind === "subscription") return overview && s.card === "subscriptions" && listed(key.id);
  const p = data.postings.find((q) => q.id === key.id);
  if (p === undefined) return false;
  const period = periodOf(s.period, today, data.earliestPostingDate);
  if (p.date < period.start || p.date > period.end) return false;
  if (s.accounts !== null && !s.accounts.includes(p.account)) return false;
  if (!overview || s.card === "postings") return true;
  return s.card === "subscriptions" && p.subscription !== null && listed(p.subscription.id);
}

function knownLevel(level: Level, data: SpendingData): Level {
  if (level.kind === "all") return level;
  if (level.mainGroup !== null && !data.mainGroups.includes(level.mainGroup)) return ALL;
  if (level.kind === "mainGroup" || level.category === null) return level;
  const known = data.categories.some((c) => c.name === level.category && c.mainGroup === level.mainGroup);
  return known ? level : { kind: "mainGroup", mainGroup: level.mainGroup };
}

export function hasShops(data: SpendingData): boolean {
  return data.postings.some((p) => p.shop !== null);
}

/** Drops what the answer does not know. */
export function normalise(s: ViewState, data: SpendingData, today: string): ViewState {
  const accounts = s.accounts && s.accounts.filter((id) => data.accounts.some((a) => a.id === id));
  const units = unitsOf(periodOf(s.period, today, data.earliestPostingDate), s.grouping, today);
  const unit = s.unit !== null && units.some((u) => u.fullStart === s.unit) ? s.unit : null;
  const card =
    (s.card === "subscriptions" && data.subscriptions.length === 0) ||
    (s.card === "shops" && !hasShops(data))
      ? "bars"
      : s.card;
  const known = { ...s, accounts, level: knownLevel(s.level, data), unit, card };
  return detailResolves(known, data, today) ? known : closeDetail(known);
}
