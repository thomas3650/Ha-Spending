import {
  type Account,
  fetchRange,
  groupingFor,
  type HiddenShopChange,
  localToday,
  type Period,
  type SpendingData,
  unitsOf,
} from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";

import "./components/accounts-picker";
import { amountPillStyles } from "./components/amount-pill";
import { dropdownStyles } from "./components/dropdown";
import { keyNumbersStyles } from "./components/key-numbers";
import { barsStyles, type UnitSelection } from "./components/bars";
import { type CircleSelection, circleStyles } from "./components/circle";
import { detailStyles } from "./components/detail";
import { fixedBarsStyles } from "./components/fixed-bars";
import { fixedListStyles } from "./components/fixed-list";
import { objectGroupMenuStyles } from "./components/object-group-menu";
import { levelMenuStyles } from "./components/level-menu";
import { calendarStyles, periodPickerStyles } from "./components/period-picker";
import { postingsStyles } from "./components/postings";
import { sortHeaderStyles } from "./components/sort-header";
import { searchStyles } from "./components/search";
import { shopsStyles } from "./components/shops";
import { subscriptionsStyles } from "./components/subscriptions";
import { type CategoryChoice, type LevelLists, topCardStyles } from "./components/top-card";
import { type UnitStep, unitMenuStyles } from "./components/unit-menu";
import { LoadError, type LoadErrorCode, loadData, loadHiddenShops, setHiddenShop } from "./data/api";
import { unitName } from "./format";
import { da } from "./i18n/da";
import type { AmountFilter } from "./model/amount";
import { levelRows, unitRows } from "./model/circle";
import { finerUnits, type ViewContext, viewContext } from "./model/context";
import { type FixedView, fixedUnits, fixedView, objectGroupStep } from "./model/fixed";
import { fixedList } from "./model/fixed-list";
import { keyCards, type KeyLink, objectGroupCards } from "./model/key-numbers";
import { shownColumns, shownPostingSort } from "./model/postings";
import type { HiddenState } from "./model/shops";
import { DEFAULT_SUBSCRIPTION_SORT, shownSubscriptionSort, subscriptionFirstDescending } from "./model/subscriptions";
import "./screens/fixed";
import { fixedStyles } from "./screens/fixed";
import "./screens/overview";
import { overviewStyles } from "./screens/overview";
import {
  chooseShop,
  chooseUnit,
  clearQuickFilter,
  closeDetail,
  detailResolves,
  keepDetail,
  normalise,
  openDetail,
  openPart,
  chooseFixedUnit,
  leaveFixed,
  openFixed,
  openPostingsFull,
  openShop,
  setObjectGroup,
  removeCategory,
  removeMainGroup,
  removeShop,
  removeUnit,
  setAccounts,
  setAmount,
  setCard,
  setCategory,
  setFixedFull,
  setFullScreen,
  setMainGroup,
  setPeriod,
  setSearch,
} from "./state/actions";
import {
  type Card,
  DEFAULT_POSTING_SORT,
  DEFAULT_STATE,
  type DetailKey,
  type FixedCard,
  nextSort,
  parseHash,
  type PeriodChoice,
  periodOf,
  type PostingColumn,
  postingFirstDescending,
  type Sort,
  type Sorted,
  type SubscriptionColumn,
  toHash,
  type ViewState,
} from "./state/view";
import { card, chip, field, objectGroupMark, theme } from "./theme";

type QuickFilter = Pick<ViewState, "search" | "shop" | "amount">;

type Load =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: SpendingData }
  | { kind: "error"; code: LoadErrorCode };

/** Marks the history entry that opening a detail pushed, so closing knows it may go back (spec §5). */
const DETAIL_ENTRY = { detail: true };
/** Marks the entry that opening full screen pushed; a detail pushed right over it says so (top-filter spec §3.2). */
const FULL_ENTRY = { full: true };
const DETAIL_OVER_FULL = { detail: true, overFull: true };
/** Marks the entry that opening the fixed-expenses view pushed, so leaving it may go back (spec §2). */
const FIXED_ENTRY = { fixed: true };
/**
 * Marks the entry that opening the view's full screen pushed (spec §3.5); one pushed right over the view's open says so.
 * A mark of its own, so the overview's full-screen checks never take it for theirs.
 */
const FIXED_FULL_ENTRY = { fixedFull: true };
const FIXED_FULL_OVER_FIXED = { fixedFull: true, overFixed: true };

