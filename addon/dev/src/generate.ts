import { addDays, firstOfMonth } from "@ha-spending/shared";
import type { SeedData, SeedRule, SeedSplit } from "./seed-types";

/** A tiny seeded PRNG, so the same seed gives the same household. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const JOINT = "Fælleskonto";
const BUDGET = "Budgetkonto";
const CARD = "Kreditkort";

const INCOME_AND_TRANSFERS = "Penge ind og ud";

/** Main group → its categories, and where and how much the money goes. */
const SPENDING: Record<string, Record<string, { shops: string[]; min: number; max: number }>> = {
  Mad: {
    Dagligvarer: { shops: ["Netto", "Rema 1000", "Føtex"], min: 150, max: 1200 },
    Restaurant: { shops: ["Pizzeria Roma", "Sushi Bar"], min: 250, max: 900 },
    Café: { shops: ["Café Søde", "Kaffebaren"], min: 45, max: 180 },
  },
  Bolig: {
    El: { shops: ["Elselskabet"], min: 600, max: 1400 },
    Forsikring: { shops: ["Forsikringsselskabet"], min: 400, max: 900 },
  },
  Bil: {
    Brændstof: { shops: ["Shell", "Q8", "Circle K"], min: 300, max: 800 },
    Parkering: { shops: ["Parkering"], min: 20, max: 120 },
    Værksted: { shops: ["Autoværkstedet"], min: 800, max: 4500 },
  },
  Børn: {
    Institution: { shops: ["Kommunen"], min: 2000, max: 3200 },
    Legetøj: { shops: ["Legetøjsbutikken"], min: 100, max: 600 },
  },
  Fritid: {
    Biograf: { shops: ["Biografen"], min: 90, max: 400 },
    Sport: { shops: ["Svømmehallen", "Sportsklubben"], min: 60, max: 700 },
    Bøger: { shops: ["Boghandlen"], min: 100, max: 450 },
  },
  Sundhed: {
    Tandlæge: { shops: ["Tandlægen"], min: 400, max: 1800 },
    Apotek: { shops: ["Apoteket"], min: 50, max: 400 },
  },
  Tøj: {
    Beklædning: { shops: ["Tøjbutikken", "Netbutikken"], min: 200, max: 1500 },
    Sko: { shops: ["Skobutikken"], min: 400, max: 1200 },
  },
  Rejser: {
    Fly: { shops: ["Flyselskabet"], min: 1500, max: 6000 },
    Hotel: { shops: ["Hotel Lissabon", "Hotel Berlin"], min: 900, max: 4000 },
  },
  Abonnementer: {
    Streaming: { shops: ["Netflix", "Spotify"], min: 99, max: 149 },
    Mobil: { shops: ["Teleselskabet"], min: 99, max: 249 },
    Aviser: { shops: ["Avisen"], min: 129, max: 299 },
  },
  Kæledyr: {
    Dyrlæge: { shops: ["Dyrlægen"], min: 400, max: 2500 },
    Foder: { shops: ["Dyrehandlen"], min: 150, max: 500 },
  },
  Sommerhus: {
    Vedligehold: { shops: ["Byggemarkedet"], min: 300, max: 3000 },
    Ejendomsskat: { shops: ["Kommunen"], min: 1500, max: 2500 },
  },
};

const FIXED: Record<string, string> = { Husleje: "Bolig" };
const UNRULED = "Gaver";
const NOT_RANDOM = new Set(["Dagligvarer", "Institution", "Ejendomsskat"]);

function rule(category: string, tag: string): SeedRule {
  return {
    title: `${category} → ${tag}`,
    active: true,
    triggers: [{ type: "category_is", value: category }],
    actions: [{ type: "add_tag", value: tag }],
  };
}

