# Security

## Reporting a vulnerability

Please report it privately through GitHub's security advisories:
<https://github.com/thomas3650/Ha-Spending/security/advisories/new>. Don't open a public issue for it.

## What the add-on holds

- The add-on holds a Firefly III Personal Access Token in its options. Only the add-on's server reads it; it never
  reaches the browser, a log line or an answer.
- The page never writes to Firefly III. Only the sorter's endpoint writes: a posting's category, its main group's tag
  and a withdrawal's shop, and it may make expense accounts ([`addon/DOCS.md`](addon/DOCS.md#the-sorters-endpoint)).
- Port 8099 answers only requests that come through Home Assistant's ingress. Port 8100, on only when `sorter_key` is
  set, answers only requests with that key, compared in constant time. The add-on publishes no port.
