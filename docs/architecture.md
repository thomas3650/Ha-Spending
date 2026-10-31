# Architecture

One add-on with a server and a page ([D1](decisions.md)). The design, with what each part will own, is technical spec
§1 ([technical spec](superpowers/specs/2026-10-30-technical-design.md)). This doc says what exists now; the code is the
source for the details.

## The parts

| Part | Folder | Owns |
| --- | --- | --- |
| Server | `addon/server/` | The routes, the ingress check, reading Firefly III, serving the page's files |
| Page | `addon/web/` | What the browser shows; its texts in `src/i18n/da.ts` |
| Shared | `addon/shared/` | The types the server answers with and the page reads, and the money and date rules |
| Dev | `addon/dev/` | A fake Firefly III, the example data and the compose file for a real one ([D11](decisions.md)); test and dev only, never in the image |

The server and the page reach each other only through the routes below.

## What exists now

The page says "Hej" and the server's version. The server reads Firefly III and answers `/api/data`; the page does not
call it yet.

- **The server** is Hono on `@hono/node-server` ([D3](decisions.md)), in `addon/server/src/`. In the image it is one
  bundle at `/opt/ha-spending/server.mjs`, run by `node:24-alpine` ([D4](decisions.md)).
- **The page** is one Lit element, `<hs-app>`, built by Vite. In the image its build is at `/opt/ha-spending/web`, or
  wherever `HA_SPENDING_WEB_DIR` points.
- **The Firefly III client** (`addon/server/src/firefly/`) has one method, `get`, so nothing is ever written. It pages
  through the answers and maps them to postings ([D12](decisions.md), [D15](decisions.md)).
- **The options** are read once at start from `/data/options.json`, or from `HA_SPENDING_OPTIONS`. Without a Firefly III
  address and token the server logs what is missing and exits 1.
- **The cache** keeps an answer per period for a few minutes (`addon/server/src/cache.ts`).
- **The version** comes from `addon/server/src/version.ts`, which release-please bumps
  ([`releasing.md`](releasing.md#versions)).

## The routes

| Route | Answers |
| --- | --- |
| `GET /api/health` | `{"status": "ok", "version": "<version>"}`, typed `Health` in `addon/shared/` |
| `GET /api/data?start=YYYY-MM-DD&end=YYYY-MM-DD` | the postings of the period and what the page needs around them, typed `SpendingData` in `addon/shared/`; errors are the codes of `DataError` ([D18](decisions.md)) |
| any other `/api/…` | 404 |
| `GET /` and `GET /web/*` | the page's built files |

No route writes. Every URL the page uses is relative (`./web/…`, `api/health`), so it works under the ingress path.

## Ingress

- The server listens on port 8099, Home Assistant's default ingress port. `addon/config.yaml` publishes no port.
- It answers only Home Assistant's ingress address; any other peer gets 403 ([D5](decisions.md)).
- `HA_SPENDING_DEV=1` turns the check off, and binds `127.0.0.1` only ([D13](decisions.md)). The add-on never sets
  it; the fast loop does ([`testing.md`](testing.md#fast-loop)).
