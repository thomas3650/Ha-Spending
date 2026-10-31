# Releasing

release-please releases the add-on as one component ([D9](decisions.md)). A merged PR never releases by itself: it
updates a **release PR**, and merging that release PR makes the release. The config is `release-please-config.json`;
the current version is in `.release-please-manifest.json`.

## Versions

- Strict semver. The first release is `0.1.0` (`initial-version`).
- While the major is 0, a breaking change bumps the **minor** (`bump-minor-pre-major`).
- release-please owns the version fields: `addon/config.yaml`, `addon/server/src/version.ts` and the manifest. Don't
  edit them by hand.

## The component

| | |
| --- | --- |
| Package | `addon/` (component `ha-spending`) |
| Released by | commits that change a file under `addon/` |
| Changelog | `addon/CHANGELOG.md`, written by release-please from the commits |
| Tag | `vX.Y.Z` |
| GitHub release | a draft that stays a draft |
| What users get | the image `ghcr.io/thomas3650/ha-spending:X.Y.Z`; Home Assistant offers the update |

A PR that changes only `docs/`, `scripts/`, `.github/` or a root file releases nothing, whatever its type.

## PR titles

PRs are squash-merged, so the PR title becomes the commit that release-please reads. The `pr-title` check allows these
types:

| Type | Release |
| --- | --- |
| `fix` | patch |
| `feat` | minor |
| `feat!`, `fix!` (breaking) | minor while the major is 0, major from 1.0.0 |
| `docs`, `test`, `chore`, `refactor`, `ci` | none |

- A user-visible change is a `feat` or a `fix`. There is no `perf`.
- Don't write changelog entries by hand.
- Dependabot's PRs are titled `chore(deps): …` and release nothing. For a bump users should get, retitle it
  `fix(deps): …` before the merge.

## Merging

