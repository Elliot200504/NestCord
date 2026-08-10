---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git push:*), Bash(git commit:*), Bash(git branch:*), Bash(gh pr create:*)
description: Commit, push, and open a PR following NestCord conventions
---

## Context

- Current branch: !`git branch --show-current`
- Status: !`git status --short`
- Diff (staged + unstaged): !`git diff HEAD`
- Commits on this branch: !`git log main..HEAD --oneline`

## Your task

Do exactly these three steps, nothing more.

### 1. Commit

If the current branch is `main`, create a branch first (`feat/<slug>`, `fix/<slug>`, `chore/<slug>`).

Stage and commit using the Angular convention, in English:

```text
<type>(<scope>): <short description>

<optional body explaining why>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
Scopes: `api`, `web`, `db`, `shared`, `auth`, `messages`, `servers`, `channels`, `friends`, `dms`,
`gateway`, `deps`

Split into multiple commits when the work covers unrelated concerns.

### 2. Push

Push to origin, with `-u` if the branch is not yet tracking.

### 3. Create the PR

`gh pr create --title "..." --body "..."` (no `--template` — it conflicts with `--body`).

**Title:** `{icons} {Type}: {user-facing summary}`, max 72 characters, no branch names or internal
jargon.

| Icon | Type        | Icon | Type        |
| ---- | ----------- | ---- | ----------- |
| 🐛   | Fix         | ⚡   | Performance |
| 🚀   | Feature     | ✅   | Test        |
| 🎨   | Styling     | 👷   | CI          |
| 🛠️   | Refactoring | 📦   | Build       |
| 🔧   | Chore       | ⏪   | Revert      |
| 📚   | Docs        | ⬆️   | Version     |
| 🔥   | Critical    |      |             |

Multi-type PRs prepend secondary icons before the dominant one:
`🐛✅🚀 Feature: Messages now show who is typing`

**Body:**

```markdown
## Description

<what changed and why — required>

## Test Plan

- [ ] <step in plain language>
- [ ] <step in plain language>

## Notes

<migrations to run, new env vars, or anything the reviewer must do locally — omit if none>
```

Test Plan rules: written so a non-developer could follow each step. Describe what to click and what
should appear, using labels visible on screen. No route names, file names, function names, or table
names.

If a migration or a new environment variable is part of this PR, say so in Notes — reviewers need to
run `pnpm db:migrate` or update their `.env`.

If the work closes a GitHub issue, add `Closes #<n>` at the end of the Description. Otherwise omit it.
