import { serve } from "@hono/node-server";
import { localToday } from "@ha-spending/shared";
import type { Fault } from "./fake";
import { createFakeFirefly } from "./fake";
import { generateSeed } from "./generate";

const HOST = "127.0.0.1";
const PORT = 8091;
const FAULTS: Fault[] = ["refused", "error", "slow"];

const fault = process.env.FAKE_FIREFLY_FAULT;
if (fault !== undefined && fault !== "" && !FAULTS.includes(fault as Fault)) {
  console.error(`FAKE_FIREFLY_FAULT must be one of ${FAULTS.join(", ")}`);
  process.exit(1);
}

const fake = createFakeFirefly(generateSeed({ today: localToday(new Date()), seed: 1 }));
fake.fault = (fault || null) as Fault;

serve({ fetch: (request) => fake.fetch(request), hostname: HOST, port: PORT }, () => {
  console.log(`Fake Firefly III on http://${HOST}:${PORT}, fault ${fake.fault ?? "none"}`);
});
