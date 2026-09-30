/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('EXPO_PUBLIC_* env access', () => {
  // Expo inlines only the literal `process.env.EXPO_PUBLIC_X` form. Aliasing process.env or indexing
  // it dynamically compiles but leaves the value undefined in production bundles.
  it('always reads process.env.EXPO_PUBLIC_* literally', () => {
    const offenders = files(join(__dirname)).filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /=\s*process\.env\s*;|process\.env\[|\{[^}]*\}\s*=\s*process\.env\b/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
