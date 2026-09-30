import { describe, expect, it } from 'vitest';
import { LINES } from './lines';
import { fill, greetingContext, pickLine } from './pick';

describe('Chubbybara lines', () => {
  it('has a healthy library', () => {
    const total = Object.values(LINES).reduce((n, s) => n + s.lines.length, 0);
    expect(total).toBeGreaterThanOrEqual(200);
    for (const [ctx, set] of Object.entries(LINES)) expect(set.lines.length, ctx).toBeGreaterThanOrEqual(2);
  });

  it('only uses known placeholders', () => {
    const known = new Set(['name', 'coins', 'task', 'goal', 'left', 'streak', 'partner', 'item', 'debt']);
    for (const set of Object.values(LINES))
      for (const l of set.lines) for (const m of l.matchAll(/\{(\w+)\}/g)) expect(known.has(m[1]!), l).toBe(true);
  });

  it('fills variables and tidies spacing', () => {
    expect(fill('Hi {name}!', { name: 'Sam' })).toBe('Hi Sam!');
    expect(fill('Hi {name}!', {})).toBe('Hi!');
  });

  it('is stable for a seed and avoids lines missing variables', () => {
    const a = pickLine('taskDone', { seed: '2026-01-01:m1', vars: { coins: 10 } });
    const b = pickLine('taskDone', { seed: '2026-01-01:m1', vars: { coins: 10 } });
    expect(a.text).toBe(b.text);
    expect(a.text).not.toMatch(/\{/);
    expect(a.raw).not.toContain('{task}');
    expect(a.pose).toBe('cheer');
  });

  it('avoids recent lines', () => {
    const first = pickLine('allDone', { seed: 'x', vars: { name: 'A' } });
    const second = pickLine('allDone', { seed: 'x', vars: { name: 'A' }, recent: [first.raw] });
    expect(second.raw).not.toBe(first.raw);
  });

  it('greets by time of day', () => {
    expect(greetingContext(7)).toBe('morning');
    expect(greetingContext(13)).toBe('afternoon');
    expect(greetingContext(19)).toBe('evening');
    expect(greetingContext(2)).toBe('night');
  });
});
