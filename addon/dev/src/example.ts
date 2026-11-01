import type { SeedData, SeedRule, SeedSplit, SeedSubscription } from "./seed-types";

function tagRule(category: string, tag: string, active = true): SeedRule {
  return {
    title: `${category} → ${tag}`,
    active,
    triggers: [{ type: "category_is", value: category }],
    actions: [{ type: "add_tag", value: tag }],
  };
}

function one(split: SeedSplit): { splits: SeedSplit[] } {
  return { splits: [split] };
}

function subscription(
  name: string,
  repeat: SeedSubscription["repeat"],
  start: string,
  amountMin: string,
  extra: Partial<SeedSubscription> = {},
): SeedSubscription {
  return { name, repeat, start, amountMin, amountMax: amountMin, ...extra };
}

/** The small, hand-made dataset the server's and the integration tests check against. */
export const exampleSeed: SeedData = {
  accounts: [
    { name: "Konto A", active: true },
    { name: "Konto B", active: true },
    { name: "Konto C", active: false },
  ],
  otherAccounts: [{ name: "Billån", type: "liabilities", active: true }],
  categories: ["Dagligvarer", "Café", "Husleje", "Brændstof", "Streaming", "Gaver", "Tandlæge", "Indskud", "Opsparing"],
  subscriptions: [
    subscription("Husleje", "monthly", "2025-01-31", "8000.00"),
    subscription("Netflix", "monthly", "2025-01-02", "99.00", { amountMax: "129.00" }),
    subscription("Bilka", "monthly", "2025-01-10", "150.00", { amountMax: "250.00" }),
    subscription("Opsparingsaftale", "monthly", "2025-01-07", "1000.00"),
    subscription("Avis", "monthly", "2025-01-15", "199.00", { active: false }),
    subscription("Fitness", "monthly", "2025-02-01", "299.00", { end: "2026-10-30" }),
    subscription("Gammel forsikring", "yearly", "2025-03-01", "1200.00", { end: "2026-10-29" }),
    subscription("Tandforsikring", "yearly", "2026-12-01", "600.00"),
    subscription("Hver tredje år", "yearly", "2025-05-01", "3000.00", { skip: 2 }),
    subscription("Billån", "monthly", "2026-08-01", "2500.00"),
    subscription("Indboforsikring", "quarterly", "2026-09-15", "900.00"),
  ],
  ruleGroups: [
    {
      title: "Hovedgrupper",
      rules: [
        tagRule("Dagligvarer", "Mad"),
        tagRule("Café", "Mad"),
        tagRule("Husleje", "Bolig"),
        tagRule("Brændstof", "Bil"),
        tagRule("Streaming", "Fritid"),
        tagRule("Streaming", "Abonnementer"),
        tagRule("Indskud", "Penge ind og ud"),
        tagRule("Opsparing", "Penge ind og ud"),
        tagRule("Gaver", "Fritid", false),
        tagRule("Tandlæge", "Sundhed"),
        {
          title: "Netto → Mad",
          active: true,
          triggers: [{ type: "description_contains", value: "Netto" }],
          actions: [{ type: "add_tag", value: "Mad" }],
        },
      ],
    },
    { title: "Andet", rules: [tagRule("Husleje", "Forkert")] },
  ],
  transactions: [
    one({ type: "withdrawal", date: "2025-12-03", amount: "412.50", description: "Indkøb i Netto",
      source: "Konto A", destination: "Netto", category: "Dagligvarer" }),
    one({ type: "withdrawal", date: "2025-12-15", amount: "85.00", description: "Kaffe og kage",
      source: "Konto A", destination: "Café Søde", category: "Café" }),
    one({ type: "withdrawal", date: "2025-12-20", amount: "600.00", description: "Tankning Shell",
      source: "Konto B", destination: "Shell", category: "Brændstof" }),
    one({ type: "deposit", date: "2025-12-28", amount: "50.25", description: "Returvare Netto",
      source: "Netto", destination: "Konto A", category: "Dagligvarer" }),
    one({ type: "withdrawal", date: "2025-12-30", amount: "8000.00", description: "Husleje januar",
      source: "Konto A", destination: "Udlejer", category: "Husleje", subscription: "Husleje" }),
    one({ type: "withdrawal", date: "2026-01-02", amount: "129.00", description: "Netflix",
      source: "Konto A", destination: "Netflix", category: "Streaming", subscription: "Netflix" }),
    one({ type: "deposit", date: "2026-01-05", amount: "20000.00", description: "Løn",
      source: "Arbejdsgiver", destination: "Konto A" }),
    one({ type: "deposit", date: "2026-01-06", amount: "5000.00", description: "Indskud fra familien",
      source: "Familien", destination: "Konto A", category: "Indskud" }),
    one({ type: "withdrawal", date: "2026-01-07", amount: "1000.00", description: "Til opsparing",
      source: "Konto A", destination: "Opsparingskonto", category: "Opsparing",
      subscription: "Opsparingsaftale" }),
    one({ type: "transfer", date: "2026-01-08", amount: "300.00", description: "Overførsel til Konto B",
      source: "Konto A", destination: "Konto B" }),
    {
      groupTitle: "Indkøb",
      splits: [
        { type: "withdrawal", date: "2026-01-10", amount: "200.00", description: "Bilka mad",
          source: "Konto A", destination: "Bilka", category: "Dagligvarer", subscription: "Bilka" },
        { type: "withdrawal", date: "2026-01-10", amount: "150.00", description: "Bilka gave",
          source: "Konto A", destination: "Bilka", category: "Gaver" },
      ],
    },
    one({ type: "withdrawal", date: "2026-01-14", amount: "745.00", description: "Hotel i Berlin",
      source: "Konto B", destination: "Hotel Berlin", category: "Café", foreignAmount: "100.00",
      foreignCurrency: "EUR" }),
    one({ type: "withdrawal", date: "2026-01-20", amount: "45.00", description: "Kiosk",
      source: "Konto A", destination: "Kiosk" }),
    one({ type: "withdrawal", date: "2026-02-03", amount: "333.33", description: "Indkøb i Netto, Konto C",
      source: "Konto C", destination: "Netto", category: "Dagligvarer" }),
    one({ type: "withdrawal", date: "2026-02-10", amount: "550.00", description: "Tankning Q8",
      source: "Konto B", destination: "Q8", category: "Brændstof" }),
    one({ type: "deposit", date: "2026-07-01", amount: "600.00", description: "Refusion Q8",
      source: "Q8", destination: "Konto B", category: "Brændstof" }),
    one({ type: "withdrawal", date: "2026-08-01", amount: "2500.00", description: "Billån august",
      source: "Billån", destination: "Bilforhandler", category: "Brændstof", subscription: "Billån" }),
    one({ type: "withdrawal", date: "2026-09-15", amount: "900.00", description: "Indboforsikring kvartal",
      source: "Konto A", destination: "Forsikringsselskabet", category: "Husleje", subscription: "Indboforsikring" }),
    one({ type: "withdrawal", date: "2027-03-15", amount: "900.00", description: "Indboforsikring næste år",
      source: "Konto A", destination: "Forsikringsselskabet", category: "Husleje", subscription: "Indboforsikring" }),
    // Older than every withdrawal and deposit: the earliest posting date must pass it by.
    one({ type: "transfer", date: "2024-11-20", amount: "1000.00", description: "Første overførsel",
      source: "Konto A", destination: "Konto B" }),
  ],
};
