import {
  isDate,
  type Level,
  type Period,
  type Preset,
  PRESETS,
  presetPeriod,
} from "@ha-spending/shared";
import type { AmountFilter } from "../model/amount";

export type PeriodChoice = { preset: Preset } | { preset: "custom"; start: string; end: string };
export type Card = "bars" | "postings" | "subscriptions" | "shops";
export type PostingColumn = "date" | "text" | "category" | "account" | "amount";
export type SubscriptionColumn = "name" | "category" | "amount" | "perYear" | "status";

export type DetailKey = { kind: "subscription"; id: string } | { kind: "posting"; id: string };

export interface Sorted<C extends string> {
  column: C;
  descending: boolean;
}

export type Sort = Sorted<PostingColumn>;

export interface ViewState {
  period: PeriodChoice;
  /** null is all accounts, also those that appear later. */
  accounts: string[] | null;
  level: Level;
  /** The chosen unit's fullStart. */
  unit: string | null;
  card: Card;
  /** The right card fills the page. */
  fullScreen: boolean;
  /** The fixed-expenses view replaces the overview; it is never full screen. */
  fixed: boolean;
  /** The fixed-expenses view's object group; null is Alle. Only with `fixed`. */
  objectGroup: string | null;
  /** The quick filter: shared choices that stay when the top filter or the tab changes. */
  search: string;
  shop: string | null;
  amount: AmountFilter | null;
  /** The open detail of a bill or a posting (D44). */
  detail: DetailKey | null;
}

export const DEFAULT_STATE: ViewState = {
  period: { preset: "thisYear" },
  accounts: null,
  level: { kind: "all" },
  unit: null,
  card: "bars",
  fullScreen: false,
  fixed: false,
  objectGroup: null,
  search: "",
  shop: null,
  amount: null,
  detail: null,
};

/** Held by the app, not in the hash (top-filter spec §3.4). */
export const DEFAULT_POSTING_SORT: Sort = { column: "date", descending: true };

const CARDS: readonly Card[] = ["bars", "postings", "subscriptions", "shops"];
/** The old Alle posteringer screen; its links open Posteringer in full screen. */
const ALL_POSTINGS = "all-postings";
const FULL = "full";
const FIXED = "fixed";

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return values.find((v) => v === value) ?? fallback;
}

/** The same column turns around; another column starts in its first direction. */
export function nextSort<C extends string>(current: Sorted<C>, column: C, firstDescending: (c: C) => boolean): Sorted<C> {
  return column === current.column
    ? { column, descending: !current.descending }
    : { column, descending: firstDescending(column) };
}

export function postingFirstDescending(column: PostingColumn): boolean {
  return column === "date" || column === "amount";
}

function parsePeriod(p: URLSearchParams): PeriodChoice {
  const preset = p.get("period");
  if (preset === "custom") {
    const start = p.get("from") ?? undefined;
    const end = p.get("to") ?? undefined;
    return isDate(start) && isDate(end) && start <= end ? { preset, start, end } : DEFAULT_STATE.period;
  }
  const known = PRESETS.find((v) => v === preset);
  return known ? { preset: known } : DEFAULT_STATE.period;
}

function parseLevel(p: URLSearchParams): Level {
  const mainGroup = p.get("group");
  if (mainGroup === null) return { kind: "all" };
  const category = p.get("category");
  if (category === null) return { kind: "mainGroup", mainGroup: mainGroup || null };
  return { kind: "category", mainGroup: mainGroup || null, category: category || null };
}

