import { describe, expect, it } from 'vitest';
import { COIN_STYLES, THEMES, contrast } from './theme';

describe('theme contrast (WCAG AA)', () => {
  for (const theme of Object.values(THEMES)) {
    for (const mode of ['light', 'dark'] as const) {
      const p = theme[mode];
      it(`${theme.name}/${mode}`, () => {
        for (const bg of [p.bg, p.surface, p.surfaceRaised, p.surfaceAlt]) {
          expect(contrast(p.ink, bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(p.inkSoft, bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(p.accent, bg)).toBeGreaterThanOrEqual(4.5);
          for (const s of [p.success, p.warning, p.danger]) expect(contrast(s, bg)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.onSecondary, p.secondary)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('coin labels are readable on coin faces', () => {
    for (const c of Object.values(COIN_STYLES)) expect(contrast(c.ink, c.face)).toBeGreaterThanOrEqual(4.5);
  });
});
