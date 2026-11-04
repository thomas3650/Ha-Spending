import { addDays, addMonths, groupingFor, type Level, type SpendingData, unitsOf } from "@ha-spending/shared";
import type { AmountFilter } from "../model/amount";
import { viewContext } from "../model/context";
import { fixedUnits } from "../model/fixed";
import { objectGroupNames } from "../model/key-numbers";
import { type Card, type DetailKey, type PeriodChoice, periodOf, type ViewState } from "./view";

const ALL: Level = { kind: "all" };

function withoutUnit(s: ViewState): ViewState {
  return { ...s, unit: null };
}

export function setPeriod(s: ViewState, period: PeriodChoice): ViewState {
  return withoutUnit({ ...s, period });
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

/** Keeps the card, unlike `chooseUnit`: the fixed-expenses view has no tab to switch to. */
export function chooseFixedUnit(s: ViewState, fullStart: string): ViewState {
  return s.unit === fullStart ? withoutUnit(s) : { ...s, unit: fullStart };
}

export function openFixed(s: ViewState, objectGroup: string): ViewState {
  return { ...s, fixed: true, objectGroup, fullScreen: false, detail: null };
}

export function setObjectGroup(s: ViewState, objectGroup: string | null): ViewState {
  return withoutUnit({ ...s, objectGroup });
}

export function leaveFixed(s: ViewState): ViewState {
  return { ...s, fixed: false, objectGroup: null };
}

/** Keeps the detail, so the way back finds the overview as it was (spec §6.3). */
export function openLeftOver(s: ViewState): ViewState {
  return { ...withoutUnit(s), leftOver: true, fullScreen: false, fixed: false, objectGroup: null };
}

export function leaveLeftOver(s: ViewState): ViewState {
  return { ...s, leftOver: false };
}

/** The whole calendar month `YYYY-MM`, also when the period cut it (spec §6.3). */
export function openMonth(s: ViewState, month: string, today: string): ViewState {
  const start = `${month}-01`;
  const period: PeriodChoice =
    month === today.slice(0, 7)
      ? { preset: "thisMonth" }
      : { preset: "custom", start, end: addDays(addMonths(start, 1), -1) };
  return { ...withoutUnit(s), leftOver: false, period };
}

export function setCard(s: ViewState, card: Card): ViewState {
  return { ...s, card };
}

export function setFullScreen(s: ViewState, on: boolean): ViewState {
  return { ...s, fullScreen: on };
}

/** "N posteringer →": the quick filter and the detail go, so the list's count matches the link (top-filter §3.1). */
export function openPostingsFull(s: ViewState): ViewState {
  return { ...s, card: "postings", fullScreen: true, search: "", shop: null, amount: null, detail: null };
}

/** The overview's "Alt forbrug": the unit, the main group and the category go; the search and the shop stay. */
export function clearChoices(s: ViewState): ViewState {
  return { ...withoutUnit(s), level: ALL };
}

/** A category implies its main group, so it goes too (D21). */
export function removeMainGroup(s: ViewState): ViewState {
  return { ...s, level: ALL };
}

export function removeCategory(s: ViewState): ViewState {
  const level = s.level;
  return level.kind === "category" ? { ...s, level: { kind: "mainGroup", mainGroup: level.mainGroup } } : s;
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

export function setAmount(s: ViewState, amount: AmountFilter | null): ViewState {
  return { ...s, amount };
}

/** One push: Ryd clears the three together (top-filter spec §4.3). */
export function clearQuickFilter(s: ViewState): ViewState {
  return { ...s, search: "", shop: null, amount: null };
}

export function openDetail(s: ViewState, key: DetailKey): ViewState {
  return { ...s, detail: key };
}

export function closeDetail(s: ViewState): ViewState {
  return { ...s, detail: null };
}

/**
 * The detail belongs to the card and the width it was opened in; every other choice keeps it (spec §5). Turning full
 * screen on keeps it too, as ⤢ does (top-filter spec §3.2).
 */
export function keepDetail(prev: ViewState, next: ViewState): ViewState {
  const width = next.fullScreen === prev.fullScreen || next.fullScreen;
  return next.card === prev.card && width ? next : closeDetail(next);
}

/** Spec §5's "Where it resolves", on the answer as it came; the detail itself ignores the level and the unit. */
export function detailResolves(s: ViewState, data: SpendingData, today: string): boolean {
  const key = s.detail;
  if (key === null) return true;
  const listed = (id: string) => data.subscriptions.some((b) => b.id === id);
  if (key.kind === "subscription") return s.card === "subscriptions" && listed(key.id);
  const p = data.postings.find((q) => q.id === key.id);
  if (p === undefined) return false;
  const period = periodOf(s.period, today, data.earliestPostingDate);
  if (p.date < period.start || p.date > period.end) return false;
  if (s.accounts !== null && !s.accounts.includes(p.account)) return false;
  if (s.card === "postings") return true;
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

function overviewUnit(s: ViewState, data: SpendingData, today: string): string | null {
  const period = periodOf(s.period, today, data.earliestPostingDate);
  const units = unitsOf(period, groupingFor(period), today);
  // A one-unit period's finer bars choose nothing, so its one unit would only repeat the period (D59).
  return units.length > 1 && units.some((u) => u.fullStart === s.unit) ? s.unit : null;
}

/** The view resolves the unit against its own units, which may run past the overview's period (spec §7). */
function fixedUnit(s: ViewState, data: SpendingData, today: string): string | null {
  const f = fixedUnits(data, s, today);
  return f.buttons && f.units.some((u) => u.fullStart === s.unit) ? s.unit : null;
}

/** Drops what the answer does not know. */
export function normalise(s: ViewState, data: SpendingData, today: string): ViewState {
  const accounts = s.accounts && s.accounts.filter((id) => data.accounts.some((a) => a.id === id));
  const unit = s.fixed && data.subscriptions.length > 0 ? fixedUnit(s, data, today) : overviewUnit(s, data, today);
  const card =
    (s.card === "subscriptions" && data.subscriptions.length === 0) ||
    (s.card === "shops" && !hasShops(data))
      ? "bars"
      : s.card;
  const known = { ...s, accounts, level: knownLevel(s.level, data), unit, card };
  if (known.fixed) {
    if (data.subscriptions.length === 0) return normalise(leaveFixed(known), data, today);
    const names = objectGroupNames(viewContext(data, known, today));
    const objectGroup = names.length > 1 && known.objectGroup !== null && names.includes(known.objectGroup) ? known.objectGroup : null;
    return closeDetail({ ...known, objectGroup });
  }
  return detailResolves(known, data, today) ? known : closeDetail(known);
}
