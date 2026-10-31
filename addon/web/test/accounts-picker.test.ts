import type { Account } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";
import { accountsClosedText } from "../src/components/accounts-picker";
import { da } from "../src/i18n/da";

const accounts: Account[] = ["1", "2", "3", "4", "5"].map((id) => ({ id, name: `Konto ${id}` }));

describe("the closed Konti field", () => {
  it("counts every account when all are ticked, by default or by a full list", () => {
    expect(accountsClosedText(accounts, null)).toBe(da.allAccountsCount(5));
    expect(accountsClosedText(accounts, ["1", "2", "3", "4", "5"])).toBe(da.allAccountsCount(5));
  });

  it("counts the ticked accounts instead of naming them", () => {
    expect(accountsClosedText(accounts, ["1", "2", "4", "5"])).toBe("4 af 5 konti");
  });

  it("says when no account is ticked", () => {
    expect(accountsClosedText(accounts, [])).toBe(da.noAccounts);
  });
});
