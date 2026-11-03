import { localToday, type SpendingData } from "@ha-spending/shared";
import type { DataLoader } from "./app";
import { createCache } from "./cache";
import type { FireflyClient } from "./firefly/client";
import { type ReadSettings, readSpanFree, readSpendingData, type SpanFree } from "./firefly/read";

/** Answers are kept per span, and the parts that do not depend on the span per day (D49). */
export function createDataLoader(
  client: FireflyClient,
  settings: ReadSettings,
  now: () => Date,
  warn: (message: string) => void,
): DataLoader {
  const clock = () => now().getTime();
  const answers = createCache<SpendingData>({ ttlMs: 300_000, max: 20, now: clock });
  const spanFrees = createCache<SpanFree>({ ttlMs: 300_000, max: 2, now: clock });
  return (range) => {
    const today = localToday(now());
    const spanFree = () => spanFrees.get(today, () => readSpanFree(client, settings, today));
    return answers.get(`${today}|${range.start}|${range.end}`, () =>
      readSpendingData(client, settings, range, { today, warn, spanFree }),
    );
  };
}
