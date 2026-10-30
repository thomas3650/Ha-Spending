# Architecture

One add-on with a server and a page ([D1](decisions.md)). The design, with what each part will own, is technical spec
§1 ([technical spec](superpowers/specs/2026-10-30-technical-design.md)). This doc says what exists now; the code is the
source for the details.

## The parts

| Part | Folder | Owns |
| --- | --- | --- |
| Server | `addon/server/` | The routes, the ingress check, serving the page's files |
| Page | `addon/web/` | What the browser shows; its texts in `src/i18n/da.ts` |
| Shared | `addon/shared/` | The types the server answers with and the page reads |

The server and the page reach each other only through the routes below.

## What exists now

The skeleton: the page says "Hej" and the server's version. There is no Firefly III client and no add-on option yet.

- **The server** is Hono on `@hono/node-server` ([D3](decisions.md)), in `addon/server/src/`. In the image it is one
  bundle at `/opt/ha-spending/server.mjs`, run by `node:24-alpine` ([D4](decisions.md)).
- **The page** is one Lit element, `<hs-app>`, built by Vite. In the image its build is at `/opt/ha-spending/web`, or
  wherever `HA_SPENDING_WEB_DIR` points.
- **The version** comes from `addon/server/src/version.ts`, which release-please bumps
  ([`releasing.md`](releasing.md#versions)).

## The routes

| Route | Answers |
| --- | --- |
| `GET /api/health` | `{"status": "ok", "version": "<version>"}`, typed `Health` in `addon/shared/` |
| any other `/api/…` | 404 |
| `GET /` and `GET /web/*` | the page's built files |

No route writes. Every URL the page uses is relative (`./web/…`, `api/health`), so it works under the ingress path.

## Ingress

- The server listens on port 8099, Home Assistant's default ingress port. `addon/config.yaml` publishes no port.
- It answers only Home Assistant's ingress address; any other peer gets 403 ([D5](decisions.md)).
- `HA_SPENDING_DEV=1` turns the check off. The add-on never sets it; the fast loop does
  ([`testing.md`](testing.md#fast-loop)).
