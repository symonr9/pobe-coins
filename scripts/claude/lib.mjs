/**
 * Shared helpers for the Claude Code hooks in .claude/settings.json.
 * Hooks receive a JSON payload on stdin and answer with JSON on stdout.
 * Docs: https://code.claude.com/docs/en/hooks
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.CLAUDE_PROJECT_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE = join(ROOT, '.claude/.cache');

export async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export function rel(path) {
  return relative(ROOT, resolve(ROOT, path)).split('\\').join('/');
}

export function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

export function readCache(name, fallback) {
  try {
    return JSON.parse(readFileSync(join(CACHE, name), 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeCache(name, value) {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(join(CACHE, name), JSON.stringify(value));
}

export function exists(path) {
  return existsSync(join(ROOT, path));
}

/**
 * Which skill (and which reminder) applies to an edited file.
 * Order matters: the first match wins. Keep in sync with .claude/skills/.
 */
export const PATH_RULES = [
  {
    test: /^packages\/(core\/src\/(coins|ledger)\.ts|functions\/src\/services\/money\.ts)$/,
    skill: 'money-changes',
    note: 'Coin math / money path edited. Every purse change must go through commitMoney with a ledger entry, and needs a test in packages/core or packages/functions/src/tests/money.test.ts.',
  },
  {
    test: /^packages\/functions\/src\/(app\.ts|services\/|repo\.ts|db\/)|^packages\/core\/src\/schemas\.ts$/,
    skill: 'api-endpoint',
    note: 'API edited. Validate input with a zod schema from @pobe/core, derive householdId from the token only, and cover the route in packages/functions/src/tests (including another-household isolation).',
  },
  {
    test: /^packages\/core\/src\/art\.ts$|^apps\/mobile\/src\/features\/chubby\//,
    skill: 'chubbybara',
    note: 'Chubbybara art edited. Render the poses to check them, then regenerate icons: npx tsx apps/mobile/scripts/make-assets.ts (and the style book: npx tsx docs/design/build-stylebook.ts).',
  },
  {
    test: /^packages\/core\/src\/chubbybara\//,
    skill: 'chubbybara',
    note: "Chubbybara's lines edited. Keep his voice: warm, short, never guilt-tripping about IOUs. Placeholders use single braces: {name}, {coins}, {task}, {goal}, {left}, {streak}, {partner}, {item}, {debt}. lines.test.ts checks them.",
  },
  {
    test: /^packages\/core\/src\/theme\.ts$/,
    skill: 'ui-screen',
    note: 'Theme tokens edited. packages/core tests check WCAG AA contrast for every theme; run them, then check both light and dark screenshots.',
  },
  {
    test: /^apps\/mobile\/src\/widgets\//,
    skill: 'release-mobile',
    note: "Widget code edited. iOS widget layouts must be `function` declarations with the 'widget' directive (the Babel plugin stringifies them). Verify with a native bundle export.",
  },
  {
    test: /^apps\/mobile\/(app\.config\.ts|eas\.json|package\.json|index\.js)$/,
    skill: 'expo-upgrade',
    note: 'Native config or dependencies edited. Pin Expo packages to node_modules/expo/bundledNativeModules.json and check `npx expo prebuild --clean` still generates the targets (throwaway, never commit ios/ or android/).',
  },
  {
    test: /^apps\/mobile\/src\//,
    skill: 'ui-screen',
    note: 'UI edited. Use theme tokens (useTheme), the ui/ kit, t() for strings (then npm run i18n:extract -w @pobe/mobile), say() for Chubbybara, and check phone + desktop with `npm run screens`.',
  },
  {
    test: /^sst\.config\.ts$|^netlify\.toml$/,
    skill: 'deploy',
    note: 'Infrastructure edited. Keep the cost guardrails (no VPC/NAT, on-demand DynamoDB, 2-week logs) and update README deploy docs if inputs changed.',
  },
  {
    test: /^\.gitignore$/,
    skill: null,
    note: 'Anchor native-dir patterns (/apps/mobile/ios/). A bare `android/` once ignored src/widgets/android and broke CI.',
  },
];

export function rulesFor(file) {
  const r = rel(file);
  return PATH_RULES.find((rule) => rule.test.test(r));
}
