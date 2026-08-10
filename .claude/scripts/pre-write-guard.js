#!/usr/bin/env node
/**
 * PreToolUse hook (Write): warn about files that fight the project's rules.
 *
 * Warns only, never blocks. Two checks:
 *  1. Documentation sprawl — PLAN.MD ss.32 says "do not create dozens of
 *     documentation files". Anything outside the allowed set gets a nudge.
 *  2. Committed secrets — a real `.env` written into the repo.
 */

'use strict';

const path = require('path');

const MAX_STDIN = 1024 * 1024;

const ALLOWED_DOC_BASENAMES =
  /^(README|CLAUDE|AGENTS|CONTRIBUTING|CHANGELOG|LICENSE|SKILL|MEMORY|PLAN)\.(md|MD)$/i;

function isAllowedDocPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (!/\.(md|txt)$/i.test(normalized)) return true;
  if (ALLOWED_DOC_BASENAMES.test(path.basename(normalized))) return true;
  if (/\.claude\/(commands|agents|rules|skills|plans)\//.test(normalized)) return true;
  if (/(^|\/)docs\//.test(normalized)) return true;
  return false;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const filePath = String(input.tool_input?.file_path || '');
    if (!filePath) return;

    const normalized = filePath.replace(/\\/g, '/');

    if (!isAllowedDocPath(normalized)) {
      console.error(
        `[Hook] ${path.basename(filePath)}: this project keeps documentation in README.md, CLAUDE.md and docs/. ` +
          'Fold this into an existing file unless a separate doc is genuinely needed.',
      );
    }

    if (/(^|\/)\.env$/.test(normalized) || /(^|\/)\.env\.(development|test|production|local)$/.test(normalized)) {
      console.error(
        '[Hook] Writing a real .env file. Secrets must never be committed — put placeholders in .env.example instead.',
      );
    }
  } catch {
    // ignore
  }
});
