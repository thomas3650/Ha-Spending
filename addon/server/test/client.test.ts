import { createFakeFirefly, exampleSeed } from "@ha-spending/dev";
import { describe, expect, it } from "vitest";
import { createFireflyClient, type FetchLike, FireflyError, getAllPages } from "../src/firefly/client";
import { type ReadSettings, readSpendingData } from "../src/firefly/read";

const settings: ReadSettings = {
  mainGroupRuleGroup: "Hovedgrupper",
  excludedMainGroups: ["Penge ind og ud"],
  fireflyLinkUrl: null,
  pageSize: 5,
  timeoutMs: 1000,
};
const R1 = { start: "2025-12-01", end: "2026-07-31" };
const context = { today: "2026-10-30", warn: () => {} };

async function failure(promise: Promise<unknown>): Promise<FireflyError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(FireflyError);
  return error as FireflyError;
}

describe("the Firefly III client", () => {
  it("has a get, a put and a post, and nothing else", () => {
    const fake = createFakeFirefly(exampleSeed);
    const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
    expect(Object.keys(client)).toEqual(["get", "put", "post"]);
  });

  it("posts a JSON body with the token, and maps the post's errors as the get's", async () => {
    const sent: Request[] = [];
    const answer = (status: number, body: unknown) => async (input: string | URL | Request, init?: RequestInit) => {
      sent.push(new Request(input, init));
      return Response.json(body, { status });
    };
    const made = { data: { id: "41", attributes: { name: "Ny butik", type: "expense" } } };
    const ok = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: answer(200, made) });
    expect(await ok.post("accounts", { name: "Ny butik", type: "expense" })).toEqual(made);
    expect(sent[0].method).toBe("POST");
    expect(sent[0].url).toBe("http://f/api/v1/accounts");
    expect(sent[0].headers.get("Authorization")).toBe("Bearer fake-token");
    expect(sent[0].headers.get("Content-Type")).toBe("application/json");
    expect(await sent[0].json()).toEqual({ name: "Ny butik", type: "expense" });

    const refused = createFireflyClient({ baseUrl: "http://f", token: "nope", fetch: answer(401, {}) });
    expect((await failure(refused.post("accounts", {}))).reason).toBe("refused");
    const invalid = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: answer(422, {}) });
    expect((await failure(invalid.post("accounts", {}))).reason).toBe("unreachable");
  });

  it("puts a JSON body with the token, and maps the put's errors as the get's", async () => {
    const sent: Request[] = [];
    const answer = (status: number, body: unknown) => async (input: string | URL | Request, init?: RequestInit) => {
      sent.push(new Request(input, init));
      return Response.json(body, { status });
    };
    const ok = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: answer(200, { data: {} }) });
    expect(await ok.put("transactions/7", { transactions: [] })).toEqual({ data: {} });
    expect(sent[0].method).toBe("PUT");
    expect(sent[0].url).toBe("http://f/api/v1/transactions/7");
    expect(sent[0].headers.get("Authorization")).toBe("Bearer fake-token");
    expect(sent[0].headers.get("Content-Type")).toBe("application/json");
    expect(await sent[0].json()).toEqual({ transactions: [] });

    const refused = createFireflyClient({ baseUrl: "http://f", token: "nope", fetch: answer(401, {}) });
    expect((await failure(refused.put("transactions/7", {}))).reason).toBe("refused");
    const invalid = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: answer(422, {}) });
    expect((await failure(invalid.put("transactions/7", {}))).reason).toBe("unreachable");
  });

  it("sends the token and only GETs", async () => {
    const fake = createFakeFirefly(exampleSeed);
    const sent: { url: string; authorization: string | null; accept: string | null }[] = [];
    const fetch: FetchLike = (input, init) => {
      const request = new Request(input, init);
      sent.push({
        url: request.url,
        authorization: request.headers.get("Authorization"),
        accept: request.headers.get("Accept"),
      });
      return fake.fetch(input, init);
    };
    const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch });
    await readSpendingData(client, settings, R1, context);

    expect(fake.requests.length).toBeGreaterThan(0);
    expect(fake.requests.every((r) => r.method === "GET")).toBe(true);
    expect(sent.every((r) => r.url.startsWith("http://f/api/v1/"))).toBe(true);
    expect(sent.every((r) => r.authorization === "Bearer fake-token")).toBe(true);
    expect(sent.every((r) => r.accept === "application/vnd.api+json")).toBe(true);
  });

  it("reads every page, also when Firefly III caps the page size", async () => {
    const fake = createFakeFirefly(exampleSeed, { maxPerPage: 3 });
    const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
    const groups = await getAllPages<{ id: string }>(client, "transactions", { type: "all" }, 500);
    expect(groups).toHaveLength(20);
    expect(new Set(groups.map((g) => g.id)).size).toBe(20);
  });

  it("maps a refused token", async () => {
    const fake = createFakeFirefly(exampleSeed);
    const client = createFireflyClient({ baseUrl: "http://f", token: "nope", fetch: fake.fetch });
    const error = await failure(client.get("about", {}));
    expect(error.reason).toBe("refused");
    expect(error.message).not.toContain("nope");
  });

  it("maps a server error, HTML and a dead address", async () => {
    const fake = createFakeFirefly(exampleSeed);
    fake.fault = "error";
    const broken = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
    expect((await failure(broken.get("about", {}))).reason).toBe("unreachable");

    const html: FetchLike = async () =>
      new Response("<html><body>Login</body></html>", { status: 200, headers: { "Content-Type": "text/html" } });
    const proxy = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: html });
    expect((await failure(proxy.get("about", {}))).reason).toBe("unreachable");

    const noData: FetchLike = async () => Response.json({ message: "hello" });
    const odd = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: noData });
    expect((await failure(odd.get("about", {}))).reason).toBe("unreachable");

    const dead = createFireflyClient({ baseUrl: "http://127.0.0.1:1", token: "fake-token" });
    const error = await failure(dead.get("about", {}));
    expect(error.reason).toBe("unreachable");
    expect(error.message).not.toContain("fake-token");
  });

  it("times out a slow Firefly III", async () => {
    const fake = createFakeFirefly(exampleSeed);
    fake.fault = "slow";
    const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
    const started = Date.now();
    const error = await failure(readSpendingData(client, { ...settings, timeoutMs: 50 }, R1, context));
    expect(error.reason).toBe("unreachable");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("lets the first error win", async () => {
    const fake = createFakeFirefly(exampleSeed);
    const fetch: FetchLike = (input, init) => {
      if (String(input).includes("/categories")) return fake.fetch(input, { ...init, headers: {} });
      // The others hang until the first failure aborts them, and then fail as unreachable.
      return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    };
    const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch });
    const error = await failure(readSpendingData(client, settings, R1, context));
    expect(error.reason).toBe("refused");
  });

  it("follows no redirect", async () => {
    const seen: RequestInit[] = [];
    const fetch: FetchLike = async (_input, init) => {
      seen.push(init ?? {});
      return new Response(null, { status: 302, headers: { Location: "http://elsewhere/login" } });
    };
    const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch });
    expect((await failure(client.get("about", {}))).reason).toBe("unreachable");
    expect(seen[0].redirect).toBe("error");
  });
});
