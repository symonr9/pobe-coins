import { describe, expect, it } from 'vitest';
import { HELP, LINES, ONBOARDING } from './lines';
import { fill } from './pick';

const PLACEHOLDERS = new Set(['name', 'coins', 'task', 'goal', 'left', 'streak', 'partner', 'item', 'debt']);
// Words Chubbybara never uses: he is never shaming or pushy.
const HARSH = /\b(lazy|failed|failure|shame|disappoint|should have|hurry up|pathetic|bad job)\b/i;

describe("Chubbybara's lines", () => {
  const all = Object.entries(LINES).flatMap(([ctx, set]) => set.lines.map((line) => [ctx, line] as const));

  it('has a few lines for every context so he does not repeat himself', () => {
    for (const [ctx, set] of Object.entries(LINES)) expect(set.lines.length, ctx).toBeGreaterThanOrEqual(3);
  });

  it('only uses known placeholders', () => {
    for (const [ctx, line] of all) {
      for (const [, key] of line.matchAll(/\{(\w+)\}/g)) expect(PLACEHOLDERS.has(key!), `${ctx}: ${line}`).toBe(true);
      expect(line, `${ctx}: use {name}, not {{name}}`).not.toMatch(/\{\{/);
    }
  });

  it('keeps lines short enough for a speech bubble', () => {
    for (const [ctx, line] of all)
      expect(fill(line, { name: 'Alexandra', task: 'Clean the bathroom' }).length, `${ctx}: ${line}`).toBeLessThanOrEqual(140);
  });

  it('stays kind', () => {
    for (const [ctx, line] of all) expect(line, ctx).not.toMatch(HARSH);
  });

  it('has no duplicate lines within a context', () => {
    for (const [ctx, set] of Object.entries(LINES)) expect(new Set(set.lines).size, ctx).toBe(set.lines.length);
  });

  it('has onboarding and help copy', () => {
    expect(ONBOARDING.length).toBeGreaterThan(0);
    expect(Object.keys(HELP).length).toBeGreaterThan(0);
  });
});
