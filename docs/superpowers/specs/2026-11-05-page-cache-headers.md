# The page's cache headers – design

**Real Home Assistant:** no change there. No new option and no new file in `/data`.

**Issue:** closes #184. It rides in the PR for #183, at Thomas's request ("can it be included").

**Approved:** by Claude, 2026-11-05, once `reviewer` rates it Ready. It is a small bug fix with the fix given in the
issue.

## 1. Why

After the 0.20.0 update, Chrome showed the old page inside Home Assistant's ingress frame. The add-on served the new
`index.html` and bundle. A hard reload reloads only Home Assistant's frame, not the add-on's page inside it.

The server answers `/` (`index.html`) with `Last-Modified` but no `Cache-Control`. So the browser may reuse its
cached copy by heuristic freshness. That old `index.html` points to the old hashed bundle.

- **Goal:** after an update the page loads the new version without the user clearing caches.
- **Non-goal:** the `/api/*` answers. They carry no `Last-Modified`, so a browser has nothing to cache them on by
  heuristic, and `/api/hidden-shops` already sends `Cache-Control: no-store`.

## 2. The rule

In `addon/server/src/app.ts`, where `serveStatic` serves the page:

- `GET /` (`index.html`) answers with `Cache-Control: no-cache`. The browser asks for it again on every load. The
  server's `serveStatic` answers a full `200`, never a `304`, which is fine for a file under a kilobyte.
- `GET /web/*` answers with `Cache-Control: public, max-age=31536000, immutable`. Every file under `web/` is a Vite
  bundle with a content hash in its name (`assetsDir: "web"` in `addon/web/vite.config.ts`), so a new version has a
  new name. `addon/web/scripts/check-dist.mjs` already checks that every URL in `index.html` starts with `./web/`; it
  now also checks that each such file name carries a hash, so an unhashed file can never be cached for a year.
- A path under `/web/` that does not exist answers `404` as today, with no `immutable` header. Claude's call: a
  missing file must not be cached for a year.
- The ingress check runs before these routes, as today.

## 3. Tests

Through the HTTP answers, in `addon/server/test/app.test.ts`, with a made-up web directory as the existing tests use:

- `/` answers `200` with `Cache-Control: no-cache`;
- a file under `/web/` answers `200` with `Cache-Control: public, max-age=31536000, immutable`;
- a missing file under `/web/` answers `404` without `immutable`.

## 4. Docs

- `docs/architecture.md`: the routes table gets the two cache headers.
- `docs/README.md`: the map gets this spec.
- No decision entry. This follows the HTTP rule for a hashed bundle and its page.

## 5. Plan

Claude's call: the plan is this section, not a file in `docs/superpowers/plans/`, for a fix of this size. One task, `Model: sonnet · Review: yes`. Write the three tests and see them fail. Then set the headers in `app.ts`
around the two `serveStatic` routes, only on a `200` from `/web/*`. Extend `addon/web/scripts/check-dist.mjs` with the hash check. Update
`docs/architecture.md`. Run the gates and
commit `fix: the page revalidates after an update, and its bundle is cached for good`.
