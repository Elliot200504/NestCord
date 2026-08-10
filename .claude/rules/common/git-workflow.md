# Git Workflow

## Commit messages

Angular convention, in English:

```text
<type>(<optional scope>): <short description>

<optional body>

<optional footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Useful scopes for this repo: `api`, `web`, `db`, `shared`, `auth`, `messages`, `servers`, `channels`,
`friends`, `dms`, `gateway`, `deps`.

Examples:

```text
feat(messages): add cursor-based pagination to channel history
fix(auth): rotate refresh token hash on every refresh
chore(deps): upgrade prisma to 6.3
```

## Branches

Branch off `main`. Name branches `feat/<slug>`, `fix/<slug>`, or `chore/<slug>`. Never commit
directly to `main` unless the user asks.

## Pull requests

Use `/commit-push-pr`. When writing a PR:

1. Read the whole branch history, not only the last commit (`git diff main...HEAD`).
2. Write a description that explains *why*, not just *what*.
3. Include a test plan written in plain language a non-developer could follow.
4. Push new branches with `-u`.

### Title format

`{icons} {Type}: {user-facing summary}` — max 72 characters, no branch names or internal jargon.

| Icon | Type                                 |
| ---- | ------------------------------------ |
| 🐛   | Fix — bug fix                        |
| 🎨   | Styling — UI/CSS changes             |
| 🚀   | Feature — new functionality          |
| 🛠️   | Refactoring — code structure         |
| 🔧   | Chore — maintenance, tooling, deps   |
| ⚡   | Performance                          |
| ✅   | Test — add or update tests           |
| 👷   | CI — pipeline changes                |
| 📦   | Build — build system, external deps  |
| ⏪   | Revert                               |
| ⬆️   | Version — release                    |
| 📚   | Documentation                        |
| 🔥   | Critical — hotfix                    |

Multi-type PRs prepend secondary icons before the dominant one:
`🐛✅🚀 Feature: Messages now show who is typing`

### Origin

If the branch or work relates to a GitHub issue, link it in the body as `Closes #123`. Otherwise omit
the section — never leave a placeholder.
