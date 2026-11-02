import { byUnit, type ClassifiedPosting, NO_PIECE, type Posting, type Unit } from "@ha-spending/shared";
import { unitName } from "../format";
import { type ViewContext, partName } from "./context";
import type { PostingColumn, Sort } from "../state/view";
import { byDate } from "./filter";

export interface PostingRow {
  posting: ClassifiedPosting;
  account: string;
  category: string;
  colour: string;
  href: string | null;
}

export interface PostingGroup {
  /** The unit's fullStart. */
  key: string;
  name: string;
  rows: PostingRow[];
  total: number;
}

export type PostingList =
  | { kind: "grouped"; newestFirst: boolean; groups: PostingGroup[] }
  | { kind: "flat"; rows: PostingRow[] };

/**
 * Only an http(s) base becomes a link, so an option such as `javascript:` can never reach an href. The server has
 * already stripped its trailing slash.
 */
export function linkBase(url: string | null): string | null {
  if (url === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
}

export function postingHref(base: string | null, p: Posting): string | null {
  return base === null ? null : `${base}/transactions/show/${encodeURIComponent(p.groupId)}`;
}

interface RowContext {
  base: string | null;
  accounts: Map<string, string>;
  colours: Map<string | null, string>;
}

function rowContext(ctx: ViewContext, colours: Map<string | null, string>): RowContext {
  return {
    base: linkBase(ctx.data.fireflyLinkUrl),
    accounts: new Map(ctx.data.accounts.map((a) => [a.id, a.name])),
    colours,
  };
}

function row(p: ClassifiedPosting, rc: RowContext): PostingRow {
  return {
    posting: p,
    account: rc.accounts.get(p.account) ?? p.account,
    category: partName(p.category, "category"),
    colour: rc.colours.get(p.category) ?? NO_PIECE,
    href: postingHref(rc.base, p),
  };
}

export function groupedPostings(
  postings: ClassifiedPosting[],
  units: Unit[],
  ctx: ViewContext,
  newestFirst: boolean,
  colours: Map<string | null, string>,
): PostingList {
  const direction = newestFirst ? -1 : 1;
  const rc = rowContext(ctx, colours);
  const groups = byUnit(postings, units)
    .filter((u) => u.postings.length > 0)
    .map(
      (u): PostingGroup => ({
        key: u.unit.fullStart,
        name: unitName(u.unit, ctx.timeline.grouping),
        rows: [...u.postings]
          .sort((a, b) => direction * byDate(a, b))
          .map((p) => row(p, rc)),
        total: u.total,
      }),
    );
  if (newestFirst) groups.reverse();
  return { kind: "grouped", newestFirst, groups };
}

const danish = new Intl.Collator("da");

/** What each column's cell shows (lists spec §2.1). */
const BY_COLUMN: Record<Exclude<PostingColumn, "date">, (a: PostingRow, b: PostingRow) => number> = {
  text: (a, b) => danish.compare(a.posting.shop ?? a.posting.text, b.posting.shop ?? b.posting.text),
  category: (a, b) => danish.compare(a.category, b.category),
  account: (a, b) => danish.compare(a.account, b.account),
  amount: (a, b) => a.posting.amount - b.posting.amount,
};

function noCategoryLast(a: PostingRow, b: PostingRow): number {
  return Number(a.posting.category === null) - Number(b.posting.category === null);
}

function flatPostings(
  postings: ClassifiedPosting[],
  ctx: ViewContext,
  column: Exclude<PostingColumn, "date">,
  descending: boolean,
  colours: Map<string | null, string>,
): PostingList {
  const rc = rowContext(ctx, colours);
  const direction = descending ? -1 : 1;
  const compare = BY_COLUMN[column];
  const rows = postings
    .map((p) => row(p, rc))
    .sort(
      (a, b) =>
        (column === "category" ? noCategoryLast(a, b) : 0) ||
        direction * compare(a, b) ||
        byDate(b.posting, a.posting),
    );
  return { kind: "flat", rows };
}

/** By the date the postings stay in their groups; any other column gives one flat list. Ties go newest first. */
export function postingList(
  postings: ClassifiedPosting[],
  units: Unit[],
  ctx: ViewContext,
  sort: Sort,
  colours: Map<string | null, string>,
): PostingList {
  return sort.column === "date"
    ? groupedPostings(postings, units, ctx, sort.descending, colours)
    : flatPostings(postings, ctx, sort.column, sort.descending, colours);
}