interface Marks {
  detail?: unknown;
  full?: unknown;
  overFull?: unknown;
  fixed?: unknown;
  fixedFull?: unknown;
  overFixed?: unknown;
  /** The full-screen open's quick filter, so a close can tell whether it changed in full screen. */
  quick?: unknown;
}

function quickKey(s: QuickFilter): string {
  return toHash({ ...DEFAULT_STATE, search: s.search, shop: s.shop, amount: s.amount });
}

function marks(): Marks {
  const state: unknown = history.state;
  return typeof state === "object" && state !== null ? state : {};
}

function detailEntry(): boolean {
  return marks().detail === true;
}

/**
 * A change made in place leaves the entry what its push made it, so a later close can still go back past it. A choice
 * such as typing drops the detail's mark, so closing the detail replaces and keeps that choice, as D44 does.
 */
function replaceKeepingMarks(hash: string, detail: "keep" | "drop"): void {
  const { detail: open, ...rest } = marks();
  const kept = detail === "keep" && open === true ? { ...rest, detail: true } : rest;
  history.replaceState(Object.keys(kept).length === 0 ? null : kept, "", hash);
}

function sameRange(a: Period, b: Period): boolean {
  return a.start === b.start && a.end === b.end;
}

export class SpendingApp extends LitElement {
  static override properties = {
    state: { state: true },
    today: { state: true },
    load: { state: true },
    accounts: { state: true },
    earliest: { state: true },
    postingsSort: { state: true },
    subscriptionsSort: { state: true },
    shopsAll: { state: true },
    shopsHidden: { state: true },
    hiddenShops: { state: true },
    hiddenWriteFailed: { state: true },
  };

