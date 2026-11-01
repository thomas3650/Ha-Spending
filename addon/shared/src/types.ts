export interface Health {
  status: "ok";
  version: string;
}

export interface Posting {
  id: string;
  groupId: string;
  date: string;
  text: string;
  account: string;
  /** The category's name; null is Uden kategori. */
  category: string | null;
  kind: "spending" | "refund";
  /** In øre: spending positive, a refund negative. */
  amount: number;
}

export interface Account {
  id: string;
  name: string;
}

export interface Category {
  name: string;
  /** null is Uden hovedgruppe. */
  mainGroup: string | null;
}

/** Both days included. */
export interface Period {
  start: string;
  end: string;
}

export interface Subscription {
  id: string;
  name: string;
  repeat: "weekly" | "monthly" | "quarterly" | "half-year" | "yearly";
  skip: number;
  /** The first due date. */
  start: string;
  /** null: no end date. */
  end: string | null;
  /** In øre. */
  amountMin: number;
  amountMax: number;
  /** The latest linked payment on or before today, with its posting's category and account. */
  lastPayment: { date: string; amount: number; category: string | null; account: string } | null;
}

export type Repeat = Subscription["repeat"];

/** The answer of `/api/data`. "By name" means sorted with `localeCompare(…, "da")`. */
export interface SpendingData {
  /** As asked. */
  range: Period;
  /** The day the data was read, in the add-on's time zone. */
  today: string;
  /** The oldest withdrawal or deposit; null when there is none (D12). */
  earliestPostingDate: string | null;
  /** Within range, newest first. */
  postings: Posting[];
  /** Every asset account, active or not, by name. */
  accounts: Account[];
  /** Every category not in an excluded main group, by name. */
  categories: Category[];
  /** The distinct non-null mainGroup of categories, by name. */
  mainGroups: string[];
  /** false: the rule group in the options does not exist. */
  mainGroupsFound: boolean;
  /** A posting opens at `${fireflyLinkUrl}/transactions/show/${groupId}`. */
  fireflyLinkUrl: string | null;
  /** Kept as §3 of the subscriptions spec says, by name. */
  subscriptions: Subscription[];
}

export type DataErrorCode = "unreachable" | "refused" | "bad-request" | "internal";

export interface DataError {
  error: DataErrorCode;
}