/** The hash's kroner, with a dot and one or two digits for øre (D47), read by string so "1e3" is refused. */
function readKroner(value: string | null): number | null {
  const match = value === null ? null : /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (match === null) return null;
  const ore = Number(match[1] + (match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(ore) ? ore : null;
}

function writeKroner(ore: number): string {
  const cents = ore % 100;
  const kroner = (ore - cents) / 100;
  return cents === 0 ? String(kroner) : `${kroner}.${String(cents).padStart(2, "0")}`;
}

/** One kind only, the first that parses (top-filter spec §6); an old link's `min` or `max` alone is Over or Under. */
function parseAmount(p: URLSearchParams): AmountFilter | null {
  for (const kind of ["about", "under", "over"] as const) {
    const value = readKroner(p.get(kind));
    if (value !== null) return { kind, value };
  }
  const min = readKroner(p.get("min"));
  const max = readKroner(p.get("max"));
  if (min !== null && max !== null) return min <= max ? { kind: "between", min, max } : null;
  if (min !== null) return { kind: "over", value: min };
  if (max !== null) return { kind: "under", value: max };
  return null;
}

function writeAmount(p: URLSearchParams, amount: AmountFilter): void {
  if (amount.kind === "between") {
    p.set("min", writeKroner(amount.min));
    p.set("max", writeKroner(amount.max));
  } else {
    p.set(amount.kind, writeKroner(amount.value));
  }
}

function parseDetail(value: string | null): DetailKey | null {
  const match = value === null ? null : /^([sp]):(.+)$/.exec(value);
  if (match === null) return null;
  return { kind: match[1] === "s" ? "subscription" : "posting", id: match[2] };
}

/** What does not parse falls back to DEFAULT_STATE's value (D20); an old link's `sort` is ignored, and `og` only counts with `view=fixed`. */
export function parseHash(hash: string): ViewState {
  const p = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const accounts = p.get("accounts");
  const unit = p.get("unit") ?? undefined;
  const view = p.get("view");
  const allPostings = view === ALL_POSTINGS;
  const fixed = view === FIXED;
  return {
    period: parsePeriod(p),
    accounts: accounts === null ? null : accounts.split(",").filter((id) => id !== ""),
    level: parseLevel(p),
    unit: isDate(unit) ? unit : null,
    card: allPostings ? "postings" : oneOf(CARDS, p.get("card"), DEFAULT_STATE.card),
    fullScreen: allPostings || view === FULL,
    fixed,
    objectGroup: fixed ? p.get("og") || null : null,
    search: p.get("q") ?? DEFAULT_STATE.search,
    shop: p.get("shop") || DEFAULT_STATE.shop,
    amount: parseAmount(p),
    detail: parseDetail(p.get("detail")),
  };
}

/**
 * Without '#'. The keys go in the order of the top-filter spec §6, and defaults are left out, so equal states give
 * equal hashes.
 */
export function toHash(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.period.preset === "custom") {
    p.set("period", "custom");
    p.set("from", s.period.start);
    p.set("to", s.period.end);
  } else if (s.period.preset !== DEFAULT_STATE.period.preset) {
    p.set("period", s.period.preset);
  }
  if (s.accounts !== null) p.set("accounts", s.accounts.join(","));
  if (s.level.kind !== "all") p.set("group", s.level.mainGroup ?? "");
  if (s.level.kind === "category") p.set("category", s.level.category ?? "");
  if (s.unit !== null) p.set("unit", s.unit);
  if (s.card !== DEFAULT_STATE.card) p.set("card", s.card);
  if (s.fixed) {
    p.set("view", FIXED);
    if (s.objectGroup !== null) p.set("og", s.objectGroup);
  } else if (s.fullScreen) {
    p.set("view", FULL);
  }
  if (s.search !== "") p.set("q", s.search);
  if (s.shop !== null) p.set("shop", s.shop);
  if (s.amount !== null) writeAmount(p, s.amount);
  if (s.detail !== null) p.set("detail", `${s.detail.kind === "subscription" ? "s" : "p"}:${s.detail.id}`);
  return p.toString();
}

export function periodOf(choice: PeriodChoice, today: string, earliest: string | null): Period {
  return choice.preset === "custom"
    ? { start: choice.start, end: choice.end }
    : presetPeriod(choice.preset, today, earliest);
}
