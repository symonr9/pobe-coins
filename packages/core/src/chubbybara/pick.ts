import { LINES, type LineContext } from './lines';
import type { ChubbyPose } from '../art';

export type LineVars = Partial<Record<'name' | 'coins' | 'task' | 'goal' | 'left' | 'streak' | 'partner' | 'item' | 'debt', string | number>>;

/** Fills {placeholders}; unknown ones are dropped cleanly. */
export function fill(template: string, vars: LineVars): string {
  return template
    .replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = vars[k as keyof LineVars];
      return v === undefined || v === '' ? '' : String(v);
    })
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Small deterministic hash so a line stays stable for a day but varies across days. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface PickOptions {
  /** Seed; defaults to random. Use `${date}:${memberId}` for a line that's stable all day. */
  seed?: string;
  /** Recently shown lines to avoid. */
  recent?: string[];
  /** Skip lines that need a variable we don't have. */
  vars?: LineVars;
}

export function pickLine(context: LineContext, options: PickOptions = {}): { text: string; pose: ChubbyPose; raw: string } {
  const set = LINES[context];
  const vars = options.vars ?? {};
  const usable = set.lines.filter((l) => {
    const needed = [...l.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as keyof LineVars);
    return needed.every((k) => vars[k] !== undefined && vars[k] !== '');
  });
  const pool0 = usable.length ? usable : set.lines.filter((l) => !l.includes('{'));
  const pool1 = pool0.length ? pool0 : set.lines;
  const fresh = pool1.filter((l) => !options.recent?.includes(l));
  const pool = fresh.length ? fresh : pool1;
  const index = options.seed !== undefined ? hash(options.seed) % pool.length : Math.floor(Math.random() * pool.length);
  const raw = pool[index]!;
  return { text: fill(raw, vars), pose: set.pose, raw };
}

/** Greeting context for an hour of the day (household local). */
export function greetingContext(hour: number): LineContext {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}
