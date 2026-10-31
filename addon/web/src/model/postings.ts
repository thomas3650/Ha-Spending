import { byUnit, type ClassifiedPosting, type Unit } from "@ha-spending/shared";
import { unitName } from "../format";
import { type ViewContext, partName } from "./context";

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

const NO_COLOUR = "#b5b5b5";

/** Only an http(s) base becomes a link, so an option such as `javascript:` can never reach an href. */
export function linkBase(url: string | null): string | null {
  if (url === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return url.endsWith("/") ? url.slice(0, -1) : url;
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
    colour: rc.colours.get(p.category) ?? NO_COLOUR,
    href: rc.base === null ? null : `${rc.base}/transactions/show/${encodeURIComponent(p.groupId)}`,
  };
}

export function postingRow(p: ClassifiedPosting, ctx: ViewContext, colours: Map<string | null, string>): PostingRow {
  return row(p, rowContext(ctx, colours));
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
          .sort((a, b) => direction * a.date.localeCompare(b.date))
          .map((p) => row(p, rc)),
        total: u.total,
      }),
    );
  if (newestFirst) groups.reverse();
  return { kind: "grouped", newestFirst, groups };
}
