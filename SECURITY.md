# Security

## Reporting a vulnerability

Please report it privately through GitHub's security advisories:
<https://github.com/thomas3650/Ha-Spending/security/advisories/new>. Don't open a public issue for it.
Until private reporting is turned on for the repo, contact the owner through their GitHub profile instead.

## What the add-on holds

- Today the add-on holds no token and reads no data: its page only greets you and shows its version.
- A later version will hold a Firefly III Personal Access Token in its options. Only the add-on's server reads it; it
  never reaches the browser, a log line or an answer.
- The add-on never writes to Firefly III: the client that version adds sends only GET requests.
- It answers only requests that come through Home Assistant's ingress, and publishes no port.
