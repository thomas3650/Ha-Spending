import { addDays, addMonths, firstOfMonth } from "@ha-spending/shared";
import type { SeedData, SeedRule, SeedSplit, SeedSubscription } from "./seed-types";

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
const CREDIT_LINE = "Kassekredit";

const INCOME_AND_TRANSFERS = "Penge ind og ud";
const FIXED_COSTS = "Faste udgifter";
const SUBSCRIPTIONS_GROUP = "Abonnementer";

/** Main group → its categories, and where and how much the money goes. */
const SPENDING: Record<string, Record<string, { shops: string[]; min: number; max: number }>> = {
  Mad: {
    Dagligvarer: { shops: ["Netto", "Rema 1000", "Føtex"], min: 150, max: 1200 },
    "Spisesteder og takeaway ude": { shops: ["Pizzeria Roma", "Sushi Bar"], min: 250, max: 900 },
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
  const withdrawal = (
    date: string,
    source: string,
    destination: string | undefined,
    amount: string,
    category?: string,
    subscription?: string,
    description = destination ?? "",
  ) =>
    add({ type: "withdrawal", date, amount, description, source, ...(destination ? { destination } : {}),
      ...(category ? { category } : {}), ...(subscription ? { subscription } : {}) });

  for (let m = startMonth; m <= year * 12 + month - 1; m++) {
    const first = firstOfMonth(Math.floor(m / 12), (m % 12) + 1);
    const last = addDays(firstOfMonth(Math.floor(m / 12), (m % 12) + 2), -1);
    const day = (d: number) => addDays(first, d - 1);
    const anyDay = () => day(between(1, 28));

    withdrawal(day(1), JOINT, "Udlejer", "9500.00", "Husleje", "Husleje");
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
    for (const member of ["Anna", "Bo"]) {
      add({ type: "deposit", date: day(2), amount: member === "Anna" ? "15000.00" : "12000.00",
        description: `Indskud fra ${member}`, source: member, destination: JOINT, category: "Indskud" });
    }
    if (m % 4 === 2) {
      add({ type: "deposit", date: day(14), amount: "2500.00", description: "Ekstra indskud fra Bo", source: "Bo",
        destination: JOINT, category: "Indskud" });
    }
    if (m % 3 === 0) withdrawal(day(18), JOINT, "Anna", "1800.00", "Indskud");
    if (m % 4 === 0) {
      add({ type: "transfer", date: day(10), amount: "3000.00", description: "Træk på kassekreditten",
        source: CREDIT_LINE, destination: JOINT });
    }
    if (m % 4 === 1 && m > startMonth) {
      add({ type: "transfer", date: day(10), amount: "3000.00", description: "Betaling af kassekreditten",
        source: JOINT, destination: CREDIT_LINE });
    }
    withdrawal(day(20), JOINT, "Billån", "2500.00");
    if (m % 6 === 0) withdrawal(day(15), JOINT, "Kommunen", kroner(1500, 2500), "Ejendomsskat");

    for (let date = day(between(1, 4)); date <= last; date = addDays(date, 7)) {
      const shop = pick(["Netto", "Rema 1000", "Føtex"]);
      withdrawal(date, BUDGET, shop, kroner(300, 1200), "Dagligvarer", undefined, `Dankort ${shop.toUpperCase()}`);
    }

    for (let i = between(10, 16); i > 0; i--) {
      const c = pick(randomCategories);
      withdrawal(anyDay(), pick([BUDGET, CARD]), pick(c.shops), kroner(c.min, c.max), c.category);
    }
    for (let i = between(1, 3); i > 0; i--) {
      const small = pick(["Kiosken", "MobilePay"]);
      withdrawal(anyDay(), CARD, small === "Kiosken" ? small : undefined, kroner(20, 300), undefined, undefined, small);
    }
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

  const firstMonth = firstOfMonth(Math.floor(startMonth / 12), (startMonth % 12) + 1);
  // Each one's last payment is placed relative to today, so every status shows on any day.
  const subscriptions: SeedSubscription[] = [
    { name: "Husleje", amountMin: "9500.00", amountMax: "9500.00", start: firstMonth, repeat: "monthly",
      objectGroup: FIXED_COSTS },
  ];
  // Each starts on its first payment, so the months it was paid in show it.
  const recurring = (
    sub: Omit<SeedSubscription, "start">,
    shop: string,
    category: string,
    payments: { date: string; amount: string }[],
  ) => {
    subscriptions.push({ ...sub, start: payments.map((p) => p.date).reduce((a, b) => (a < b ? a : b)) });
    for (const p of payments) withdrawal(p.date, BUDGET, shop, p.amount, category, sub.name);
  };
  const monthsBack = (date: string, amounts: string[]) =>
    amounts.map((amount, i) => ({ date: addMonths(date, -i), amount }));
  const soon = (days: number) => addMonths(addDays(options.today, days), -1);

  recurring({ name: "Netflix", amountMin: "99.00", amountMax: "129.00", repeat: "monthly",
    objectGroup: SUBSCRIPTIONS_GROUP }, "Netflix", "Streaming",
    monthsBack(soon(3), ["119.00", "119.00", "99.00"]));
  recurring({ name: "Mobilabonnement", amountMin: "149.00", amountMax: "199.00", repeat: "monthly",
    objectGroup: FIXED_COSTS }, "Teleselskabet", "Mobil", monthsBack(soon(1), ["179.00", "179.00"]));
  recurring({ name: "Fitnessabonnement", amountMin: "249.00", amountMax: "299.00", repeat: "monthly",
    objectGroup: SUBSCRIPTIONS_GROUP }, "Sportsklubben", "Sport",
    monthsBack(soon(-2), ["279.00", "279.00"]));
  recurring({ name: "Spotify", amountMin: "99.00", amountMax: "119.00", repeat: "monthly",
    objectGroup: SUBSCRIPTIONS_GROUP },
    "Spotify", "Streaming",
    monthsBack(addDays(options.today, -10), ["149.00", "109.00", "109.00"]));
  recurring({ name: "Alarmselskabet", amountMin: "450.00", amountMax: "550.00", repeat: "quarterly",
    objectGroup: FIXED_COSTS },
    "Forsikringsselskabet", "Forsikring", [
      { date: addMonths(options.today, -4), amount: "495.00" },
      { date: addMonths(options.today, -7), amount: "495.00" },
    ]);
  recurring({ name: "Indboforsikring", amountMin: "2800.00", amountMax: "3400.00", repeat: "yearly",
    objectGroup: FIXED_COSTS },
    "Forsikringsselskabet", "Forsikring", [
      { date: addMonths(options.today, -3), amount: "3100.00" },
    ]);
  recurring({ name: "Madkasse", amountMin: "250.00", amountMax: "350.00", repeat: "weekly",
    objectGroup: FIXED_COSTS },
    "Netto", "Dagligvarer",
    [1, 8, 15, 22].map((back) => ({ date: addDays(options.today, -back), amount: "299.00" })));
  recurring({ name: "Havehjælp", amountMin: "700.00", amountMax: "900.00", repeat: "monthly", skip: 1 },
    "Byggemarkedet", "Vedligehold", [
      { date: addDays(options.today, -40), amount: "800.00" },
      { date: addMonths(addDays(options.today, -40), -2), amount: "800.00" },
    ]);

  // Three bills for the fixed list's ended and yearly cases; all dates are relative to today.
  const thisMonth = firstOfMonth(year, month);
  const monthlyUpTo = (dayOfMonth: number, end: string, name: string, shop: string, category: string, amount: string) => {
    for (let m = startMonth; m <= year * 12 + month - 1; m++) {
      const date = addDays(firstOfMonth(Math.floor(m / 12), (m % 12) + 1), dayOfMonth - 1);
      if (date <= end) withdrawal(date, BUDGET, shop, amount, category, name);
    }
  };
  const aviserEnd = addDays(addMonths(thisMonth, -1), -1);
  subscriptions.push({ name: "Avisabonnement", amountMin: "149.00", amountMax: "149.00", start: firstMonth,
    end: aviserEnd, repeat: "monthly", objectGroup: FIXED_COSTS });
  monthlyUpTo(1, aviserEnd, "Avisabonnement", "Avisen", "Streaming", "149.00");
  const journalEnd = addDays(addMonths(thisMonth, -1), 14);
  subscriptions.push({ name: "Tidsskrift", amountMin: "89.00", amountMax: "89.00", start: firstMonth,
    end: journalEnd, repeat: "monthly", objectGroup: SUBSCRIPTIONS_GROUP });
  monthlyUpTo(3, journalEnd, "Tidsskrift", "Avisen", "Streaming", "89.00");
  const roadside = addDays(addMonths(thisMonth, -5), 9);
  recurring({ name: "Vejhjælp", amountMin: "1195.00", amountMax: "1195.00", repeat: "yearly",
    objectGroup: FIXED_COSTS }, "Forsikringsselskabet", "Forsikring",
    [{ date: roadside, amount: "1195.00" }]);

  transactions.sort((a, b) => (a.splits[0].date < b.splits[0].date ? -1 : a.splits[0].date > b.splits[0].date ? 1 : 0));

  return {
    accounts: [JOINT, BUDGET, CARD, CREDIT_LINE].map((name) => ({ name, active: true })),
    otherAccounts: [{ name: "Billån", type: "liabilities", active: true }],
    categories,
    subscriptions,
    ruleGroups: [{ title: "Hovedgrupper", rules }],
    transactions,
  };
}
