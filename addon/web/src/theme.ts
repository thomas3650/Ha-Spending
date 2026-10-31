import { css } from "lit";

/** Inside the Ingress iframe Home Assistant's CSS variables don't exist, so the page sets its own, light only. */
export const theme = css`
  :host {
    color-scheme: light;
    --hs-bg: #f5f5f5;
    --hs-card: #fff;
    --hs-line: #e3e3e3;
    --hs-soft: #f0f0f0;
    --hs-text: #1f1f1f;
    --hs-muted: #6b6b6b;
    --hs-accent: #03a9f4;
    --hs-accent-soft: #e1f3fd;
    --hs-accent-text: #0277bd;
    --hs-chip-x: #b3e0fb;
    --hs-field: #c9c9c9;
    --hs-grid: #ececec;
    --hs-leader: #b5b5b5;
    --hs-up: #c62828;
    --hs-more: #eb6834;
    --hs-less: #2a78d6;
    --hs-font: Roboto, "Segoe UI", system-ui, sans-serif;
    font-size: 14px;
  }
`;

export const card = css`
  .card {
    background: var(--hs-card);
    border: 1px solid var(--hs-line);
    border-radius: 12px;
    padding: 16px;
  }
`;

/** Keeps an element for assistive technology only. */
export const visuallyHidden = css`
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
`;
