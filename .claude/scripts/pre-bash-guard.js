#!/usr/bin/env node
/**
 * PreToolUse hook (Bash): reminders for risky or off-convention commands.
 * Warns on stderr and always passes the command through.
 */

'use strict';

const MAX_STDIN = 1024 * 1024;

const CHECKS = [
  {
    test: /\bgit\s+push\b/,
    message:
      'About to push. Confirm `pnpm lint`, `pnpm build` and the relevant tests passed first.',
  },
  {
    test: /\b(npm|yarn)\s+(install|add|run|i)\b/,
    message:
      'This repo is a pnpm workspace. Use `pnpm ...` (and `pnpm --filter <pkg> ...`) instead of npm/yarn.',
  },
  {
    test: /\bprisma\s+migrate\s+reset\b|\bpnpm\s+db:reset\b/,
    message:
      'This drops the database. Make sure that is intended and that the seed script can rebuild the data.',
  },
  {
    test: /\bprisma\s+db\s+push\b/,
    message:
      'This project uses Prisma migrations (PLAN.MD ss.29). Prefer `prisma migrate dev` over `db push`.',
  },
];

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const cmd = String(input.tool_input?.command || '');
    for (const check of CHECKS) {
      if (check.test.test(cmd)) console.error(`[Hook] ${check.message}`);
    }
  } catch {
    // ignore parse errors
  }
  process.stdout.write(raw);
});
