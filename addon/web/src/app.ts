import {
  type Account,
  fetchRange,
  type Grouping,
  localToday,
  type Period,
  type SpendingData,
  within,
} from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";

import "./components/accounts-picker";
import { dropdownStyles } from "./components/dropdown";
import { keyNumbersStyles } from "./components/key-numbers";
import { periodPickerStyles } from "./components/period-picker";
import { topCardStyles } from "./components/top-card";
import { LoadError, type LoadErrorCode, loadData } from "./data/api";
import { da } from "./i18n/da";
import { type ViewContext, viewContext } from "./model/context";
import { keyCards } from "./model/key-numbers";
import { normalise, setAccounts, setGrouping, setPeriod } from "./state/actions";
import { parseHash, type PeriodChoice, periodOf, toHash, type ViewState } from "./state/view";
import { card, theme } from "./theme";

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
  };

  static override styles = [
    theme,
    card,
    dropdownStyles,
    periodPickerStyles,
    topCardStyles,
    keyNumbersStyles,
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
        max-width: 1360px;
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
      @media (max-width: 959px) {
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

  private asked: Period | null = null;
  private request = 0;
  private controller: AbortController | null = null;

  constructor() {
    super();
    this.state = parseHash("");
    this.today = localToday(new Date());
    this.load = { kind: "idle" };
    this.accounts = null;
  }

  private readonly onHash = (): void => {
    const next = parseHash(location.hash);
    if (toHash(next) !== toHash(this.state)) this.change(next);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("hashchange", this.onHash);
    window.addEventListener("popstate", this.onHash);
    this.change(parseHash(location.hash));
  }

  override disconnectedCallback(): void {
    window.removeEventListener("hashchange", this.onHash);
    window.removeEventListener("popstate", this.onHash);
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

  private halves(loading: boolean, empty: boolean) {
    return html`<div class="halves">
      ${[0, 1].map(() =>
        loading
          ? html`<section class="card half" role="region" aria-busy="true" aria-label=${da.loading}></section>`
          : html`<section class="card half" role="region">
              ${empty ? html`<p class="empty">${da.noSpending}</p>` : nothing}
            </section>`,
      )}
    </div>`;
  }

  private ready(ctx: ViewContext) {
    const overview = this.state.screen === "overview";
    const empty = within(ctx.shown, ctx.timeline.period).length === 0;
    return html`
      ${ctx.data.mainGroupsFound ? nothing : html`<p class="card line status" role="status">${da.noRuleGroup}</p>`}
      ${overview ? html`<hs-key-numbers .cards=${keyCards(ctx)}></hs-key-numbers>${this.halves(false, empty)}` : nothing}
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
          ? html`<hs-key-numbers .cards=${null}></hs-key-numbers>${this.halves(true, false)}`
          : nothing;
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
