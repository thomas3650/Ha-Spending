import {
  type Grouping,
  isDate,
  type Level,
  type Period,
  type Preset,
  PRESETS,
  presetPeriod,
} from "@ha-spending/shared";

export type PeriodChoice = { preset: Preset } | { preset: "custom"; start: string; end: string };
export type Card = "bars" | "postings" | "difference";
export type Sort = "newest" | "oldest" | "largest" | "smallest";

/** Whole kroner, both bounds included. */
export interface AmountRange {
  min: number | null;
  max: number | null;
}

export interface ViewState {
  period: PeriodChoice;
  grouping: Grouping;
  /** null is all accounts, also those that appear later. */
  accounts: string[] | null;
  level: Level;
  /** The chosen unit's fullStart. */
  unit: string | null;
  card: Card;
  screen: "overview" | "allPostings";
  /** search, sort and amount belong to Alle posteringer. */
  search: string;
  sort: Sort;
  amount: AmountRange | null;
}

export const DEFAULT_STATE: ViewState = {
  period: { preset: "thisYear" },
  grouping: "month",
  accounts: null,
  level: { kind: "all" },
  unit: null,
  card: "bars",
  screen: "overview",
  search: "",
  sort: "newest",
  amount: null,
};

const GROUPINGS: readonly Grouping[] = ["day", "week", "month", "quarter", "year"];
const CARDS: readonly Card[] = ["bars", "postings", "difference"];
const SORTS: readonly Sort[] = ["newest", "oldest", "largest", "smallest"];
const ALL_POSTINGS = "all-postings";

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return values.find((v) => v === value) ?? fallback;
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

/** Whole kroner as digits only, so "1e3" or "4.5" is refused. */
export function parseKroner(value: string | null): number | null {
  const n = value !== null && /^\d+$/.test(value) ? Number(value) : null;
  return n !== null && Number.isSafeInteger(n) ? n : null;
}

function parseAmount(p: URLSearchParams): AmountRange | null {
  const min = parseKroner(p.get("min"));
  const max = parseKroner(p.get("max"));
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min > max) return null;
  return { min, max };
}

/** What does not parse falls back to DEFAULT_STATE's value (D20). */
export function parseHash(hash: string): ViewState {
  const p = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const accounts = p.get("accounts");
  const unit = p.get("unit") ?? undefined;
  const allPostings = p.get("view") === ALL_POSTINGS;
  return {
    period: parsePeriod(p),
    grouping: oneOf(GROUPINGS, p.get("by"), DEFAULT_STATE.grouping),
    accounts: accounts === null ? null : accounts.split(",").filter((id) => id !== ""),
    level: parseLevel(p),
    unit: isDate(unit) ? unit : null,
    card: oneOf(CARDS, p.get("card"), DEFAULT_STATE.card),
    screen: allPostings ? "allPostings" : "overview",
    search: allPostings ? (p.get("q") ?? "") : DEFAULT_STATE.search,
    sort: allPostings ? oneOf(SORTS, p.get("sort"), DEFAULT_STATE.sort) : DEFAULT_STATE.sort,
    amount: allPostings ? parseAmount(p) : DEFAULT_STATE.amount,
  };
}

/** Without '#'. The keys go in D20's order and defaults are left out, so equal states give equal hashes. */
export function toHash(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.period.preset === "custom") {
    p.set("period", "custom");
    p.set("from", s.period.start);
    p.set("to", s.period.end);
  } else if (s.period.preset !== DEFAULT_STATE.period.preset) {
    p.set("period", s.period.preset);
  }
  if (s.grouping !== DEFAULT_STATE.grouping) p.set("by", s.grouping);
  if (s.accounts !== null) p.set("accounts", s.accounts.join(","));
  if (s.level.kind !== "all") p.set("group", s.level.mainGroup ?? "");
  if (s.level.kind === "category") p.set("category", s.level.category ?? "");
  if (s.unit !== null) p.set("unit", s.unit);
  if (s.card !== DEFAULT_STATE.card) p.set("card", s.card);
  if (s.screen === "allPostings") {
    p.set("view", ALL_POSTINGS);
    if (s.search !== "") p.set("q", s.search);
    if (s.sort !== DEFAULT_STATE.sort) p.set("sort", s.sort);
    if (s.amount?.min != null) p.set("min", String(s.amount.min));
    if (s.amount?.max != null) p.set("max", String(s.amount.max));
  }
  return p.toString();
}

export function periodOf(choice: PeriodChoice, today: string): Period {
  return choice.preset === "custom" ? { start: choice.start, end: choice.end } : presetPeriod(choice.preset, today);
}
