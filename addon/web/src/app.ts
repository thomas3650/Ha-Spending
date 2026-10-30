import type { Health } from "@ha-spending/shared";
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { da } from "./i18n/da";
import { theme } from "./theme";

@customElement("hs-app")
export class SpendingApp extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: block;
        min-height: 100vh;
        padding: 16px;
        box-sizing: border-box;
        background: var(--hs-background);
        color: var(--hs-text);
        font-family: var(--hs-font);
      }
    `,
  ];

  @state() private version: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    void this.loadVersion();
  }

  private async loadVersion(): Promise<void> {
    try {
      // Relative, so the request stays under Ingress's prefix.
      const response = await fetch("api/health");
      if (!response.ok) return;
      const health = (await response.json()) as Health;
      this.version = health.version;
    } catch {
      // Without the server the page keeps its heading and leaves the version out.
    }
  }

  override render() {
    return html`
      <h1>${da.hello}</h1>
      ${this.version === null ? nothing : html`<p>${da.version(this.version)}</p>`}
    `;
  }
}
