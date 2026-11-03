# Architecture

One add-on with a server and a page ([D1](decisions.md)). The design, with what each part will own, is technical spec
§1 ([technical spec](superpowers/specs/2026-10-30-technical-design.md)). This doc says what exists now; the code is the
source for the details.

## The parts

| Part | Folder | Owns |
| --- | --- | --- |
| Server | `addon/server/` | The routes, the ingress check, reading Firefly III, serving the page's files, the sorter's endpoint, the hidden shops' file |
| Page | `addon/web/` | What the browser shows; its texts in `src/i18n/da.ts` |
| Shared | `addon/shared/` | The types the server answers with and the page reads, and the money and date rules |
| Dev | `addon/dev/` | A fake Firefly III, the example data and the compose file for a real one ([D11](decisions.md)); test and dev only, never in the image |

The server and the page reach each other only through the routes below.

## What exists now

The server reads Firefly III and answers `/api/data`; the page fetches it and shows screens 1 to 4 of the
[UI spec](superpowers/specs/2026-10-30-ui-ux-design.md) and the subscriptions card of the
[subscriptions spec](superpowers/specs/2026-11-01-subscriptions.md) and the
[object groups spec](superpowers/specs/2026-11-01-object-groups.md). The Butikker card of the
[top shops spec](superpowers/specs/2026-11-02-top-shops.md) lists the shops with the most spending and hides some.
The detail of a fixed expense, a posting or a shop, in the
[detail view spec](superpowers/specs/2026-11-02-detail-view.md), opens from a row on the Posteringer and Faste udgifter
cards and on Alle posteringer ([D44](decisions.md)).

- **The server** is Hono on `@hono/node-server` ([D3](decisions.md)), in `addon/server/src/`. In the image it is one
  bundle at `/opt/ha-spending/server.mjs`, run by `node:24-alpine` ([D4](decisions.md)).
- **The page** is a Lit element, `<hs-app>`, built by Vite. In the image its build is at `/opt/ha-spending/web`, or
  wherever `HA_SPENDING_WEB_DIR` points. Its parts, in `addon/web/src/`:
  - `state/`: the view state and its hash ([D20](decisions.md)), and the actions that change it;
  - `model/`: the pure functions from an answer and the view state to what is shown (circle, key numbers, postings,
    filters);
  - `screens/` and `components/`: the screens and the cards, dropdowns and lists they use;
  - `charts/echarts.ts`: the one wrapper around ECharts, which the component tests mock ([D19](decisions.md));
  - `data/api.ts`: the fetch of `api/data` and of the hidden shops.
  The build is one JS chunk ([D19](decisions.md)).
- **The Firefly III client** (`addon/server/src/firefly/`) has a `get`, a `put` and a `post`. It pages through the
  answers and maps them to postings and subscriptions ([D12](decisions.md), [D15](decisions.md)). Only the sorter's
  `set_category` ([D29](decisions.md)) and the chat's `move_posting` ([D34](decisions.md)) call `put`, and `post` only
  to make a shop's expense account ([D32](decisions.md)).
- **The sorter's endpoint** (`addon/server/src/sorter/`) is a second Hono app on port 8100, started only when
  `sorter_key` is set ([D29](decisions.md)): `http.ts` holds the key check and MCP's JSON-RPC, `tools.ts` the tools
  `start` and `set_category` and their limits, and `chat.ts` the chat's tools `find_postings`, `get_posting`,
  `spending` and `move_posting` ([D34](decisions.md)). Their contract is in
  [`addon/DOCS.md`](../addon/DOCS.md#the-sorters-endpoint).
- **The options** are read once at start from `/data/options.json`, or from `HA_SPENDING_OPTIONS`. Without a Firefly III
  address and token the server logs what is missing and exits 1.
- **The hidden shops** are a file, `/data/hidden-shops.json` or `HA_SPENDING_HIDDEN_SHOPS`, read on every request and
  replaced whole on a write (`addon/server/src/hidden-shops.ts`, [D43](decisions.md)).
- **The cache** keeps an answer per day and period for 5 minutes. It keeps the parts that do not depend on the
  period for 5 minutes per day, so a new day reads them again: the main-group rules, the categories, the asset
  accounts, the earliest posting date and the subscriptions (`addon/server/src/loader.ts`,
  `addon/server/src/cache.ts`, [D49](decisions.md)).
- **The version** comes from `addon/server/src/version.ts`, which release-please bumps
  ([`releasing.md`](releasing.md#versions)).

## The routes

| Route | Answers |
| --- | --- |
| `GET /api/health` | `{"status": "ok", "version": "<version>"}`, typed `Health` in `addon/shared/` |
| `GET /api/data?start=YYYY-MM-DD&end=YYYY-MM-DD` | the postings of the period, the household's subscriptions with their object groups and last payments (the server reads all bills of the 760 days before today; only a bill with an object group is a subscription, and only for it does the server read the posting of its last payment), each posting with the bill it is linked to and what the page needs around them, typed `SpendingData` in `addon/shared/`; errors are the codes of `DataError` ([D18](decisions.md)) |
| `GET /api/hidden-shops` | the shops hidden from the Butikker card, `{"shops": [...]}`, typed `HiddenShops` in `addon/shared/`, never cached |
| `POST /api/hidden-shops` | hides or shows one shop, `{"shop": "…", "hidden": true}`, and answers the whole list as the GET does ([D43](decisions.md)) |
| any other `/api/…` | 404 |
| `GET /` and `GET /web/*` | the page's built files |

Only the `POST` above writes on port 8099, and only to its file ([D43](decisions.md)). Every URL the page uses is
relative (`./web/…`, `api/data`, `api/hidden-shops`), so it works under the ingress path.

## Ingress

- The server listens on port 8099, Home Assistant's default ingress port. `addon/config.yaml` publishes no port.
- Port 8099 answers only Home Assistant's ingress address; any other peer gets 403 ([D5](decisions.md)).
- Port 8100, the sorter's endpoint, has no ingress check: other add-ons reach it on the internal network, with the key
  ([D29](decisions.md)). Port 8099 does not serve it.
- `HA_SPENDING_DEV=1` turns the check off, and binds `127.0.0.1` only ([D13](decisions.md)). The add-on never sets
  it; the fast loop does ([`testing.md`](testing.md#fast-loop)).
