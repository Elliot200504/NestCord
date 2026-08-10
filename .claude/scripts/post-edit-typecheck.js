#!/usr/bin/env node
/**
 * PostToolUse hook: type-check after editing .ts/.tsx files.
 *
 * Walks up from the edited file to the nearest tsconfig.json, runs
 * `tsc --noEmit`, and reports only the errors that mention the edited file.
 * Silent when TypeScript is not installed yet.
 *
 * TypeScript strict mode is a hard project rule (PLAN.MD ss.31) — this hook is
 * the fast feedback loop for it, not a replacement for `pnpm build`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MAX_STDIN = 1024 * 1024;
const MAX_REPORTED = 15;

function findUp(startDir, filename) {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function resolveBin(fromDir, name) {
  let dir = fromDir;
  while (true) {
    const bin = path.join(dir, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
    if (fs.existsSync(bin)) return bin;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
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
    if (!filePath || !/\.tsx?$/.test(filePath) || !fs.existsSync(filePath)) return;

    const absolute = path.resolve(filePath);
    const tsconfig = findUp(path.dirname(absolute), 'tsconfig.json');
    if (!tsconfig) return;

    const projectDir = path.dirname(tsconfig);
    const tscBin = resolveBin(projectDir, 'tsc');
    if (!tscBin) return; // dependencies not installed yet

    const result = spawnSync(tscBin, ['--noEmit', '-p', tsconfig], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 120000,
    });

    const output = `${result.stdout || ''}${result.stderr || ''}`;
    if (!output.trim()) return;

    const basename = path.basename(absolute);
    const relevant = output
      .split('\n')
      .filter((line) => line.includes(basename) && line.includes('error TS'))
      .slice(0, MAX_REPORTED);

    if (relevant.length > 0) {
      console.error(`[Hook] TypeScript errors in ${basename}:`);
      relevant.forEach((line) => console.error(`  ${line.trim()}`));
    }
  } catch {
    // never block the edit
  }
});
