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

export const chip = css`
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: inherit;
    font-weight: 600;
    padding: 3px 6px 3px 12px;
    color: var(--hs-accent-text);
    background: var(--hs-accent-soft);
    border: 0;
    border-radius: 14px;
    cursor: pointer;
  }
  .chip-x {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    font-size: 11px;
    border-radius: 50%;
    background: var(--hs-chip-x);
  }
  .chip:hover .chip-x,
  .chip:focus-visible .chip-x {
    color: var(--hs-card);
    background: var(--hs-accent-text);
  }
  .chip:focus-visible {
    outline: 2px solid var(--hs-accent-text);
    outline-offset: 2px;
  }
`;

/** A label holding a small caption and a value: a dropdown's button, or a native select. */
export const field = css`
  .field {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 190px;
    padding: 6px 36px 6px 12px;
    border: 1px solid var(--hs-field);
    border-radius: 8px;
    background: var(--hs-card);
    color: var(--hs-text);
    font: inherit;
    text-align: left;
    position: relative;
    cursor: pointer;
  }
  .field:disabled {
    cursor: default;
    color: var(--hs-muted);
  }
  .field small {
    color: var(--hs-muted);
    font-size: 11px;
  }
  .field span {
    font-size: 14px;
  }
  .field::after {
    content: "▾";
    position: absolute;
    right: 12px;
    top: 14px;
    color: var(--hs-muted);
  }
  .field[aria-expanded="true"],
  .field:focus-visible,
  label.field:focus-within {
    border: 2px solid var(--hs-accent);
    padding: 5px 35px 5px 11px;
    outline: none;
  }
  .field[aria-expanded="true"] small,
  label.field:focus-within small {
    color: var(--hs-accent);
  }
  .field select {
    border: 0;
    padding: 0;
    margin: 0;
    background: none;
    font: inherit;
    color: var(--hs-text);
    font-size: 14px;
    appearance: none;
    width: 100%;
    cursor: pointer;
    outline: none;
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
