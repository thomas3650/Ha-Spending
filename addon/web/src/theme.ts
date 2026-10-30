import { css } from "lit";

/** Home Assistant's light theme. Inside the Ingress iframe HA's CSS variables don't exist, so the page sets its own. */
export const theme = css`
  :host {
    --hs-background: #fff;
    --hs-text: #212121;
    --hs-font: Roboto, Noto, "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
`;
