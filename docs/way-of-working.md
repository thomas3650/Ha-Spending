# Way of working

How changes are made in this repo. `CLAUDE.md` imports this doc, and the reviewer points here instead of copying it.
Hard rules live in `CLAUDE.md`; decisions in [`decisions.md`](decisions.md).

## 1. Roles

- **Thomas** approves specs, answers questions and gives the OK for anything that touches GitHub settings or the real
  Home Assistant.
- **Claude** (the main session, the controller) writes specs and plans, approves plans once `reviewer` rates them
  Ready, runs the build with subagents, tests, merges and releases.

## 2. Flow per feature

1. **Issue** on GitHub.
2. **Branch** `<type>/<topic>` off `main` (`feat`, `fix`, `docs`, `chore` …).
3. **Brainstorm** with Thomas for larger features (`superpowers:brainstorming`).
4. **Spec** in `docs/superpowers/specs/`. It says up front whether the change needs an update on the real Home
   Assistant. `reviewer` until Ready; then **Thomas approves**.
5. **Plan** in `docs/superpowers/plans/` (`superpowers:writing-plans`). Each task has a `Model:` tag and a
   `Review: yes|no` line. `reviewer` until Ready; then **Claude approves**.
6. **Build** with `superpowers:subagent-driven-development`: one subagent per task, test-first, and `reviewer` on the
   tasks marked `Review: yes`.
7. **Branch review:** `reviewer` on the whole branch until Ready.
8. **Test:** the gates, the fast loop, and for UI changes the Chrome check ([`testing.md`](testing.md)).
9. **PR:** title per [`releasing.md`](releasing.md#pr-titles), `Closes #n`, links to the spec and plan, the rulings and
   the decisions Claude made alone.
10. **Merge:** Claude squash-merges once CI is green and the branch review is Ready
    ([`releasing.md`](releasing.md#merging)).

### `Review: yes` or `no`

`yes` by default for anything with logic: the money rules, the Firefly III client and its normalisation, the ingress
check, the page's state and clicks, the workflows. `no` for scaffolding, config and docs.

### Review rounds

- After fixes the same reviewer re-reviews, up to 5 rounds. Then Claude rules.
- Every ruling goes in the PR description, because the SDD workspace (`.superpowers/`, git-ignored) is thrown away. A
  ruling that sets a lasting rule also gets an entry in `decisions.md`.
- A doubt about a test is a finding. Fixes go to a subagent, not to the reviewer.

### Trivial changes

A typo or a one-line doc fix with no behaviour change goes straight to a branch and a PR, without spec or plan.

## 3. The reviewer

There is one agent, `reviewer` (`.claude/agents/reviewer.md`, technical spec §10). It is read-only: it has `Read`,
`Grep` and `Glob`, and runs nothing.

- The dispatching session hands it the files to read: the spec, the plan, and for a branch the diff written to a file
  (`git diff BASE..HEAD`) with the test and CI results as the session ran them.
- It returns **Ready** or **Needs changes**.
- The plan's `Model:` tag picks the model of each task's subagent in the dispatch.
- Subagents never dispatch other subagents.

## 4. Conventions

- **Commits:** Conventional Commit messages, with the co-author trailer the dispatch gives. Subagents commit with
  `git commit -F <file>`, the message written to a unique file in the SDD workspace.
- **Git hooks** ([D6](decisions.md)): `scripts/setup` sets `core.hooksPath` to `.githooks/` once per clone.
  - `pre-commit` refuses a commit on `main`, runs gitleaks on the staged changes when it is installed, and runs
    actionlint and zizmor when a workflow is staged.
  - `pre-push` refuses a push to `main`.
  - `.claude/settings.json` denies pushes to `main` and `--no-verify`.
- **Branch protection** on `main` is meant to require CI; it is not set yet
  ([`releasing.md`](releasing.md#github-settings)).
- **Pushing:** Claude pushes feature branches. Nobody pushes to `main` or force-pushes.
- **GitHub settings** (branch protection, merge settings, secrets, Actions permissions, package visibility) change
  only with Thomas's OK.
- **Questions to Thomas:** plain terminal text, one at a time.
- **The real Home Assistant:** this project makes no changes there. A release reaches the house through the house
  session ([`releasing.md`](releasing.md#after-a-release)).
- **Backlog:** GitHub issues. Anything found that won't be fixed now becomes an issue.

## 5. Docs

- **One fact in one place.** Elsewhere, point to it.
- **General docs** explain why, conventions and structure. The code is the source for specifics.
- **Specs and plans are snapshots.** They aren't edited after merge. A later change gets a new spec and a decision-log
  entry.
- **Same PR:** docs change in the same PR as the code they describe.
- **Plain English:** short sentences, one fact per sentence.
- **Links:** `node scripts/check-links.mjs` checks that every relative link and `@` import in `CLAUDE.md`,
  `README.md`, `docs/` and `addon/*.md` points at a file that exists; CI runs it. It does not check `#anchors`.
- **Decision log:** a PR that makes a lasting decision adds an entry to `decisions.md`, numbered next. Entries aren't
  edited, except to set the status to `superseded by D<n>`, or `active; <part> superseded by D<n>`. The format:

  ```markdown
  ### D<n>: <title>
  - **Date:** YYYY-MM-DD · **Status:** active | superseded by D<m> | active; <part> superseded by D<m>
  - **Decision:** one or two sentences.
  - **Why:** one or two sentences.
  - **Source:** link to the spec section, or who decided and when.
  ```
