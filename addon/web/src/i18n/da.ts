import type { Grouping, Preset, Repeat } from "@ha-spending/shared";

interface GroupingTexts {
  label: string;
  one: string;
  many: string;
  definite: string;
  average: string;
}

export const da = {
  title: "Forbrug",
  kr: "kr.",
  months: ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],

  allSpending: "Alt forbrug",
  noMainGroup: "Uden hovedgruppe",
  noCategory: "Uden kategori",
  allPostings: "Alle posteringer",
  trail: "Sti",

  period: "Periode",
  presets: {
    thisMonth: "Denne måned",
    lastMonth: "Sidste måned",
    last3Months: "Sidste 3 måneder",
    last12Months: "Sidste 12 måneder",
    thisYear: "I år",
    lastYear: "Sidste år",
    all: "Alt",
  } satisfies Record<Preset, string>,
  customLabel: "Valgt periode",
  from: "Fra",
  to: "Til",
  show: "Vis",
  datePlaceholder: "dd.mm.åååå",
  picked: (from: string, to: string | null) => (to === null ? `Startdag ${from}, vælg en slutdag` : `Fra ${from} til ${to}`),
  /** Vanilla Calendar Pro's locale; the weekdays start on Sunday, as the library wants. */
  calendarLocale: {
    months: {
      long: [
        "januar",
        "februar",
        "marts",
        "april",
        "maj",
        "juni",
        "juli",
        "august",
        "september",
        "oktober",
        "november",
        "december",
      ],
      short: ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
    },
    weekdays: {
      long: ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"],
      short: ["sø", "ma", "ti", "on", "to", "fr", "lø"],
    },
  },
  calendar: {
    application: "Kalender",
    navigation: "Skift måned og år",
    arrowNext: { month: "Næste måned", year: "Senere år" },
    arrowPrev: { month: "Forrige måned", year: "Tidligere år" },
    month: "Vælg måned, nu:",
    months: "Måneder",
    year: "Vælg år, nu:",
    years: "År",
    week: "Ugedage",
    dates: "Dage",
  },
  groupBy: "Gruppér pr.",
  accounts: "Konti",
  allAccounts: "Alle konti",
  allAccountsCount: (n: number) => `Alle konti (${n})`,
  someAccounts: (ticked: number, of: number) => `${ticked} af ${of} konti`,
  noAccounts: "Ingen konti",

  groupings: {
    day: {
      label: "Dag",
      one: "dag",
      many: "dage",
      definite: "den dag",
      average: "en gennemsnitlig dag",
    },
    week: {
      label: "Uge",
      one: "uge",
      many: "uger",
      definite: "den uge",
      average: "en gennemsnitlig uge",
    },
    month: {
      label: "Måned",
      one: "måned",
      many: "måneder",
      definite: "den måned",
      average: "en gennemsnitlig måned",
    },
    quarter: {
      label: "Kvartal",
      one: "kvartal",
      many: "kvartaler",
      definite: "det kvartal",
      average: "et gennemsnitligt kvartal",
    },
    year: {
      label: "År",
      one: "år",
      many: "år",
      definite: "det år",
      average: "et gennemsnitligt år",
    },
  } satisfies Record<Grouping, GroupingTexts>,
  against: "mod",
  quarterAxis: (quarter: number) => `K${quarter}`,

  spendingInPeriod: "Forbrug i perioden",
  inPeriod: (name: string) => `${name} i perioden`,
  shareOfAll: (p: string) => `${p} af alt forbrug`,
  shareOf: (p: string, name: string) => `${p} af ${name}`,
  averagePer: (g: Grouping) => `Gennemsnit pr. ${da.groupings[g].one}`,
  unitCount: (n: number, g: Grouping) => `${n} ${n === 1 ? da.groupings[g].one : da.groupings[g].many}`,
  averageBefore: (n: number, g: Grouping) =>
    n === 12 ? `gns. de 12 ${da.groupings[g].many} før` : `gns. af ${da.unitCount(n, g)} før`,
  noDataBefore: "ingen data før perioden",
  noData: (name: string) => `ingen data for ${name}`,
  unitTotal: (name: string) => `${name} i alt`,
  levelInUnit: (level: string, name: string) => `${level} i ${name.toLowerCase()}`,
  vsAverage: "Mod gennemsnittet",
  vsAverageSub: (diff: string, avg: string, g: Grouping) => `${diff} mod ${avg} pr. ${da.groupings[g].one}`,
  up: "▲",
  down: "▼",
  none: "–",

  mainGroups: "Hovedgrupper",
  categories: "Kategorier",
  inUnit: (heading: string, name: string) => `${heading} i ${name.toLowerCase()}`,
  per: (g: Grouping) => `Pr. ${da.groupings[g].one}`,
  levelPer: (name: string, g: Grouping) => `${name} pr. ${da.groupings[g].one}`,
  postingsOf: (name: string) => `${name}: posteringer`,
  postingsTitle: "Posteringer",
  bars: "Søjler",
  postings: "Posteringer",
  difference: "Forskel",
  view: "Visning",
  fullScreen: "Fuld skærm",
  circleHintGroup: "Klik på en kategori for kun den.",
  chosenHint: (name: string) => `Klik på det valgte stykke igen, eller på ✕, for hele ${name}.`,
  inProgress: "i gang",
  average: (amount: string) => `gennemsnit ${amount}`,
  remove: (name: string) => `Fjern ${name}`,
  noPiece: "Uden stykke i cirklen",

  columns: {
    unitAndDate: (g: Grouping) => `${da.groupings[g].label} / dato`,
    text: "Butik / tekst",
    category: "Kategori",
    account: "Konto",
    amount: "Beløb",
  },
  showOlder: "Vis ældre",
  showNewer: "Vis nyere",
  showMore: "Vis flere",
  showAll: "Vis alle",
  postingOne: "postering",
  postingMany: "posteringer",
  search: 'Søg i butik og tekst, fx "Netto"',
  searchLabel: "Søg",
  shopChip: (name: string) => `Butik: ${name}`,
  shopOption: (name: string, sum: string) => `${name}, ${sum}`,
  suggestions: "Butikker",
  addFilter: "+ Filter",
  mainGroupChip: (name: string) => `Hovedgruppe: ${name}`,
  categoryChip: (name: string) => `Kategori: ${name}`,
  amountFilter: "Beløb",
  amountChip: (min: string | null, max: string | null) => {
    if (min !== null && max !== null) return `Beløb: ${min}–${max} ${da.kr}`;
    if (min !== null) return `Beløb: fra ${min} ${da.kr}`;
    return `Beløb: til ${max ?? ""} ${da.kr}`;
  },
  add: "Tilføj",
  summary: (count: string, sum: string) => `${count} · ${sum}`,

  noSpending: "Ingen forbrug i perioden",
  noMatch: "Ingen posteringer passer til filtrene",
  errors: {
    unreachable: "Firefly III svarer ikke, så tallene vises ikke.",
    refused: "Firefly III afviser nøglen, så tallene vises ikke.",
    failed: "Siden kunne ikke hente tallene, så de vises ikke.",
  },
  noRuleGroup: "Firefly III har ingen regelgruppe til hovedgrupperne, så alt forbrug står under Uden hovedgruppe.",
  loading: "Henter tallene …",

  differenceTitle: (name: string, g: Grouping) => `${name} mod ${da.groupings[g].average}`,
  differenceTitleBefore: (name: string) => `${name} mod gennemsnittet før`,
  less: "◀ mindre end normalt",
  more: "mere end normalt ▶",
  differenceHint: "Orange: mere end gennemsnittet; blå: mindre.",

  shops: "Butikker",
  shopsIn: (name: string) => `Butikker i ${name}`,
  hide: "Skjul",
  hideShop: (name: string) => `Skjul ${name}`,
  showShop: (name: string) => `Vis ${name}`,
  showAllShops: (n: number) => `Vis alle ${n}`,
  showFewer: "Vis færre",
  showHidden: (n: number, sum: string) => `Vis skjulte (${n} · ${sum})`,
  hideHidden: "Skjul skjulte",
  noShop: (sum: string) => `Uden butik: ${sum}`,
  noShops: "Ingen butikker at vise",
  share: (p: number) => `${p} %`,

  periodClosed: (label: string, range: string) => `${label} · ${range}`,

  perMonth: (value: string) => `${value} pr. måned`,
  billCount: (n: number) => `${n} stk.`,
  noPayments: "ingen betalinger",
  postingsLink: (counted: string) => `${counted} →`,
  subscriptionCount: (n: number) => `${n} ${n === 1 ? "fast udgift" : "faste udgifter"}`,
  subscriptions: "Faste udgifter",
  subscriptionsIn: (name: string) => `Faste udgifter i ${name}`,
  perYear: (value: string) => `${value} om året`,
  subscriptionColumns: {
    name: "Fast udgift",
    category: "Kategori",
    amount: "Beløb",
    perYear: "Om året",
    status: "Status",
  },
  nextOn: (date: string) => `næste ${date}`,
  noSubscriptions: (name: string) => `Ingen faste udgifter i ${name}`,
  subscriptionsFoot:
    "Fra Firefly III. Beløbet er midten af den faste udgifts beløbsinterval. Om året er det regnet om til et år.",
  status: {
    notSeen: (date: string) => `Ikke set · ventet ${date}`,
    risen: (max: string, paid: string) => `Steget · ${max} → ${paid} ${da.kr}`,
    expected: (date: string | null) => (date === null ? "Forventes ikke" : `Forventes ${date}`),
    paid: (date: string) => `Betalt ${date}`,
  },
  repeatText: (repeat: Repeat, skip: number): string => {
    const n = skip + 1;
    switch (repeat) {
      case "weekly":
        return skip === 0 ? "pr. uge" : `hver ${n}. uge`;
      case "monthly":
        return skip === 0 ? "pr. måned" : `hver ${n}. måned`;
      case "quarterly":
        return skip === 0 ? "pr. kvartal" : `hvert ${n}. kvartal`;
      case "half-year":
        return skip === 0 ? "pr. halvår" : `hver ${6 * n}. måned`;
      case "yearly":
        return skip === 0 ? "om året" : `hvert ${n}. år`;
    }
  },
};