  static override styles = [
    theme,
    card,
    chip,
    objectGroupMark,
    field,
    dropdownStyles,
    amountPillStyles,
    periodPickerStyles,
    calendarStyles,
    topCardStyles,
    levelMenuStyles,
    objectGroupMenuStyles,
    unitMenuStyles,
    keyNumbersStyles,
    circleStyles,
    barsStyles,
    postingsStyles,
    detailStyles,
    sortHeaderStyles,
    searchStyles,
    subscriptionsStyles,
    shopsStyles,
    overviewStyles,
    fixedBarsStyles,
    fixedListStyles,
    fixedStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        box-sizing: border-box;
        background: var(--hs-bg);
        color: var(--hs-text);
        font-family: var(--hs-font);
      }
      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }
      .page {
        padding: 24px 28px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .line {
        margin: 0;
      }
      .alert {
        border-color: var(--hs-up);
        color: var(--hs-up);
      }
      .status {
        color: var(--hs-muted);
      }
      .halves {
        display: grid;
        grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
        gap: 14px;
        align-items: start;
      }
      .halves.single {
        grid-template-columns: minmax(0, 1fr);
      }
      .half {
        min-height: 320px;
      }
      .half[aria-busy="true"] {
        background: linear-gradient(var(--hs-soft), var(--hs-soft)) 16px 16px / 40% 14px no-repeat,
          linear-gradient(var(--hs-soft), var(--hs-soft)) 16px 52px / calc(100% - 32px) calc(100% - 68px) no-repeat,
          var(--hs-card);
      }
      .empty {
        margin: 0;
        color: var(--hs-muted);
      }
      .half:has(.empty) {
        min-height: 0;
      }
      /* Full screen's bars reach the window's bottom edge (D67). The boxes down to the chart keep min-height: 0, so
         the chart's last pixel size never holds the page open when the window gets lower. */
      .page:has(.half.fill) {
        min-height: 100vh;
      }
      .page:has(.half.fill) > hs-overview,
      .page:has(.half.fill) > hs-fixed {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
      }
      .halves:has(> .half.fill) {
        flex: 1 1 auto;
        min-height: 0;
        align-items: stretch;
      }
      .half.fill {
        display: flex;
        flex-direction: column;
      }
      @media (max-width: 1279px) {
        .halves {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
      }
      @media (max-width: 1023px) {
        .halves {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];

  declare state: ViewState;
  declare today: string;
  declare load: Load;
  /** The last answer's accounts; null until the first answer. */
  declare accounts: Account[] | null;
  /** The last answer's earliest posting date; undefined until the first answer. */
  declare earliest: string | null | undefined;
  /** The Posteringer card's sort, kept here because the card is made anew when the right card switches (D37). */
  declare private postingsSort: Sort;
  declare private subscriptionsSort: Sorted<SubscriptionColumn>;
  /** Butikker's "Vis alle" and "Vis skjulte" are held here like the sorts: not in the hash (D40). */
  declare private shopsAll: boolean;
  declare private shopsHidden: boolean;
  /** Read once at start, beside the data and not waiting for it, so Butikker never shows a hidden shop (spec §3). */
  declare private hiddenShops: HiddenState;
  declare private hiddenWriteFailed: boolean;

  private asked: Period | null = null;
  /** The key-number boxes of the last row drawn, so the placeholder keeps the row's shape. */
  private boxes = 2;
  private request = 0;
  private controller: AbortController | null = null;
  private hiddenAsked = false;
  private writes: Promise<void> = Promise.resolve();
  /** The detail a close or Back just closed, whose row gets the focus back after the render. */
  private closed: DetailKey | null = null;
  /** Full screen or the fixed-expenses view ended, so the focus may have lost its element. */
  private leftScreen = false;
  /** The fixed-expenses view began or its full screen changed, so the element that had the focus may be gone. */
  private enteredFixed = false;
  private headingAfterBack = false;
  /** Set by a row's click only: a link, a reload or full screen leave the focus where it is. */
  private openedByRow = false;
  /** Back is async: until its popstate, history.state still shows the entry being left. */
  private backPending = false;
  /** An open or a close asked for while a Back was pending, run once that Back has landed. */
  private afterBack: (() => void) | null = null;
  /** The quick filter a full-screen close had, put back on the entry its Back lands on, so none of it is lost. */
  private quickOnLanding: QuickFilter | null = null;

  constructor() {
    super();
    this.state = parseHash("");
    this.today = localToday(new Date());
    this.load = { kind: "idle" };
    this.accounts = null;
    this.earliest = undefined;
    this.postingsSort = DEFAULT_POSTING_SORT;
    this.subscriptionsSort = DEFAULT_SUBSCRIPTION_SORT;
    this.shopsAll = false;
    this.shopsHidden = false;
    this.hiddenShops = { kind: "loading" };
    this.hiddenWriteFailed = false;
  }

  private readonly onHash = (): void => {
    const next = parseHash(location.hash);
    if (toHash(next) === toHash(this.state)) return;
    const prev = this.state;
    const same = prev.card === next.card && prev.fullScreen === next.fullScreen;
    if (prev.detail !== null && next.detail === null && same) {
      this.closed = prev.detail;
    }
    this.change(next);
  };

  private readonly onPop = (): void => {
    this.backPending = false;
    this.onHash();
    if (this.headingAfterBack) {
      this.headingAfterBack = false;
      this.leftScreen = true;
      this.requestUpdate();
    }
    const quick = this.quickOnLanding;
    this.quickOnLanding = null;
    if (quick !== null) this.keepQuickFilter(quick);
    const after = this.afterBack;
    this.afterBack = null;
    after?.();
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (this.state.detail !== null) this.closeDetail();
    else if (this.state.fullScreen) this.closeFullScreen();
    else if (this.state.fixedFull !== null) this.closeFixedFull();
    else if (this.state.fixed) this.closeFixed();
  };

  private readonly onDetailOpen = (event: Event): void => {
    const next = openDetail(this.state, (event as CustomEvent<DetailKey>).detail);
    if (this.load.kind !== "ready" || !detailResolves(next, this.load.data, this.today)) return;
    if (this.backPending) {
      this.afterBack = () => this.onDetailOpen(event);
      return;
    }
    const hash = `#${toHash(next)}`;
    const entry = marks();
    const pushed = entry.full === true ? { ...DETAIL_OVER_FULL, quick: entry.quick } : DETAIL_ENTRY;
    if (this.state.detail === null) history.pushState(pushed, "", hash);
    else replaceKeepingMarks(hash, "keep");
    this.openedByRow = true;
    this.change(next);
  };

  private readonly onDetailClose = (): void => this.closeDetail();

  /**
   * Back lands on the entry before the open, which holds the same state without the detail. The state is set at once,
   * since Back is async: a second close before popstate then finds no detail instead of going back twice.
   */
  private closeDetail(): void {
    if (this.state.detail === null) return;
    this.closed = this.state.detail;
    const next = closeDetail(this.state);
    if (this.backPending) {
      this.afterBack = () => this.closeDetail();
      this.change(next);
      return;
    }
    if (detailEntry()) {
      if (this.besideList()) this.keepScrollOnBack();
      this.change(next);
      this.goBack(1);
      return;
    }
    replaceKeepingMarks(`#${toHash(next)}`, "keep");
    this.change(next);
  }

  /**
   * ⤢, or "N posteringer →" with `open` set to openPostingsFull. A push before a pending Back lands would go onto the
   * entry being left, so it waits for the landing and builds from the landed state.
   */
  private openFullScreen(open: (s: ViewState) => ViewState = (s) => setFullScreen(s, true)): void {
    if (this.backPending) {
      this.afterBack = () => this.openFullScreen(open);
      return;
    }
    if (this.state.fullScreen) return;
    const next = open(this.state);
    history.pushState({ ...FULL_ENTRY, quick: quickKey(next) }, "", `#${toHash(next)}`);
    this.change(next);
  }

  /**
   * Goes back past the open when the entry's marks say it is the full-screen open, or one detail open pushed right
   * over it, so Back does not reopen it; otherwise replaces (top-filter spec §3.2). The marks live in history.state, so
   * an open from before a reload counts too. The state is set at once, as closeDetail does. The landed entry takes the
   * quick filter only when it changed in full screen, so a search the link cleared comes back.
   */
  private closeFullScreen(): void {
    if (!this.state.fullScreen) return;
    const off = setFullScreen(this.state, false);
    if (this.backPending) {
      this.afterBack = () => this.closeFullScreen();
      this.change(off);
      return;
    }
    const entry = marks();
    if (entry.full === true || entry.overFull === true) {
      const quick = { search: off.search, shop: off.shop, amount: off.amount };
      this.quickOnLanding = entry.quick === quickKey(quick) ? null : quick;
      this.change(entry.full === true ? off : closeDetail(off));
      this.headingAfterBack = true;
      this.goBack(entry.full === true ? 1 : 2);
      return;
    }
    const next = closeDetail(off);
    history.replaceState(null, "", `#${toHash(next)}`);
    this.change(next);
  }

  /** "Vis faste udgifter →". Like openFullScreen, a push waits for a pending Back to land. */
  private openFixed(objectGroup: string): void {
    if (this.backPending) {
      this.afterBack = () => this.openFixed(objectGroup);
      return;
    }
    if (this.state.fixed) return;
    const next = openFixed(this.state, objectGroup);
    history.pushState(FIXED_ENTRY, "", `#${toHash(next)}`);
    this.change(next);
  }

  /**
   * ← and Escape go back past the open when the entry is the one the open pushed, or the view's full-screen open pushed
   * right over it, so Back does not reopen the view; after any push in the view they replace (spec §2, §3.5). The state
   * is set at once, as closeFullScreen does.
   */
  private closeFixed(): void {
    if (!this.state.fixed) return;
    const off = leaveFixed(this.state);
    if (this.backPending) {
      this.afterBack = () => this.closeFixed();
      this.change(off);
      return;
    }
    const entry = marks();
    if (entry.overFixed === true || entry.fixed === true) {
      this.change(off);
      this.goBack(entry.overFixed === true ? 2 : 1);
      return;
    }
    history.replaceState(null, "", `#${toHash(off)}`);
    this.change(off);
  }

  /** A card's full-screen button in the view. Like openFixed, a push waits for a pending Back to land. */
  private openFixedFull(card: FixedCard): void {
    if (this.backPending) {
      this.afterBack = () => this.openFixedFull(card);
      return;
    }
    if (!this.state.fixed || this.state.fixedFull !== null) return;
    const next = setFixedFull(this.state, card);
    history.pushState(marks().fixed === true ? FIXED_FULL_OVER_FIXED : FIXED_FULL_ENTRY, "", `#${toHash(next)}`);
    this.change(next);
  }

  /**
   * Goes back past the open when the entry is the one the open pushed, so Back does not reopen full screen; otherwise
   * replaces, keeping the entry's marks (spec §3.5). The state is set at once, as closeFullScreen does.
   */
  private closeFixedFull(): void {
    if (this.state.fixedFull === null) return;
    const off = setFixedFull(this.state, null);
    if (this.backPending) {
      this.afterBack = () => this.closeFixedFull();
      this.change(off);
      return;
    }
    if (marks().fixedFull === true) {
      this.change(off);
      this.goBack(1);
      return;
    }
    replaceKeepingMarks(`#${toHash(off)}`, "drop");
    this.change(off);
  }

  private keepQuickFilter(quick: QuickFilter): void {
    const next = { ...this.state, ...quick };
    const hash = toHash(next);
    if (hash === toHash(this.state)) return;
    replaceKeepingMarks(`#${hash}`, "drop");
    this.change(next);
  }

  private goBack(steps: 1 | 2): void {
    this.backPending = true;
    if (steps === 1) history.back();
    else history.go(-2);
  }

  /**
   * Back restores the scroll of the entry before the open (spec §2.1), which in a split would move the list. Only this
   * close keeps it: elsewhere Back's restore is wanted. The restore comes after popstate, hence the frame's wait.
   */
  private keepScrollOnBack(): void {
    const y = window.scrollY;
    window.addEventListener("popstate", () => requestAnimationFrame(() => window.scrollTo(0, y)), { once: true });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("hashchange", this.onHash);
    window.addEventListener("popstate", this.onPop);
    window.addEventListener("keydown", this.onKey);
    this.addEventListener("detail-open", this.onDetailOpen);
    this.addEventListener("detail-close", this.onDetailClose);
    this.change(parseHash(location.hash));
    this.readHiddenShops();
  }

  private readHiddenShops(): void {
    if (this.hiddenAsked) return;
    this.hiddenAsked = true;
    loadHiddenShops().then(
      (shops) => (this.hiddenShops = { kind: "ready", shops }),
      () => (this.hiddenShops = { kind: "error" }),
    );
  }

  /**
   * Not a view choice, so no history entry (spec §3); the row moves only once the server answers. Each write waits for
   * the one before, so every answer holds the earlier writes and is applied as it comes.
   */
  private onShopHide(event: CustomEvent<HiddenShopChange>): void {
    const { shop, hidden } = event.detail;
    this.writes = this.writes.then(() =>
      setHiddenShop(shop, hidden).then(
        (shops) => {
          this.hiddenShops = { kind: "ready", shops };
          this.hiddenWriteFailed = false;
        },
        () => {
          this.hiddenWriteFailed = true;
        },
      ),
    );
  }

  override disconnectedCallback(): void {
    window.removeEventListener("hashchange", this.onHash);
    window.removeEventListener("popstate", this.onPop);
    window.removeEventListener("keydown", this.onKey);
    this.removeEventListener("detail-open", this.onDetailOpen);
    this.removeEventListener("detail-close", this.onDetailClose);
    this.request += 1;
    this.controller?.abort();
    this.controller = null;
    this.asked = null;
    super.disconnectedCallback();
  }

  protected override updated(): void {
    if (this.leftScreen) {
      this.leftScreen = false;
      void this.focusHeadingIfLost();
    }
    if (this.enteredFixed && this.load.kind === "ready") {
      this.enteredFixed = false;
      void this.focusFixedIfLost();
    }
    if (this.openedByRow) {
      this.openedByRow = false;
      void this.focusDetail();
    }
    const key = this.closed;
    if (key === null) return;
    this.closed = null;
    void this.focusRow(key);
  }

  /** The element that had the focus may be gone after full screen ends; the focus must not fall to the body. */
  private async focusHeadingIfLost(): Promise<void> {
    const root = this.renderRoot;
    await root.querySelector<LitElement>("hs-overview")?.updateComplete;
    if (this.shadowRoot?.activeElement) return;
    root.querySelector<HTMLElement>("#hs-right-title")?.focus();
  }

  private async focusFixedIfLost(): Promise<void> {
    const root = this.renderRoot;
    await root.querySelector<LitElement>("hs-fixed")?.updateComplete;
    if (this.shadowRoot?.activeElement) return;
    const heading = this.state.fixedFull === "list" ? "#hs-fixed-list-title" : "#hs-fixed-bars-title";
    root.querySelector<HTMLElement>(heading)?.focus();
  }

  private async focusDetail(): Promise<void> {
    const root = this.renderRoot;
    await root.querySelector<LitElement>("hs-overview")?.updateComplete;
    root.querySelector<HTMLElement>("hs-detail h3")?.focus({ preventScroll: this.besideList() });
  }

  /** In a split of 1024 px or wider the detail stands beside the list, so a focus must not scroll the page. */
  private besideList(): boolean {
    return this.state.fullScreen && window.matchMedia("(min-width: 1024px)").matches;
  }

  /** The row's button when its list shows it, else the card's heading (detail spec §1.3). */
  private async focusRow(key: DetailKey): Promise<void> {
    const root = this.renderRoot;
    await root.querySelector<LitElement>("hs-overview")?.updateComplete;
    const wanted = `${key.kind === "subscription" ? "s" : "p"}:${key.id}`;
    const button = [...root.querySelectorAll<HTMLElement>("[data-detail]")].find(
      (b) => b.getAttribute("data-detail") === wanted,
    );
    const heading = root.querySelector<HTMLElement>("#hs-right-title");
    (button ?? heading)?.focus({ preventScroll: this.besideList() });
  }

  /** pushState and replaceState fire no event, so the state is set here. A new card closes the detail. */
  apply(choice: ViewState, mode: "push" | "replace"): void {
    const next = keepDetail(this.state, choice);
    const hash = toHash(next);
    if (mode === "replace") replaceKeepingMarks(`#${hash}`, "drop");
    else if (hash !== toHash(this.state)) history.pushState(null, "", `#${hash}`);
    this.change(next);
  }

  private change(next: ViewState): void {
    if ((this.state.fullScreen && !next.fullScreen) || (this.state.fixed && !next.fixed)) this.leftScreen = true;
    // A page load leaves the focus where it is. A card goes away when the view begins or its full screen changes.
    const fullChanged = this.state.fixed && next.fixed && this.state.fixedFull !== next.fixedFull;
    if (this.hasUpdated && ((!this.state.fixed && next.fixed) || fullChanged)) this.enteredFixed = true;
    this.state = next;
    this.ensureData();
    this.normaliseState();
  }

  private wantedRange(): Period {
    const period = periodOf(this.state.period, this.today, this.earliest ?? null);
    return fetchRange(period, groupingFor(period), this.today);
  }

  private ensureData(): void {
    const range = this.wantedRange();
    if (this.load.kind !== "error" && this.asked !== null && sameRange(this.asked, range)) return;
    this.fetchData(range, false);
  }

  private fetchData(range: Period, retry: boolean): void {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const id = ++this.request;
    this.asked = range;
    this.load = { kind: "loading" };
    loadData(range, controller.signal).then(
      (data) => {
        if (id === this.request) this.onAnswer(data, retry);
      },
      (error: unknown) => {
        if (id !== this.request || controller.signal.aborted) return;
        this.load = { kind: "error", code: error instanceof LoadError ? error.code : "failed" };
      },
    );
  }

  /**
   * The add-on's today and the earliest posting date can change the wanted range, so a user-started fetch asks once
   * more when they do; a retry's answer is shown as it is.
   */
  private onAnswer(data: SpendingData, retry: boolean): void {
    this.accounts = data.accounts;
    this.earliest = data.earliestPostingDate;
    if (!retry) {
      this.today = data.today;
      const range = this.wantedRange();
      if (!sameRange(range, data.range)) {
        this.fetchData(range, true);
        return;
      }
    }
    this.load = { kind: "ready", data };
    this.normaliseState();
  }

  private normaliseState(): void {
    if (this.load.kind !== "ready") return;
    const next = normalise(this.state, this.load.data, this.today);
    if (toHash(next) !== toHash(this.state)) this.apply(next, "replace");
  }

  private onPeriod(event: CustomEvent<PeriodChoice>): void {
    this.apply(setPeriod(this.state, event.detail), "push");
  }

  private onAccounts(event: CustomEvent<string[]>): void {
    const all = (this.accounts ?? []).map((a) => a.id);
    this.apply(setAccounts(this.state, event.detail, all), "push");
  }

  private onSearch(event: CustomEvent<string>): void {
    this.apply(setSearch(this.state, event.detail), "replace");
  }

  private onShopChoose(event: CustomEvent<string>): void {
    this.apply(chooseShop(this.state, event.detail), "push");
  }

  /** Backspace edits the search as typing does, so it replaces the history entry (D20). */
  private onShopRemove(event: CustomEvent<"click" | "key">): void {
    this.apply(removeShop(this.state), event.detail === "key" ? "replace" : "push");
  }

  private onQuickClear(): void {
    this.push(clearQuickFilter(this.state));
    void this.focusSearch();
  }

  private async focusSearch(): Promise<void> {
    await this.updateComplete;
    const overview = this.renderRoot.querySelector<LitElement>("hs-overview");
    await overview?.updateComplete;
    this.renderRoot.querySelector<HTMLElement>("hs-search input")?.focus();
  }

  private push(next: ViewState): void {
    this.apply(next, "push");
  }

  private loadingHalves() {
    const single = this.oneCard();
    return html`<div class="halves ${single ? "single" : ""}">
      ${(single ? [0] : [0, 1]).map(
        () => html`<section class="card half" role="region" aria-busy="true" aria-label=${da.loading}></section>`,
      )}
    </div>`;
  }

  private onKeyLink(event: CustomEvent<KeyLink>): void {
    const link = event.detail;
    if (link.kind === "postings") this.openFullScreen(openPostingsFull);
    else this.openFixed(link.objectGroup);
  }

  /** The overview's or the view's full screen: one card and no key numbers. */
  private oneCard(): boolean {
    return this.state.fullScreen || this.state.fixedFull !== null;
  }

  private keyNumbers(ctx: ViewContext) {
    const cards = keyCards(ctx, `#${toHash(openPostingsFull(this.state))}`);
    const objectGroups = objectGroupCards(ctx, (group) => `#${toHash(openFixed(this.state, group))}`);
    this.boxes = cards.length + objectGroups.length;
    return html`<hs-key-numbers
      .cards=${cards}
      .objectGroups=${objectGroups}
      @key-link=${this.onKeyLink}
    ></hs-key-numbers>`;
  }

  private postingSort(column: PostingColumn): void {
    const columns = shownColumns(this.state.fullScreen, this.state.detail !== null);
    this.postingsSort = nextSort(shownPostingSort(this.postingsSort, columns), column, postingFirstDescending);
  }

  private ready(ctx: ViewContext) {
    return html`
      ${ctx.data.mainGroupsFound ? nothing : html`<p class="card line status" role="status">${da.noRuleGroup}</p>`}
      ${this.state.fullScreen ? nothing : this.keyNumbers(ctx)}
        <hs-overview
          .ctx=${ctx}
          .postingsSort=${this.postingsSort}
          .subscriptionsSort=${this.subscriptionsSort}
          .hiddenShops=${this.hiddenShops}
          .hiddenWriteFailed=${this.hiddenWriteFailed}
          .shopsAll=${this.shopsAll}
          .shopsHidden=${this.shopsHidden}
          @posting-sort=${(e: CustomEvent<PostingColumn>) => this.postingSort(e.detail)}
          @subscription-sort=${(e: CustomEvent<SubscriptionColumn>) =>
            (this.subscriptionsSort = nextSort(
              shownSubscriptionSort(this.subscriptionsSort, this.state.level.kind),
              e.detail,
              subscriptionFirstDescending,
            ))}
          @full-screen-toggle=${() => (this.state.fullScreen ? this.closeFullScreen() : this.openFullScreen())}
          @shops-all-toggle=${() => (this.shopsAll = !this.shopsAll)}
          @shops-hidden-toggle=${() => (this.shopsHidden = !this.shopsHidden)}
          @shop-hide=${this.onShopHide}
          @shop-open=${(e: CustomEvent<string>) => this.push(openShop(this.state, e.detail))}
          @part-click=${(e: CustomEvent<CircleSelection>) => this.push(openPart(this.state, e.detail.key))}
          @unit-click=${(e: CustomEvent<UnitSelection>) => this.push(chooseUnit(this.state, e.detail.fullStart))}
          @card-change=${(e: CustomEvent<Card>) => this.push(setCard(this.state, e.detail))}
          @search-input=${this.onSearch}
          @shop-choose=${this.onShopChoose}
          @shop-remove=${this.onShopRemove}
          @quick-clear=${this.onQuickClear}
          @amount-change=${(e: CustomEvent<AmountFilter | null>) => this.push(setAmount(this.state, e.detail))}
        ></hs-overview>
    `;
  }

  /** The view's own cards stand where the overview's key numbers do (spec §4). */
  private fixedScreen(ctx: ViewContext, view: FixedView) {
    this.boxes = view.cards.length;
    const step = objectGroupStep(view.groups, this.state.objectGroup);
    const oneGroup = this.state.objectGroup !== null || step.single;
    return html`
      ${ctx.data.mainGroupsFound ? nothing : html`<p class="card line status" role="status">${da.noRuleGroup}</p>`}
      ${this.state.fixedFull === null
        ? html`<hs-key-numbers .cards=${view.cards} .objectGroups=${[]}></hs-key-numbers>`
        : nothing}
      <hs-fixed
        .view=${view}
        .list=${fixedList(view, view.chosen, { full: this.state.fixedFull === "list", oneGroup })}
        .groupTitle=${step.title}
        .full=${this.state.fixedFull}
        @unit-click=${(e: CustomEvent<UnitSelection>) => this.push(chooseFixedUnit(this.state, e.detail.fullStart))}
        @fixed-full-toggle=${(e: CustomEvent<FixedCard>) =>
          this.state.fixedFull === null ? this.openFixedFull(e.detail) : this.closeFixedFull()}
      ></hs-fixed>
    `;
  }

  /** The trail's × moves the focus to its heading, so the keyboard does not fall back to the page's start. */
  private removeFromTrail(next: ViewState): void {
    this.push(next);
    void this.focusHeading();
  }

  private async focusHeading(): Promise<void> {
    await this.updateComplete;
    const top = this.renderRoot.querySelector<LitElement>("hs-top-card");
    await top?.updateComplete;
    this.renderRoot.querySelector<HTMLElement>("hs-top-card h1")?.focus();
  }

  private body(ctx: ViewContext | null, view: FixedView | null) {
    switch (this.load.kind) {
      case "error":
        return html`<p class="card line alert" role="alert">${da.errors[this.load.code]}</p>`;
      case "ready":
        if (ctx === null) return nothing;
        return view === null ? this.ready(ctx) : this.fixedScreen(ctx, view);
      default:
        return html`${this.oneCard()
            ? nothing
            : html`<hs-key-numbers .cards=${null} .boxes=${this.boxes}></hs-key-numbers>`}
          ${this.loadingHalves()}`;
    }
  }

  /** Before the answer the period alone says whether its bars are buttons: one month draws its days (D59). */
  private unitStep(ctx: ViewContext | null, view: FixedView | null): UnitStep | null {
    if (view !== null) return view.unitStep;
    if (ctx === null && this.state.fixed) {
      const f = fixedUnits({ earliestPostingDate: this.earliest ?? null }, this.state, this.today);
      return f.buttons ? { word: f.grouping === "year" ? "year" : "month", rows: null, chosen: null } : null;
    }
    if (ctx === null) {
      const period = periodOf(this.state.period, this.today, this.earliest ?? null);
      const word = groupingFor(period);
      return unitsOf(period, word, this.today).length === 1 ? null : { word, rows: null, chosen: null };
    }
    if (finerUnits(ctx) !== null) return null;
    return {
      word: groupingFor(ctx.timeline.period),
      rows: unitRows(ctx),
      chosen: ctx.chosen === null ? null : unitName(ctx.chosen, ctx.timeline.grouping, ctx.unitYear),
    };
  }

  override render() {
    const ctx = this.load.kind === "ready" ? viewContext(this.load.data, this.state, this.today) : null;
    const view = ctx !== null && this.state.fixed ? fixedView(ctx) : null;
    const lists: LevelLists | null =
      ctx === null ? null : { mainGroup: levelRows(ctx, "mainGroup"), category: levelRows(ctx, "category") };
    return html`<main class="page">
      <hs-top-card
        .state=${this.state}
        .today=${this.today}
        .accounts=${this.accounts}
        .earliest=${this.earliest}
        .unitStep=${this.unitStep(ctx, view)}
        .lists=${lists}
        .fixed=${this.state.fixed}
        .objectGroups=${view?.groups ?? null}
        .objectGroupStep=${objectGroupStep(view?.groups ?? null, this.state.objectGroup)}
        @hs-period=${this.onPeriod}
        @hs-accounts=${this.onAccounts}
        @set-main-group=${(e: CustomEvent<string | null>) => this.push(setMainGroup(this.state, e.detail))}
        @set-category=${(e: CustomEvent<CategoryChoice>) =>
          this.push(setCategory(this.state, e.detail.mainGroup, e.detail.category))}
        @set-unit=${(e: CustomEvent<string>) =>
          this.push((this.state.fixed ? chooseFixedUnit : chooseUnit)(this.state, e.detail))}
        @set-object-group=${(e: CustomEvent<string | null>) => this.push(setObjectGroup(this.state, e.detail))}
        @back=${() => this.closeFixed()}
        @remove-unit=${() => this.removeFromTrail(removeUnit(this.state))}
        @remove-main-group=${() => this.removeFromTrail(removeMainGroup(this.state))}
        @remove-category=${() => this.removeFromTrail(removeCategory(this.state))}
      ></hs-top-card>
      ${this.body(ctx, view)}
    </main>`;
  }
}

if (!customElements.get("hs-app")) customElements.define("hs-app", SpendingApp);

declare global {
  interface HTMLElementTagNameMap {
    "hs-app": SpendingApp;
  }
}
