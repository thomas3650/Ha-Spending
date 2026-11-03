import {
  type Account,
  fetchRange,
  type Grouping,
  type HiddenShopChange,
  localToday,
  type Period,
  type SpendingData,
} from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";

import "./components/accounts-picker";
import { dropdownStyles } from "./components/dropdown";
import { keyNumbersStyles } from "./components/key-numbers";
import { barsStyles, type UnitSelection } from "./components/bars";
import { type CircleSelection, circleStyles } from "./components/circle";
import { detailStyles } from "./components/detail";
import { differenceStyles } from "./components/difference";
import { calendarStyles, periodPickerStyles } from "./components/period-picker";
import { postingsStyles } from "./components/postings";
import { sortHeaderStyles } from "./components/sort-header";
import { searchStyles } from "./components/search";
import { shopsStyles } from "./components/shops";
import { subscriptionsStyles } from "./components/subscriptions";
import { topCardStyles } from "./components/top-card";
import { LoadError, type LoadErrorCode, loadData, loadHiddenShops, setHiddenShop } from "./data/api";
import { da } from "./i18n/da";
import { type ViewContext, viewContext } from "./model/context";
import { keyCards, objectGroupCards } from "./model/key-numbers";
import type { HiddenState } from "./model/shops";
import { DEFAULT_SUBSCRIPTION_SORT, shownSubscriptionSort, subscriptionFirstDescending } from "./model/subscriptions";
import { allPostingsStyles, type CategoryChoice } from "./screens/all-postings";
import "./screens/overview";
import { overviewStyles } from "./screens/overview";
import {
  chooseShop,
  chooseUnit,
  closeDetail,
  keepDetail,
  normalise,
  openAllPostings,
  openAllPostingsFresh,
  openDetail,
  openObjectGroupPostings,
  openPart,
  openShop,
  removeCategory,
  removeMainGroup,
  removeShop,
  removeUnit,
  setAccounts,
  setAmount,
  setCard,
  setCategory,
  setGrouping,
  setMainGroup,
  setObjectGroup,
  setPeriod,
  setSearch,
  setSort,
  toggleSubscriptions,
} from "./state/actions";
import {
  type AmountRange,
  type Card,
  DEFAULT_STATE,
  type DetailKey,
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

type Load =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: SpendingData }
  | { kind: "error"; code: LoadErrorCode };

/** Marks the history entry that opening a detail pushed, so closing knows it may go back (spec §5). */
const DETAIL_ENTRY = { detail: true };

