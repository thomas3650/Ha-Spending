import type { Grouping, Preset, Repeat } from "@ha-spending/shared";
import { aboutBounds, type AmountFilter, type AmountKind, amountText } from "../model/amount";
import type { Column } from "../model/left-over";

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
  trail: "Sti",
  /** Without a range while "Alt"'s dates are not known yet. */
  periodStep: (name: string, range: string | null) => (range === null ? `Periode: ${name}` : `Periode: ${name}, ${range}`),
  switchMainGroup: (name: string) => `Skift hovedgruppe: ${name}`,
  switchCategory: (name: string) => `Skift kategori: ${name}`,
  chooseMainGroup: "Vælg hovedgruppe",
  chooseCategory: "Vælg kategori",
  mainGroupStep: "Hovedgruppe",
  categoryStep: "Kategori",
  switchMonth: (name: string) => `Skift måned: ${name}`,
  switchYear: (name: string) => `Skift år: ${name}`,
  chooseMonth: "Vælg måned",
  chooseYear: "Vælg år",
  monthStep: "Måned",
  yearStep: "År",
  units: "Enheder",
  switchObjectGroup: (name: string) => `Skift objektgruppe: ${name}`,
  allFixed: "Alle faste udgifter",
  all: "Alle",
  objectGroups: "Objektgrupper",
  billsInPeriod: (n: number, sum: string) => `${n} stk. · ${sum} i perioden`,

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
  dateInvalid: "Skriv en dato som 31.12.2026",
  dateFuture: "Datoen er efter i dag",
  dateOrder: "Til er før Fra",
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
    month: {
      label: "Måned",
      one: "måned",
      many: "måneder",
      definite: "den måned",
      average: "en gennemsnitlig måned",
    },
    year: {
      label: "År",
      one: "år",
      many: "år",
      definite: "det år",
      average: "et gennemsnitligt år",
    },
  } satisfies Record<Grouping, GroupingTexts>,

  spendingInPeriod: "Forbrug i perioden",
  inPeriod: (name: string) => `${name} i perioden`,
  shareOfAll: (p: string) => `${p} af alt forbrug`,
  shareOf: (p: string, name: string) => `${p} af ${name}`,
  averagePer: (g: Grouping) => `Gennemsnit pr. ${da.groupings[g].one}`,
  unitCount: (n: number, g: Grouping) => `${n} ${n === 1 ? da.groupings[g].one : da.groupings[g].many}`,
  averageBefore: (n: number, g: Grouping) =>
    n === 12 ? `gns. de 12 ${da.groupings[g].many} før` : `gns. af ${da.unitCount(n, g)} før`,
  noDataBefore: "ingen data før perioden",
  unitTotal: (name: string) => `${name} i alt`,
  inUnitLine: (name: string) => `i ${name.toLowerCase()}`,
  levelInUnit: (level: string, name: string) => `${level} i ${name.toLowerCase()}`,
  none: "–",

  mainGroups: "Hovedgrupper",
  categories: "Kategorier",
  inUnit: (heading: string, name: string) => `${heading} i ${name.toLowerCase()}`,
  per: (g: Grouping) => `Pr. ${da.groupings[g].one}`,
  levelPer: (name: string, g: Grouping) => `${name} pr. ${da.groupings[g].one}`,
  postingsOf: (name: string) => `${name}: posteringer`,
  postingsTitle: "Posteringer",
  bars: "Søjler",
  refundMark: "retur",
  postings: "Posteringer",
  view: "Visning",
  fullScreen: "Fuld skærm",
  fullScreenOf: (title: string) => `Fuld skærm: ${title}`,
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
  postingOne: "postering",
  postingMany: "posteringer",
  search: 'Søg i butik og tekst, fx "Netto"',
  searchLabel: "Søg",
  shopChip: (name: string) => `Butik: ${name}`,
  shopRowName: (name: string, sum: string) => `${name}, ${sum}`,
  shopOption: (name: string, count: string, sum: string) => `${name}, ${count}, ${sum}`,
  suggestions: "Butikker",
  amountInvalid: "Skriv et beløb som 1.000,50",
  amountEmpty: "Beløb",
  filterAmount: "Filtrér på beløb",
  amountKinds: {
    about: "Omkring",
    under: "Under",
    over: "Over",
    between: "Mellem",
  } satisfies Record<AmountKind, string>,
  amountHints: {
    about: "±20 %",
    between: "to beløb",
  } satisfies Partial<Record<AmountKind, string>>,
  amountKindsLabel: "Beløbstyper",
  amountKindButton: "Vælg beløbstype",
  amountMin: "Mindste beløb",
  amountMax: "Største beløb",
  removeAmount: "Fjern beløb",
  amountShort: (filter: AmountFilter): string => {
    switch (filter.kind) {
      case "about":
        return `omkring ${amountText(filter.value)} ${da.kr}`;
      case "under":
        return `under ${amountText(filter.value)} ${da.kr}`;
      case "over":
        return `over ${amountText(filter.value)} ${da.kr}`;
      case "between":
        return `${amountText(filter.min)}–${amountText(filter.max)} ${da.kr}`;
    }
  },
  /** The sentence over the list spells out Omkring's ends; the pill's name does not. */
  amountWords: (filter: AmountFilter): string => {
    if (filter.kind !== "about") return da.amountShort(filter);
    const { min, max } = aboutBounds(filter.value);
    return `${da.amountShort(filter)} (${amountText(min)}–${amountText(max)} ${da.kr})`;
  },
  amountName: (filter: AmountFilter | null): string =>
    filter === null ? da.amountEmpty : `${da.amountEmpty}: ${da.amountShort(filter)}`,
  summary: (count: string, sum: string) => `${count} · ${sum}`,
  /** With no hit the sum is empty and goes. */
  showing: (shown: string, all: string, sum: string, parts: string) =>
    `Viser ${shown} af ${all}${sum === "" ? "" : ` · ${sum}`} — ${parts}`,
  searchPart: (text: string) => `"${text}"`,
  clearQuick: "Ryd",

  noSpending: "Ingen forbrug i perioden",
  noMatch: "Ingen posteringer passer til filtrene",
  errors: {
    unreachable: "Firefly III svarer ikke, så tallene vises ikke.",
    refused: "Firefly III afviser nøglen, så tallene vises ikke.",
    failed: "Siden kunne ikke hente tallene, så de vises ikke.",
  },
  noRuleGroup: "Firefly III har ingen regelgruppe til hovedgrupperne, så alt forbrug står under Uden hovedgruppe.",
  loading: "Henter tallene …",

  shops: "Butikker",
  shopsIn: (name: string) => `Butikker i ${name}`,
  hide: "Skjul",
  hideShop: (name: string) => `Skjul ${name}`,
  showShop: (name: string) => `Vis ${name}`,
  showAllShops: (n: number) => `Vis alle ${n}`,
  showAllN: (n: number) => `Vis alle ${n}`,
  showFewer: "Vis færre",
  showHidden: (n: number, sum: string) => `Vis skjulte (${n} · ${sum})`,
  hideHidden: "Skjul skjulte",
  noShop: (sum: string) => `Uden butik: ${sum}`,
  noShops: "Ingen butikker at vise",
  fetching: "Henter …",
  hiddenUnreadable: "Skjulte butikker kunne ikke hentes.",
  saveFailed: "Kunne ikke gemme. Prøv igen.",

  perMonth: (value: string) => `${value} pr. måned`,
  billCount: (n: number) => `${n} stk.`,
  noPayments: "ingen betalinger",
  noPaymentsCount: (n: number) => `${da.noPayments} · ${da.billCount(n)}`,
  notInSum: (end: string) => `Ikke med i summen: sluttet ${end}`,
  postingsLink: (counted: string) => `${counted} →`,
  showSubscriptions: "Vis faste udgifter",
  subscriptionCount: (n: number) => `${n} ${n === 1 ? "fast udgift" : "faste udgifter"}`,
  perYear: (value: string) => `${value} om året`,
  objectGroupSums: (title: string) => `${title} om året`,
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
    "Fra Firefly III. Beløbet er midten af den faste udgifts beløbsinterval, eller den seneste betaling, når den er steget. Om året er det regnet om til et år.",
  status: {
    notSeen: (date: string) => `Ikke set · ventet ${date}`,
    risen: (max: string, paid: string) => `Steget · ${max} → ${paid} ${da.kr}`,
    expected: (date: string | null) => (date === null ? "Forventes ikke" : `Forventes ${date}`),
    paid: (date: string) => `Betalt ${date}`,
    due: (date: string) => `Forfalden ${date}`,
    next: (date: string) => `Næste ${date}`,
    ended: (date: string) => `Sluttet ${date}`,
  },
  fixed: {
    /** Before an estimate's amount. */
    about: "ca.",
    estimated: (amount: string) => `ca. ${amount}`,
    payments: (n: number) => `${n} ${n === 1 ? "betaling" : "betalinger"}`,
    paidThisYear: "Betalt i år",
    paidInPeriod: "Betalt i perioden",
    paidTotal: "Betalt i alt",
    paidIn: (name: string) => `Betalt i ${name}`,
    remaining: "Resterende udgifter",
    estimateFor: (name: string) => `Estimat for hele ${name}`,
    perMonthEstimate: "Estimat pr. måned",
    averagePerMonth: "Gennemsnit pr. måned",
    nextPayment: "Næste betaling",
    notSeenCount: (n: number) => `${n} ikke set`,
    paymentsUntil: (payments: string, date: string) => `${payments} til ${date}`,
    paidPlus: (estimate: string, date: string) => `betalt + ca. ${estimate} til ${date}`,
    yearSplit: (year: string) => `hele ${year} delt med 12`,
    nextOn: (date: string, name: string) => `${date} · ${name}`,
    noMoreIn: (name: string) => `ingen flere i ${name}`,
    hatched: "Skraveret: estimat",
    dueOutline: "Rød kant: forfalden",
    todayMark: "i dag",
    tooltipTotal: (sums: string) => `I alt: ${sums}`,
    partLine: (name: string, sums: string) => `${name}: ${sums}`,
    dueMark: " · forfalden",
    others: (n: number, sums: string) => `${n} andre: ${sums}`,
    noPaymentsTip: "Ingen betalinger",
    /** The other columns are `subscriptionColumns`' name, category, amount and status. */
    dateColumn: "Dato",
    barPaid: (unit: string, paid: string) => `${unit}: betalt ${paid}`,
    barMixed: (unit: string, paid: string, estimate: string) => `${unit}: betalt ${paid}, estimat ca. ${estimate}`,
    barEstimate: (unit: string, estimate: string) => `${unit}: estimat ca. ${estimate}`,
    barNone: (unit: string) => `${unit}: ingen betalinger`,
    sum: (paid: string, estimate: string) => `${paid} + ca. ${estimate}`,
    inPeriod: "Poster i perioden",
    summaryPaid: (paid: string) => `betalt ${paid}`,
    summaryEstimate: (estimate: string) => `estimat ca. ${estimate}`,
    summaryTotal: (total: string) => `i alt ca. ${total}`,
    allEstimates: "estimat",
    /** One word: the row's Dato holds the date (fixed view full screen spec §2.1). */
    status: {
      paid: "Betalt",
      expected: "Forventes",
      due: "Forfalden",
      notSeen: "Ikke set",
    },
    nameInGroup: (name: string, objectGroup: string) => `${name} · ${objectGroup}`,
    ofWhichEstimates: (n: number, next: string) => `heraf ${n} estimat, næste forventes ${next}`,
    ofWhichDue: (n: number, date: string) => `heraf ${n} estimat, forfalden ${date}`,
    noMoreUntil: (date: string) => `ingen flere til ${date}`,
    emptyIn: (level: string, unit: string) => `Ingen faste udgifter i ${da.levelInUnit(level, unit)}`,
    empty: (level: string) => `Ingen faste udgifter i ${level} i perioden`,
  },
  leftOver: {
    name: "Til overs",
    /** The chosen unit's name, or null for the whole period. */
    label: (unit: string | null) =>
      unit === null ? da.inPeriod(da.leftOver.name) : da.levelInUnit(da.leftOver.name, unit),
    showMonths: "Vis måneder",
    paidInSub: (amount: string) => `ind ${amount}`,
    borrowedSub: (amount: string) => `, lånt ${amount}`,
    monthColumn: "Måned",
    columns: {
      paidIn: "Ind",
      back: "Tilbage",
      spending: "Forbrug",
      leftOver: "Til overs",
      credit: "Kreditten",
      savings: "Opsparing",
      other: "Øvrigt",
      change: "Ændring på konti",
    } satisfies Record<Column, string>,
    running: "(i gang)",
    total: "I alt",
    borrowed: "lånt",
    paidOff: "betalt af",
    table: "Til overs pr. måned",
    /** The cells carry no "kr.", so the table says it once. */
    note: "Alle beløb i kr.",
    allAccountsNote: "Til overs regner på alle konti",
    wholePeriodNote: "Til overs viser hele perioden måned for måned",
  },
  backTo: (title: string) => `Tilbage til ${title}`,
  close: "Luk",
  shopContext: "Butik",
  detailInPeriod: "I perioden",
  detailPer: (g: Grouping) => `Pr. ${da.groupings[g].one} i perioden`,
  noDetailRows: "Ingen posteringer i perioden",
  openInFirefly: "Åbn i Firefly III",
  noAccount: "–",

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