The squash commit's subject must be the PR title. The repo keeps GitHub's default squash title, as Ha-Fitness does
([GitHub settings](#github-settings)), which takes a one-commit PR's commit message instead, so every merge names the
subject:

```bash
gh pr merge <n> --squash --subject "<PR title> (#<n>)"
```

## The workflows

- **`pr-title.yml`** (every PR): the title is a Conventional Commit of the types above.
- **`ci.yml`** (every PR and push to `main`): the jobs `node` (the add-on's gates), `integration` (`scripts/integration` against a real Firefly III, [`testing.md`](testing.md#integration-tests)),
  `addon-lint` (the add-on linter), `addon-build` (the gate over the per-arch image builds `addon-build (<arch>)`, nothing pushed) and `workflows`
  (actionlint, zizmor, the link check). The gate commands are in [`CLAUDE.md`](../CLAUDE.md#commands).
- **`gitleaks.yml`** (every PR and push to `main`): secrets in the history.
- **`release-please.yml`** (every push to `main`): the `release-please` job opens or updates the release PR. When the
  release PR is merged, it tags the merge commit and creates the draft release.
- **`addon-image.yml`** (a push to `main` that changes `addon/config.yaml`, or a manual dispatch on `main`): when GHCR
  has no image for the `version` in `addon/config.yaml`, it builds the image for aarch64 and amd64 and pushes `X.Y.Z`
  and `latest` with the multi-arch manifest. The version `0.0.0` is never built. It asks the registry with
  `GITHUB_TOKEN`, so a package that does not exist yet reads as missing ([D7](decisions.md)). It always builds the
  commit that set the version, so a make-up run ships the released code.

## Cutting a release

1. Merge feature PRs as usual ([`way-of-working.md`](way-of-working.md) §2). release-please keeps the release PR up
   to date.
2. Start the release PR's CI ([below](#the-release-prs-ci)), then merge it once green, with its title as the subject
   ([Merging](#merging)).
3. Check the result: `gh release list` shows the draft `vX.Y.Z`, and
   `gh run list --workflow addon-image.yml` shows a green run for it.
4. Check that the package is public ([GHCR visibility](#ghcr-visibility)).
5. Draft the house issue ([After a release](#after-a-release)).

### The release PR's CI

The `release-please` job opens the release PR with `github.token`, as `ha-claude-addon` does
([D25](decisions.md)), and a PR opened that way triggers no workflows. So the required checks never start by
themselves. Close and reopen the PR with Thomas's `gh` login, and CI runs on it:

```bash
gh pr close <n> && gh pr reopen <n>
```

Do this again after release-please updates the PR. The job tags the merge commit and drafts the release itself on the
release PR's merge.

## After a release

The house session installs a release on the Yellow (technical spec §8). Claude drafts an issue for it in
`thomas3650/house` and opens it only at Thomas's yes. It holds the version, what changed (from the changelog) and the
checks to run after installing. It holds nothing private: the repo is public, and the issue links to it.

## GHCR visibility

Only the multi-arch package `ha-spending` must be public: that is what Home Assistant pulls. The per-arch packages can
stay private. It was public from the first image, 0.1.0 (checked 2026-10-31). Check with an anonymous pull:

```bash
docker logout ghcr.io
docker pull --platform linux/arm64 ghcr.io/thomas3650/ha-spending:X.Y.Z
```

Changing the visibility needs Thomas's OK.

## The release-please token

No `RELEASE_PLEASE_TOKEN` is set ([D25](decisions.md)). `release-please.yml` still prefers one when it is set, so a
fine-grained token for this repo (Contents, Pull requests and Issues: read and write) would give release PRs CI by
themselves. Its expiry would then have to be tracked and renewed.

## GitHub settings

Set with `gh` on 2026-10-31 at Thomas's yes ([`way-of-working.md`](way-of-working.md) §4), as Ha-Fitness has them, except the release PR route:

- Squash merge only, with GitHub's default squash title; the branch deleted after merge.
- `main` protected: the required checks `pr-title`, `node`, `integration`, `addon-lint`, `addon-build`, `workflows`
  and `gitleaks`, linear history, no force pushes or deletions. Admins are not held to it.
- Private vulnerability reporting on ([`SECURITY.md`](../SECURITY.md)).

- "Allow GitHub Actions to create and approve pull requests" on, and no `RELEASE_PLEASE_TOKEN`, as `ha-claude-addon`
  has it, not Ha-Fitness ([D25](decisions.md)).

## When a release fails

- **`addon-image` fails:** re-run the failed jobs of the latest run for the current version
  (`gh run rerun <run-id> --failed`). That reuses its `prepare` outputs. A full re-run or a dispatch would find a
  manifest that was pushed before signing failed, and skip it: unsigned. Don't re-run a run whose version is older
  than the one in `addon/config.yaml`: it would push that older version as `latest`. Until the image is there, Home
  Assistant can't install the update.
- **`addon-image`'s registry check answers 401 or 403** for the package: the job's `GITHUB_TOKEN` may not read it, for
  example when the package is not linked to this repo ([D7](decisions.md)). Fix that, or the workflow, then start it
  on `main`: `gh workflow run addon-image.yml --ref main`.
- **A version has no `addon-image` run at all** (GitHub replaced its run in the queue, and no later run made it up):
  `gh workflow run addon-image.yml --ref main`. It builds the version in `addon/config.yaml` from the commit that set
  it when its image is missing, and skips it when the image is there.
- **The `release-please` job fails** with "GitHub Actions is not permitted to create or approve pull requests": the
  Actions setting is off again ([GitHub settings](#github-settings)). Turning it back on needs Thomas's OK.

## Bumping pins

- **The Node image:** Dependabot has no `docker` ecosystem here, so the `node:24-alpine` digest in `addon/Dockerfile`
  is bumped by hand ([D4](decisions.md)). Run `docker buildx imagetools inspect node:24-alpine` and take the top-level
  `Digest:` (the multi-arch index, not a per-platform manifest). Put it into both `FROM` lines, so the build and the
  runtime stage use the same Node. Title the PR `fix(deps): …` when users should get the new Node.
- **Firefly III:** the integration tests run against a pinned Firefly III image. When the Yellow's Firefly III is
  updated, the pin is bumped in the same change (technical spec §7.2). The version is in two places: the image tag and
  digest in `addon/dev/firefly/compose.yaml` (the digest from `docker buildx imagetools inspect
  fireflyiii/core:version-X.Y.Z`, the top-level `Digest:`), and the version the test expects in
  `addon/server/test-integration/firefly.test.ts`.
