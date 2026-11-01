import type { Grouping, Preset, Repeat } from "@ha-spending/shared";
import type { Sort } from "../state/view";

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
  } satisfies Record<Preset, string>,
  custom: "Vælg periode …",
  customLabel: "Valgt periode",
  from: "Fra",
  to: "Til",
  show: "Vis",
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
  barsHint: (g: Grouping) => `klik på en søjle for kun ${da.groupings[g].definite}`,
  circleHintAll: "Klik på et stykke eller et navn for at gå til hovedgruppen.",
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
  postingsHint: (g: Grouping) => `Grupperet pr. ${da.groupings[g].one}, som "Gruppér pr.".`,
  postingOne: "postering",
  postingMany: "posteringer",
  search: 'Søg i butik og tekst, fx "Netto"',
  searchLabel: "Søg",
  shopChip: (name: string) => `Butik: ${name}`,
  shopOption: (name: string, sum: string) => `${name}, ${sum}`,
  suggestions: "Butikker",
  sort: "Sortér",
  sorts: {
    newest: "Nyeste først",
    oldest: "Ældste først",
    largest: "Største først",
    smallest: "Mindste først",
  } satisfies Record<Sort, string>,
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

  periodClosed: (label: string, range: string) => `${label} · ${range}`,

  subscriptionsPerYear: "Abonnementer om året",
  subscriptionCount: (n: number) => `${n} ${n === 1 ? "abonnement" : "abonnementer"}`,
  subscriptions: "Abonnementer",
  subscriptionsIn: (name: string) => `Abonnementer i ${name}`,
  perYear: (value: string) => `${value} om året`,
  subscriptionColumns: {
    name: "Abonnement",
    amount: "Beløb",
    perYear: "Om året",
    status: "Status",
  },
  nextOn: (date: string) => `næste ${date}`,
  noSubscriptions: (name: string) => `Ingen abonnementer i ${name}`,
  subscriptionsFoot:
    "Fra Firefly III. Beløbet er midten af abonnementets beløbsinterval. Om året er det regnet om til et år.",
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
