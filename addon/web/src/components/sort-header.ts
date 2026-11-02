import { css, html, nothing } from "lit";
import type { Sorted } from "../state/view";

/** A column header whose button sorts the table by it; the sorted one carries `aria-sort` and an arrow. */
export function sortHeader<C extends string>(
  column: C,
  label: string,
  sort: Sorted<C>,
  onSort: (column: C) => void,
  className = "",
) {
  const sorted = sort.column === column;
  return html`<th
    scope="col"
    class=${className || nothing}
    aria-sort=${sorted ? (sort.descending ? "descending" : "ascending") : nothing}
  >
    <button type="button" class="sort-button" @click=${() => onSort(column)}>
      ${label}${sorted ? html`<span class="sort-arrow" aria-hidden="true">${sort.descending ? "▼" : "▲"}</span>` : nothing}
    </button>
  </th>`;
}

export const sortHeaderStyles = css`
  .sort-button {
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: inherit;
    background: none;
    border: 0;
    cursor: pointer;
  }
  [aria-sort] > .sort-button {
    font-weight: bold;
    color: var(--hs-text);
  }
  .sort-button:hover,
  .sort-button:focus-visible {
    color: var(--hs-accent-text);
  }
  .sort-arrow {
    margin-left: 4px;
    font-size: 10px;
  }
`;
