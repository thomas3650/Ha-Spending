import type { Account } from "@ha-spending/shared";
import { html, nothing, type PropertyDeclarations } from "lit";
import { live } from "lit/directives/live.js";
import { da } from "../i18n/da";
import { Dropdown } from "./dropdown";

export function accountsClosedText(accounts: Account[] | null, chosen: string[] | null): string {
  if (accounts === null) return da.allAccounts;
  if (chosen === null) return da.allAccountsCount(accounts.length);
  const names = accounts.filter((a) => chosen.includes(a.id)).map((a) => a.name);
  return names.length === 0 ? da.noAccounts : names.join(", ");
}

/** Fires `hs-accounts` with the ticked account ids. */
export class AccountsPicker extends Dropdown {
  static override properties: PropertyDeclarations = {
    accounts: { attribute: false },
    chosen: { attribute: false },
  };

  /** null until the first answer. */
  declare accounts: Account[] | null;
  /** null is every account. */
  declare chosen: string[] | null;

  constructor() {
    super();
    this.accounts = null;
    this.chosen = null;
  }

  private ticked(id: string): boolean {
    return this.chosen === null || this.chosen.includes(id);
  }

  private emit(ids: string[]): void {
    this.dispatchEvent(new CustomEvent<string[]>("hs-accounts", { detail: ids, bubbles: true }));
  }

  private tick(id: string, on: boolean): void {
    const all = (this.accounts ?? []).map((a) => a.id);
    this.emit(all.filter((a) => (a === id ? on : this.ticked(a))));
  }

  override render() {
    const accounts = this.accounts ?? [];
    const count = accounts.filter((a) => this.ticked(a.id)).length;
    const closed = accountsClosedText(this.accounts, this.chosen);
    return html`<div class="dd">
      <button
        class="field"
        type="button"
        aria-expanded=${this.open ? "true" : "false"}
        aria-label=${`${da.accounts} ${closed}`}
        ?disabled=${this.accounts === null}
        @click=${() => this.toggle()}
      >
        <small>${da.accounts}</small><span>${closed}</span>
      </button>
      ${this.open && this.accounts
        ? html`<div class="dd-menu dd-end" tabindex="-1" role="group" aria-label=${da.accounts}>
            <label class="dd-check"
              ><input
                type="checkbox"
                .checked=${live(count === accounts.length)}
                .indeterminate=${count > 0 && count < accounts.length}
                @change=${(e: Event) =>
                  this.emit((e.target as HTMLInputElement).checked ? accounts.map((a) => a.id) : [])}
              />${da.allAccounts}</label
            >
            <hr />
            ${accounts.map(
              (a) =>
                html`<label class="dd-check"
                  ><input
                    type="checkbox"
                    .checked=${live(this.ticked(a.id))}
                    @change=${(e: Event) => this.tick(a.id, (e.target as HTMLInputElement).checked)}
                  />${a.name}</label
                >`,
            )}
          </div>`
        : nothing}
    </div>`;
  }
}

if (!customElements.get("hs-accounts-picker")) customElements.define("hs-accounts-picker", AccountsPicker);

declare global {
  interface HTMLElementTagNameMap {
    "hs-accounts-picker": AccountsPicker;
  }
}
