import { describe, expect, it } from "vitest";
import { isIngress } from "../src/ingress";

describe("isIngress", () => {
  it.each(["172.30.32.2", "::ffff:172.30.32.2"])("lets %s in", (address) => {
    expect(isIngress(address)).toBe(true);
  });

  it.each(["127.0.0.1", "::1", "172.30.32.1", "172.30.32.20", "::ffff:127.0.0.1", "", undefined])(
    "turns %s away",
    (address) => {
      expect(isIngress(address)).toBe(false);
    },
  );
});
