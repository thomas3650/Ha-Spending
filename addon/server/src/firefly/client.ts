import type { WirePage } from "./wire";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type FireflyErrorReason = "unreachable" | "refused";

/** The message names the reason only: never the token, the address or the cause. */
export class FireflyError extends Error {
  readonly reason: FireflyErrorReason;

  constructor(reason: FireflyErrorReason) {
    super(reason === "refused" ? "Firefly III refused the token" : "Firefly III did not answer");
    this.name = "FireflyError";
    this.reason = reason;
  }
}

export interface FireflyClient {
  get(path: string, query: Record<string, string>, signal?: AbortSignal): Promise<unknown>;
  /** Only the sorter's `set_category` writes (D29). */
  put(path: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
  /** Only the sorter's `set_category` makes something: a new shop's expense account (D32). */
  post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
}

/** `baseUrl` comes without a trailing slash: options.ts strips it. */
export function createFireflyClient(options: { baseUrl: string; token: string; fetch?: FetchLike }): FireflyClient {
  const { baseUrl: base, token } = options;
  const fetch = options.fetch ?? globalThis.fetch;

  async function send(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json", ...init.headers },
        redirect: "error",
      });
    } catch {
      throw new FireflyError("unreachable");
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new FireflyError(response.status === 401 || response.status === 403 ? "refused" : "unreachable");
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new FireflyError("unreachable");
    }
    if (typeof body !== "object" || body === null || !("data" in body)) throw new FireflyError("unreachable");
    return body;
  }

  const write = (method: "PUT" | "POST", path: string, body: unknown, signal?: AbortSignal) =>
    send(`${base}/api/v1/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

  return {
    get: (path, query, signal) => send(`${base}/api/v1/${path}?${new URLSearchParams(query)}`, { method: "GET", signal }),
    put: (path, body, signal) => write("PUT", path, body, signal),
    post: (path, body, signal) => write("POST", path, body, signal),
  };
}

export async function getAllPages<T>(
  client: FireflyClient,
  path: string,
  query: Record<string, string>,
  pageSize: number,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const answer = (await client.get(path, { ...query, limit: String(pageSize), page: String(page) }, signal)) as
      WirePage<T>;
    if (!Array.isArray(answer.data)) throw new FireflyError("unreachable");
    items.push(...answer.data);
    if (page >= (answer.meta?.pagination?.total_pages ?? 1)) return items;
  }
}
