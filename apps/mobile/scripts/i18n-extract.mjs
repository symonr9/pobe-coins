// Collects every t('…') key (natural-language English) into locales/en.json.
// Translators copy it to locales/<lng>.json and translate the values.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const keys = new Set();
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f) && !f.includes('.test.')) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) keys.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
  }
};
walk('src');
// Chubbybara's lines, onboarding and help live in @pobe/core and are shown through t() too.
const core = await import('../../../packages/core/src/index.ts').catch(() => null);
if (core) {
  for (const set of Object.values(core.LINES)) for (const l of set.lines) keys.add(l);
  for (const o of core.ONBOARDING) (keys.add(o.title), keys.add(o.body));
  for (const tips of Object.values(core.HELP)) for (const tip of tips) (keys.add(tip.title), keys.add(tip.body));
}
mkdirSync('locales', { recursive: true });
const sorted = Object.fromEntries([...keys].sort().map((k) => [k, k]));
writeFileSync('locales/en.json', JSON.stringify(sorted, null, 2) + '\n');
console.log(`locales/en.json: ${keys.size} strings`);
