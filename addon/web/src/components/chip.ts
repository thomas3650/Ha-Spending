import { html } from "lit";
import { da } from "../i18n/da";

/** Every page event bubbles out of hs-app's shadow root to the app's listeners. */
export function fire(el: HTMLElement, name: string, detail?: unknown): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

/** A filter chip, named "Fjern …", that removes its filter on a click. Its style is `chip` in theme.ts. */
export function chip(text: string, remove: () => void) {
  return html`<button type="button" class="chip" aria-label=${da.remove(text)} @click=${remove}>
    ${text}<span class="chip-x" aria-hidden="true">✕</span>
  </button>`;
}
