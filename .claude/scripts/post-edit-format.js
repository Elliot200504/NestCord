#!/usr/bin/env node
/**
 * PostToolUse hook: format edited files with the repo's Prettier.
 *
 * Self-contained (no shared lib). Runs `prettier --write` on the edited file
 * using the workspace-local binary. Fails silently when Prettier is not
 * installed yet (e.g. before the first `pnpm install`), so it never blocks work.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MAX_STDIN = 1024 * 1024;
const FORMATTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|css|scss|md|yaml|yml|prisma)$/i;

function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

function resolveBin(root, name) {
  const bin = path.join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${name}.cmd` : name,
  );
  return fs.existsSync(bin) ? bin : null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const filePath = input.tool_input?.file_path;
    if (!filePath || !FORMATTABLE.test(filePath) || !fs.existsSync(filePath)) return;

    const root = findRepoRoot(path.dirname(path.resolve(filePath)));

    // Prisma schema has its own formatter.
    if (/\.prisma$/i.test(filePath)) {
      const prismaBin = resolveBin(root, 'prisma');
      if (prismaBin)
        spawnSync(prismaBin, ['format', '--schema', filePath], { cwd: root, stdio: 'ignore' });
      return;
    }

    const prettierBin = resolveBin(root, 'prettier');
    if (!prettierBin) return; // dependencies not installed yet

    const result = spawnSync(prettierBin, ['--write', '--ignore-unknown', filePath], {
      cwd: root,
      stdio: 'ignore',
    });
    if (result.status !== 0) {
      console.error(`[Hook] Prettier could not format ${path.relative(root, filePath)}`);
    }
  } catch {
    // never block the edit
  }
});
