#!/usr/bin/env node
/**
 * UserPromptSubmit hook: when a request matches a maintenance area, point Claude at the
 * skill that holds the playbook for it. Silent when nothing matches.
 */
import { readInput } from './lib.mjs';

const ROUTES = [
  [/\b(coin|purse|iou|debt|ledger|refund|change[- ]making|balance|gift|transfer)s?\b/i, 'money-changes'],
  [/\b(endpoint|route|api|lambda|hono|dynamo|schema|zod|backend)\b/i, 'api-endpoint'],
  [/\b(screen|page|layout|ui|ux|design|theme|colou?r|font|button|card|animation|dark mode)\b/i, 'ui-screen'],
  [/\b(chubby|chubbybara|capybara|mascot|affirmation|illustrat|artwork|app icon)/i, 'chubbybara'],
  [/\b(deploy|sst|aws|netlify|cognito|secret|budget|stage|prod)\b/i, 'deploy'],
  [/\b(eas|testflight|app store|play store|release|submit|ota|widget|share extension|native build)\b/i, 'release-mobile'],
  [/\b(upgrade|bump|sdk \d+|expo sdk|dependency|dependencies|npm install|package version)\b/i, 'expo-upgrade'],
  [/\b(run (it|the app|locally)|dev server|local(ly)?|set ?up|getting started|seed|demo)\b/i, 'dev-setup'],
  [/\b(test|verify|check|ci|screenshot|e2e|playwright|broken|failing|regression)\b/i, 'verify'],
];

const { prompt = '' } = await readInput();
if (prompt.trim().startsWith('/')) process.exit(0); // explicit slash command already chosen
const skills = [...new Set(ROUTES.filter(([re]) => re.test(prompt)).map(([, s]) => s))].slice(0, 3);
if (skills.length) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `Relevant project skills for this request: ${skills.map((s) => `\`${s}\``).join(', ')}. Load them with the Skill tool before starting if you haven't this session.`,
      },
    }),
  );
}
