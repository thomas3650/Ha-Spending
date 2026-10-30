## What and why

<!-- One or two sentences. For non-trivial work, link the spec and plan. -->

Closes #

## Checklist

- [ ] Gates pass: `npm run lint`, `npm test` and `npm run build` in `addon/`; actionlint, zizmor and the link check
  (`node scripts/check-links.mjs`)
- [ ] Title type per `docs/releasing.md`: `feat`, `fix`, `docs`, `test`, `chore`, `refactor` or `ci`; user-visible →
  `feat` or `fix`; only `scripts/` or `.github/` → a non-releasing type
- [ ] UI change → Chrome screenshot at 1440×960 attached, no console errors
- [ ] Docs updated (same PR as the code)
- [ ] Lasting decision → `docs/decisions.md` entry
- [ ] Nothing from Firefly III: tokens, hostnames, IPs, account names, postings
- [ ] `reviewer` run on the branch
