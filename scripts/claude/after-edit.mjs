#!/usr/bin/env node
/**
 * PostToolUse hook (Edit/Write/MultiEdit): format the file with Prettier, then add a one-time
 * (per session) reminder of the rules and skill that apply to the area that was edited.
 */
import { readCache, readInput, rel, rulesFor, sh, writeCache } from './lib.mjs';

const input = await readInput();
const file = input.tool_input?.file_path;
if (!file) process.exit(0);
const path = rel(file);
if (path.startsWith('..')) process.exit(0); // outside the repo

// Prettier respects .prettierignore for explicit paths; --ignore-unknown skips other file types.
if (/\.(m?[jt]sx?|json|md|ya?ml|css|html)$/.test(path)) {
  try {
    sh('npx', ['--no-install', 'prettier', '--write', '--ignore-unknown', '--log-level', 'warn', path], { timeout: 30_000 });
  } catch (e) {
    // A syntax error surfaces here; say so instead of failing silently.
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `Prettier could not format ${path}: ${String(e.stderr ?? e).slice(0, 400)}`,
        },
      }),
    );
    process.exit(0);
  }
}

const rule = rulesFor(path);
if (!rule) process.exit(0);
const key = `reminders-${input.session_id ?? 'default'}.json`;
const shown = readCache(key, []);
if (shown.includes(rule.note)) process.exit(0);
writeCache(key, [...shown, rule.note]);
const skill = rule.skill ? ` (skill: \`${rule.skill}\`)` : '';
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `${rule.note}${skill}` } }));