/** A household's postings over the 14 months before today's month and this month up to today. */
export function generateSeed(options: { today: string; seed: number }): SeedData {
  const random = mulberry32(options.seed);
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const kroner = (min: number, max: number) => {
    const ore = between(min * 100, max * 100);
    return `${Math.floor(ore / 100)}.${String(ore % 100).padStart(2, "0")}`;
  };

  const spending = Object.entries(SPENDING).flatMap(([group, cats]) =>
    Object.entries(cats).map(([category, how]) => ({ group, category, ...how })),
  );
  const randomCategories = spending.filter((c) => !NOT_RANDOM.has(c.category));

  // Streaming maps to Fritid first and to Abonnementer later, so a category is mapped twice and the later rule wins.
  const rules: SeedRule[] = [rule("Streaming", "Fritid")];
  for (const c of spending) rules.push(rule(c.category, c.group));
  for (const [category, group] of Object.entries(FIXED)) rules.push(rule(category, group));
  rules.push(rule("Indskud", INCOME_AND_TRANSFERS), rule("Opsparing", INCOME_AND_TRANSFERS));

  const categories = [
    ...spending.map((c) => c.category),
    ...Object.keys(FIXED),
    UNRULED,
    "Indskud",
    "Opsparing",
  ];

  const [year, month] = options.today.split("-").map(Number);
  const startMonth = (year * 12 + month - 1) - 14;
  const transactions: SeedData["transactions"] = [];
  const add = (split: SeedSplit, groupTitle?: string) => {
    if (split.date <= options.today) transactions.push({ ...(groupTitle ? { groupTitle } : {}), splits: [split] });
  };
  const withdrawal = (date: string, source: string, destination: string, amount: string, category?: string) =>
    add({ type: "withdrawal", date, amount, description: destination, source, destination,
      ...(category ? { category } : {}) });

  for (let m = startMonth; m <= year * 12 + month - 1; m++) {
    const first = firstOfMonth(Math.floor(m / 12), (m % 12) + 1);
    const last = addDays(firstOfMonth(Math.floor(m / 12), (m % 12) + 2), -1);
    const day = (d: number) => addDays(first, d - 1);
    const anyDay = () => day(between(1, 28));

    withdrawal(day(1), JOINT, "Udlejer", "9500.00", "Husleje");
    add({ type: "transfer", date: day(1), amount: "6000.00", description: "Til budgetkontoen",
      source: JOINT, destination: BUDGET });
    withdrawal(day(5), JOINT, "Kommunen", kroner(2400, 2600), "Institution");
    add({ type: "deposit", date: day(25), amount: kroner(31000, 33000), description: "Løn",
      source: "Arbejdsgiver", destination: JOINT });
    withdrawal(day(26), JOINT, "Opsparingskonto", "2000.00", "Opsparing");
    if (m % 2 === 0) {
      add({ type: "deposit", date: day(3), amount: "1000.00", description: "Fra familien", source: "Familien",
        destination: BUDGET, category: "Indskud" });
    }
    if (m % 6 === 0) withdrawal(day(15), JOINT, "Kommunen", kroner(1500, 2500), "Ejendomsskat");

    for (let date = day(between(1, 4)); date <= last; date = addDays(date, 7)) {
      withdrawal(date, BUDGET, pick(["Netto", "Rema 1000", "Føtex"]), kroner(300, 1200), "Dagligvarer");
    }

    for (let i = between(10, 16); i > 0; i--) {
      const c = pick(randomCategories);
      withdrawal(anyDay(), pick([BUDGET, CARD]), pick(c.shops), kroner(c.min, c.max), c.category);
    }
    for (let i = between(1, 3); i > 0; i--) withdrawal(anyDay(), CARD, pick(["Kiosken", "MobilePay"]), kroner(20, 300));
    if (random() < 0.4) withdrawal(anyDay(), CARD, "Gavebutikken", kroner(150, 800), UNRULED);

    const refund = pick(spending.filter((c) => ["Tøj", "Fritid", "Mad"].includes(c.group)));
    const shop = pick(refund.shops);
    add({ type: "deposit", date: anyDay(), amount: kroner(50, 400), description: `Retur ${shop}`, source: shop,
      destination: CARD, category: refund.category });

    const splitDay = day(between(8, 20));
    if (splitDay <= options.today) {
      transactions.push({
        groupTitle: "Indkøb i Bilka",
        splits: [
          { type: "withdrawal", date: splitDay, amount: kroner(300, 900), description: "Bilka mad", source: BUDGET,
            destination: "Bilka", category: "Dagligvarer" },
          { type: "withdrawal", date: splitDay, amount: kroner(100, 500), description: "Bilka gave", source: BUDGET,
            destination: "Bilka", category: UNRULED },
        ],
      });
    }

    if ((m % 12) + 1 === 7) {
      add({ type: "withdrawal", date: day(12), amount: kroner(3500, 4500), description: "Hotel i Lissabon",
        source: CARD, destination: "Hotel Lissabon", category: "Hotel", foreignAmount: `${between(480, 600)}.00`,
        foreignCurrency: "EUR" });
    }
  }

  transactions.sort((a, b) => (a.splits[0].date < b.splits[0].date ? -1 : a.splits[0].date > b.splits[0].date ? 1 : 0));

  return {
    accounts: [JOINT, BUDGET, CARD].map((name) => ({ name, active: true })),
    categories,
    ruleGroups: [{ title: "Hovedgrupper", rules }],
    transactions,
  };
}
