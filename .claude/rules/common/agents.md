# Agents and Delegation

## Available agents

Defined in `.claude/agents/`:

| Agent               | Purpose                                  | When to use                                     |
| ------------------- | ---------------------------------------- | ----------------------------------------------- |
| `planner`           | Phased implementation plans              | Features touching 3+ files or the schema        |
| `architect`         | Module boundaries, data flow, trade-offs | Structural decisions, "where should this live"  |
| `code-reviewer`     | Quality and correctness review           | Immediately after writing a slice of code       |
| `security-reviewer` | Vulnerability review                     | Auth, input handling, uploads, permissions      |
| `doc-updater`       | README and docs refresh                  | After a feature changes setup, env, or commands |

## When to delegate

Delegate when the work is independent and the answer, not the file dump, is what matters — for
example: "map every place we compute permissions" or "review this diff".

Do not delegate a task you can finish in one or two file reads.

## Parallelism

Independent reviews run together, not one after the other. Reviewing the API changes, the web changes,
and the schema changes are three independent reads — launch them in one message.

## Scope discipline

Agents inherit the project's core constraint: **a few hundred users, no enterprise architecture**.
Any agent proposing Redis, microservices, or a repository layer is wrong for this repo unless the user
explicitly asked for it.
