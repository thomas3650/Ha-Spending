import { FireflyError } from "./client";

const AMOUNT = /^([+-]?)(\d+)(?:\.(\d*))?$/;

/** Without floating point: Firefly III sends twelve decimals. */
export function toOre(amount: string): number {
  const match = AMOUNT.exec(amount.trim());
  if (!match) throw new FireflyError("unreachable");
  const [, sign, whole, fraction = ""] = match;
  const digits = fraction.padEnd(3, "0");
  let ore = Number(whole) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) ore += 1;
  return sign === "-" ? -ore : ore;
}
