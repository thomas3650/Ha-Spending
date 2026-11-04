import { html } from "lit";

const EXPAND = "M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7";
const COLLAPSE = "M14 4v6h6M14 10l7-7M10 20v-6H4M10 14l-7 7";

/** A card's full-screen button, on the overview and in the fixed-expenses view. Its style: `.card-tools .full-screen`. */
export function fullScreenButton(label: string, on: boolean, toggle: () => void) {
  return html`<button type="button" class="full-screen" aria-label=${label} aria-pressed=${String(on)} @click=${toggle}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d=${on ? COLLAPSE : EXPAND} />
    </svg>
  </button>`;
}
