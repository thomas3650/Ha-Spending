import { NO_SHOP } from "../firefly/wire";

export { NO_SHOP };
export const SHOP_LIMIT = 60;

// Control, format (bidi overrides, zero-width), line and paragraph separators, and lone surrogates.
export const REFUSED = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/u;

export function cleanShop(raw: string): string | null {
  const name = raw.normalize("NFC").trim();
  if (name === "" || Array.from(name).length > SHOP_LIMIT) return null;
  if (REFUSED.test(name)) return null;
  if (name.toLocaleLowerCase("und") === NO_SHOP) return null;
  return name;
}

export function sameShop(a: string): string {
  return a.toLocaleLowerCase("und");
}

// The default sort compares UTF-16 units, which puts astral characters before U+E000 to U+FFFF.
export function byCodePoint(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const d = x[i]!.codePointAt(0)! - y[i]!.codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}