function detailEntry(): boolean {
  return (history.state as { detail?: unknown } | null)?.detail === true;
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
    fullScreen: { state: true },
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
    periodPickerStyles,
    calendarStyles,
    topCardStyles,
    keyNumbersStyles,
    circleStyles,
    barsStyles,
    differenceStyles,
    postingsStyles,
    detailStyles,
    sortHeaderStyles,
    searchStyles,
    subscriptionsStyles,
    shopsStyles,
    overviewStyles,
    allPostingsStyles,
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
        padding: 16px 20px;
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
  /** A layout setting of this page load, so it stays out of the view state and the hash. */
  declare private fullScreen: boolean;
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
  /** The key-number boxes of the last answer, so the placeholder keeps the row's shape. */
  private boxes = 3;
  private request = 0;
  private controller: AbortController | null = null;
  private hiddenAsked = false;
  private writes: Promise<void> = Promise.resolve();
  /** The detail a close or Back just closed, whose row gets the focus back after the render. */
  private closed: DetailKey | null = null;
  /** Set by a row's click only: a link, a reload or full screen leave the focus where it is. */
  private openedByRow = false;

  constructor() {
    super();
    this.state = parseHash("");
    this.today = localToday(new Date());
    this.load = { kind: "idle" };
    this.accounts = null;
    this.earliest = undefined;
    this.fullScreen = false;
    this.postingsSort = DEFAULT_STATE.sort;
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
    if (prev.detail !== null && next.detail === null && prev.card === next.card && prev.screen === next.screen) {
      this.closed = prev.detail;
    }
    this.change(next);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (this.state.detail !== null) this.closeDetail();
    else if (this.fullScreen && this.state.screen === "overview") this.fullScreen = false;
  };

  private readonly onDetailOpen = (event: Event): void => {
    const next = openDetail(this.state, (event as CustomEvent<DetailKey>).detail);
    const hash = `#${toHash(next)}`;
    if (this.state.detail === null) history.pushState(DETAIL_ENTRY, "", hash);
    else history.replaceState(detailEntry() ? DETAIL_ENTRY : null, "", hash);
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
    if (detailEntry()) {
      this.change(next);
      history.back();
      return;
    }
    history.replaceState(null, "", `#${toHash(next)}`);
    this.change(next);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("hashchange", this.onHash);
    window.addEventListener("popstate", this.onHash);
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
    window.removeEventListener("popstate", this.onHash);
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
    if (this.openedByRow) {
      this.openedByRow = false;
      void this.focusDetail();
    }
    const key = this.closed;
    if (key === null) return;
    this.closed = null;
    void this.focusRow(key);
  }

  private async focusDetail(): Promise<void> {
    const root = this.renderRoot;
    await root.querySelector<LitElement>("hs-overview, hs-all-postings")?.updateComplete;
    root.querySelector<HTMLElement>("hs-detail h3")?.focus();
  }

  /** The row's button when its list shows it, else the heading of the card or the page (detail spec §1.3). */
  private async focusRow(key: DetailKey): Promise<void> {
    const root = this.renderRoot;
    await root.querySelector<LitElement>("hs-overview, hs-all-postings")?.updateComplete;
    const wanted = `${key.kind === "subscription" ? "s" : "p"}:${key.id}`;
    const button = [...root.querySelectorAll<HTMLElement>("[data-detail]")].find(
      (b) => b.getAttribute("data-detail") === wanted,
    );
    const heading = root.querySelector<HTMLElement>(
      this.state.screen === "overview" ? "#hs-right-title" : "hs-top-card h1",
    );
    (button ?? heading)?.focus();
  }

  /** pushState and replaceState fire no event, so the state is set here. A new card or screen closes the detail. */
  apply(choice: ViewState, mode: "push" | "replace"): void {
    const next = keepDetail(this.state, choice);
    const hash = toHash(next);
    if (mode === "replace") history.replaceState(null, "", `#${hash}`);
    else if (hash !== toHash(this.state)) history.pushState(null, "", `#${hash}`);
    this.change(next);
  }

  private change(next: ViewState): void {
    this.state = next;
    this.ensureData();
    this.normaliseState();
  }

  private wantedRange(): Period {
    return fetchRange(periodOf(this.state.period, this.today, this.earliest ?? null), this.state.grouping, this.today);
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
    const ctx = viewContext(data, this.state, this.today);
    this.boxes = keyCards(ctx, "").length + objectGroupCards(ctx, () => "").length;
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

  private onGrouping(event: CustomEvent<Grouping>): void {
    this.apply(setGrouping(this.state, event.detail), "push");
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

  private push(next: ViewState): void {
    this.apply(next, "push");
  }

  private loadingHalves() {
    const single = this.fullScreen;
    return html`<div class="halves ${single ? "single" : ""}">
      ${(single ? [0] : [0, 1]).map(
        () => html`<section class="card half" role="region" aria-busy="true" aria-label=${da.loading}></section>`,
      )}
    </div>`;
  }

  private objectGroupKeys(ctx: ViewContext) {
    const cards = objectGroupCards(
      ctx,
      (t) => `#${toHash(keepDetail(this.state, openObjectGroupPostings(this.state, t)))}`,
    );
    if (cards.length === 0) return null;
    return { cards, toggle: ctx.data.subscriptions.length > 0, pressed: this.state.card === "subscriptions" };
  }

  private ready(ctx: ViewContext) {
    const overview = this.state.screen === "overview";
    return html`
      ${ctx.data.mainGroupsFound ? nothing : html`<p class="card line status" role="status">${da.noRuleGroup}</p>`}
      ${overview
        ? html`${this.fullScreen
              ? nothing
              : html`<hs-key-numbers
                  .cards=${keyCards(ctx, `#${toHash(keepDetail(this.state, openAllPostingsFresh(this.state)))}`)}
                  .objectGroups=${this.objectGroupKeys(ctx)}
                  @subscriptions-toggle=${() => this.push(toggleSubscriptions(this.state))}
                ></hs-key-numbers>`}
            <hs-overview
              .ctx=${ctx}
              .fullScreen=${this.fullScreen}
              .postingsSort=${this.postingsSort}
              .subscriptionsSort=${this.subscriptionsSort}
              .hiddenShops=${this.hiddenShops}
              .hiddenWriteFailed=${this.hiddenWriteFailed}
              .shopsAll=${this.shopsAll}
              .shopsHidden=${this.shopsHidden}
              @posting-sort=${(e: CustomEvent<PostingColumn>) =>
                (this.postingsSort = nextSort(this.postingsSort, e.detail, postingFirstDescending))}
              @subscription-sort=${(e: CustomEvent<SubscriptionColumn>) =>
                (this.subscriptionsSort = nextSort(
                  shownSubscriptionSort(this.subscriptionsSort, this.state.level.kind),
                  e.detail,
                  subscriptionFirstDescending,
                ))}
              @full-screen-toggle=${() => (this.fullScreen = !this.fullScreen)}
              @shops-all-toggle=${() => (this.shopsAll = !this.shopsAll)}
              @shops-hidden-toggle=${() => (this.shopsHidden = !this.shopsHidden)}
              @shop-hide=${this.onShopHide}
              @shop-open=${(e: CustomEvent<string>) => this.push(openShop(this.state, e.detail))}
              @part-click=${(e: CustomEvent<CircleSelection>) => this.push(openPart(this.state, e.detail.key))}
              @unit-click=${(e: CustomEvent<UnitSelection>) => this.push(chooseUnit(this.state, e.detail.fullStart))}
              @card-change=${(e: CustomEvent<Card>) => this.push(setCard(this.state, e.detail))}
              @remove-unit=${() => this.push(removeUnit(this.state))}
              @remove-category=${() => this.push(removeCategory(this.state))}
              @open-all-postings=${() => this.push(openAllPostings(this.state))}
              @search-input=${this.onSearch}
              @shop-choose=${this.onShopChoose}
              @shop-remove=${this.onShopRemove}
            ></hs-overview>`
        : html`<hs-all-postings
            .ctx=${ctx}
            @search-input=${this.onSearch}
            @shop-choose=${this.onShopChoose}
            @shop-remove=${this.onShopRemove}
            @sort-change=${(e: CustomEvent<Sort>) => this.push(setSort(this.state, e.detail))}
            @remove-main-group=${() => this.push(removeMainGroup(this.state))}
            @remove-category=${() => this.push(removeCategory(this.state))}
            @remove-unit=${() => this.push(removeUnit(this.state))}
            @set-amount=${(e: CustomEvent<AmountRange | null>) => this.push(setAmount(this.state, e.detail))}
            @set-object-group=${(e: CustomEvent<string | null>) => this.push(setObjectGroup(this.state, e.detail))}
            @set-main-group=${(e: CustomEvent<string | null>) => this.push(setMainGroup(this.state, e.detail))}
            @set-category=${(e: CustomEvent<CategoryChoice>) =>
              this.push(setCategory(this.state, e.detail.mainGroup, e.detail.category))}
          ></hs-all-postings>`}
    `;
  }

  private body() {
    switch (this.load.kind) {
      case "error":
        return html`<p class="card line alert" role="alert">${da.errors[this.load.code]}</p>`;
      case "ready":
        return this.ready(viewContext(this.load.data, this.state, this.today));
      default:
        return this.state.screen === "overview"
          ? html`${this.fullScreen ? nothing : html`<hs-key-numbers .cards=${null} .boxes=${this.boxes}></hs-key-numbers>`}
              ${this.loadingHalves()}`
          : html`<section class="card half" role="region" aria-busy="true" aria-label=${da.loading}></section>`;
    }
  }

  override render() {
    return html`<main class="page">
      <hs-top-card
        .state=${this.state}
        .today=${this.today}
        .accounts=${this.accounts}
        .earliest=${this.earliest}
        @hs-period=${this.onPeriod}
        @hs-grouping=${this.onGrouping}
        @hs-accounts=${this.onAccounts}
      ></hs-top-card>
      ${this.body()}
    </main>`;
  }
}

if (!customElements.get("hs-app")) customElements.define("hs-app", SpendingApp);

declare global {
  interface HTMLElementTagNameMap {
    "hs-app": SpendingApp;
  }
}
