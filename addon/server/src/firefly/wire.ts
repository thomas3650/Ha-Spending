/** The fields of Firefly III's answers that the server reads. */

export const ASSET = "Asset account";

export interface WirePage<T> {
  data: T[];
  meta?: { pagination?: { total_pages?: number } };
}

export interface WireSplit {
  transaction_journal_id: string;
  type: string;
  /** "2026-01-08T00:00:00+01:00": the first 10 characters are the local date. */
  date: string;
  /** In the account's currency, always positive. */
  amount: string;
  currency_code: string;
  foreign_amount: string | null;
  foreign_currency_code: string | null;
  description: string;
  source_id: string;
  source_name: string;
  source_type: string;
  destination_id: string;
  destination_name: string;
  destination_type: string;
  category_id: string | null;
  category_name: string | null;
}

export interface WireGroup {
  id: string;
  attributes: { group_title: string | null; transactions: WireSplit[] };
}

export interface WireAccount {
  id: string;
  attributes: { name: string; active: boolean };
}

export interface WireCategory {
  id: string;
  attributes: { name: string };
}

export interface WireRuleGroup {
  id: string;
  attributes: { title: string; order: number; active: boolean };
}

export interface WireRulePart {
  type: string;
  value: string;
  active: boolean;
}

export interface WireRule {
  id: string;
  attributes: { title: string; order: number; active: boolean; triggers: WireRulePart[]; actions: WireRulePart[] };
}

export interface WireAbout {
  data: { version: string };
}
