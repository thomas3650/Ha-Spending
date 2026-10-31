# Architecture

One add-on with a server and a page ([D1](decisions.md)). The design, with what each part will own, is technical spec
§1 ([technical spec](superpowers/specs/2026-10-30-technical-design.md)). This doc says what exists now; the code is the
source for the details.

## The parts

| Part | Folder | Owns |
| --- | --- | --- |
| Server | `addon/server/` | The routes, the ingress check, reading Firefly III, serving the page's files, the sorter's endpoint |
| Page | `addon/web/` | What the browser shows; its texts in `src/i18n/da.ts` |
| Shared | `addon/shared/` | The types the server answers with and the page reads, and the money and date rules |
| Dev | `addon/dev/` | A fake Firefly III, the example data and the compose file for a real one ([D11](decisions.md)); test and dev only, never in the image |

The server and the page reach each other only through the routes below.

## What exists now

The server reads Firefly III and answers `/api/data`; the page fetches it and shows screens 1 to 4 of the
[UI spec](superpowers/specs/2026-10-30-ui-ux-design.md).

- **The server** is Hono on `@hono/node-server` ([D3](decisions.md)), in `addon/server/src/`. In the image it is one
  bundle at `/opt/ha-spending/server.mjs`, run by `node:24-alpine` ([D4](decisions.md)).
- **The page** is a Lit element, `<hs-app>`, built by Vite. In the image its build is at `/opt/ha-spending/web`, or
  wherever `HA_SPENDING_WEB_DIR` points. Its parts, in `addon/web/src/`:
  - `state/`: the view state and its hash ([D20](decisions.md)), and the actions that change it;
  - `model/`: the pure functions from an answer and the view state to what is shown (circle, key numbers, postings,
    filters);
  - `screens/` and `components/`: the screens and the cards, dropdowns and lists they use;
  - `charts/echarts.ts`: the one wrapper around ECharts, which the component tests mock ([D19](decisions.md));
  - `data/api.ts`: the fetch of `api/data`.
  The build is one JS chunk ([D19](decisions.md)).
- **The Firefly III client** (`addon/server/src/firefly/`) has a `get`, a `put` and a `post`. It pages through the
  answers and maps them to postings ([D12](decisions.md), [D15](decisions.md)). Only the sorter's `set_category` calls
  `put` ([D29](decisions.md)), and `post` only to make a shop's expense account ([D32](decisions.md)).
- **The sorter's endpoint** (`addon/server/src/sorter/`) is a second Hono app on port 8100, started only when
  `sorter_key` is set ([D29](decisions.md)): `http.ts` holds the key check and MCP's JSON-RPC, `tools.ts` the tools
  `start` and `set_category` and their limits. Their contract is in [`addon/DOCS.md`](../addon/DOCS.md#the-sorters-endpoint).
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

No route on port 8099 writes. Every URL the page uses is relative (`./web/…`, `api/data`), so it works under the ingress path.

## Ingress

- The server listens on port 8099, Home Assistant's default ingress port. `addon/config.yaml` publishes no port.
- Port 8099 answers only Home Assistant's ingress address; any other peer gets 403 ([D5](decisions.md)).
- Port 8100, the sorter's endpoint, has no ingress check: other add-ons reach it on the internal network, with the key
  ([D29](decisions.md)). Port 8099 does not serve it.
- `HA_SPENDING_DEV=1` turns the check off, and binds `127.0.0.1` only ([D13](decisions.md)). The add-on never sets
  it; the fast loop does ([`testing.md`](testing.md#fast-loop)).
