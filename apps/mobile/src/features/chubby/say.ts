import { fill, pickLine, type LineContext, type PickOptions } from '@pobe/core';
import { i18n } from '@/i18n';

/** Picks a Chubbybara line, translates the template, then fills in the placeholders. */
export function say(context: LineContext, options: PickOptions = {}) {
  const line = pickLine(context, options);
  return { ...line, text: fill(i18n.t(line.raw), options.vars ?? {}) };
}
