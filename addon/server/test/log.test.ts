import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, stamp } from "../src/log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the log", () => {
  it("a logged line starts with the local date and time", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("x");
    expect(spy.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} x$/);
  });

  it("warnings and errors start with the date and time too", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.warn("w");
    logger.error("e");
    expect(warn.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} w$/);
    expect(error.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} e$/);
  });

  it("stamp gives the fields of a local date", () => {
    expect(stamp(new Date(2026, 0, 5, 7, 8, 9))).toBe("2026-01-05 07:08:09");
  });
});
