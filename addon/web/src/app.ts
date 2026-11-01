import {
  type Account,
  fetchRange,
  type Grouping,
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
import { differenceStyles } from "./components/difference";
import { periodPickerStyles } from "./components/period-picker";
import { postingsStyles } from "./components/postings";
import { searchStyles } from "./components/search";
import { subscriptionsStyles } from "./components/subscriptions";
import { topCardStyles } from "./components/top-card";
import { LoadError, type LoadErrorCode, loadData } from "./data/api";
import { da } from "./i18n/da";
import { type ViewContext, viewContext } from "./model/context";
import { keyCards, subscriptionsCard } from "./model/key-numbers";
import { allPostingsStyles, type CategoryChoice } from "./screens/all-postings";
import "./screens/overview";
import { overviewStyles } from "./screens/overview";
import {
  chooseShop,
  chooseUnit,
  normalise,
  openAllPostings,
  openPart,
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
  setPeriod,
  setSearch,
  setSort,
  toggleSubscriptions,
} from "./state/actions";
import {
  type AmountRange,
  type Card,
  parseHash,
  type PeriodChoice,
  periodOf,
  type Sort,
  toHash,
  type ViewState,
} from "./state/view";
import { card, chip, field, theme } from "./theme";

type Load =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: SpendingData }
  | { kind: "error"; code: LoadErrorCode };

function sameRange(a: Period, b: Period): boolean {
  return a.start === b.start && a.end === b.end;
}

export class SpendingApp extends LitElement {
  static override properties = {
    state: { state: true },
    today: { state: true },
    load: { state: true },
    accounts: { state: true },
    fullScreen: { state: true },
  };

  static override styles = [
    theme,
    card,
    chip,
    field,
    dropdownStyles,
    periodPickerStyles,
    topCardStyles,
    keyNumbersStyles,
    circleStyles,
    barsStyles,
    differenceStyles,
    postingsStyles,
    searchStyles,
    subscriptionsStyles,
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
  /** A layout setting of this page load, so it stays out of the view state and the hash. */
  declare private fullScreen: boolean;

  private asked: Period | null = null;
  private request = 0;
  private controller: AbortController | null = null;

  constructor() {
    super();
    this.state = parseHash("");
    this.today = localToday(new Date());
    this.load = { kind: "idle" };
    this.accounts = null;
    this.fullScreen = false;
  }

  private readonly onHash = (): void => {
    const next = parseHash(location.hash);
    if (toHash(next) !== toHash(this.state)) this.change(next);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.fullScreen && this.state.screen === "overview") this.fullScreen = false;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("hashchange", this.onHash);
    window.addEventListener("popstate", this.onHash);
    window.addEventListener("keydown", this.onKey);
    this.change(parseHash(location.hash));
  }

  override disconnectedCallback(): void {
    window.removeEventListener("hashchange", this.onHash);
    window.removeEventListener("popstate", this.onHash);
    window.removeEventListener("keydown", this.onKey);
    this.request += 1;
    this.controller?.abort();
    this.controller = null;
    this.asked = null;
    super.disconnectedCallback();
  }

  /** pushState and replaceState fire no event, so the state is set here. */
  apply(next: ViewState, mode: "push" | "replace"): void {
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
    return fetchRange(periodOf(this.state.period, this.today), this.state.grouping, this.today);
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

  /** The add-on's today wins once per user-started fetch; a retry's answer is shown as it is. */
  private onAnswer(data: SpendingData, retry: boolean): void {
    this.accounts = data.accounts;
    if (!retry && data.today !== this.today) {
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

  private subscriptionsKey(ctx: ViewContext) {
    const card = subscriptionsCard(ctx);
    return card === null ? null : { card, pressed: this.state.card === "subscriptions" };
  }

  private ready(ctx: ViewContext) {
    const overview = this.state.screen === "overview";
    return html`
      ${ctx.data.mainGroupsFound ? nothing : html`<p class="card line status" role="status">${da.noRuleGroup}</p>`}
      ${overview
        ? html`${this.fullScreen
              ? nothing
              : html`<hs-key-numbers
                  .cards=${keyCards(ctx)}
                  .subscriptions=${this.subscriptionsKey(ctx)}
                  @subscriptions-toggle=${() => this.push(toggleSubscriptions(this.state))}
                ></hs-key-numbers>`}
            <hs-overview
              .ctx=${ctx}
              .fullScreen=${this.fullScreen}
              @full-screen-toggle=${() => (this.fullScreen = !this.fullScreen)}
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
          ? html`${this.fullScreen ? nothing : html`<hs-key-numbers .cards=${null}></hs-key-numbers>`}
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
