/** Close to Firefly III's POST bodies, so one dataset feeds the fake and a real Firefly III alike. */
export interface SeedSplit {
  type: "withdrawal" | "deposit" | "transfer";
  date: string;
  amount: string;
  description: string;
  source: string;
  destination: string;
  category?: string;
  foreignAmount?: string;
  foreignCurrency?: string;
  notes?: string;
  tags?: string[];
}

export interface SeedRule {
  title: string;
  active: boolean;
  triggers: { type: string; value: string; active?: boolean }[];
  actions: { type: string; value: string; active?: boolean }[];
}

export interface SeedData {
  /** Asset accounts, in DKK. */
  accounts: { name: string; active: boolean }[];
  /** Every category, also those with no postings. */
  categories: string[];
  /** A group's rules run in array order. */
  ruleGroups: { title: string; rules: SeedRule[] }[];
  transactions: { groupTitle?: string; splits: SeedSplit[] }[];
}
