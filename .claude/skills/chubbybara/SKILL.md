---
name: chubbybara
description: Work on Chubbybara the capybara, the POBE Shop mascot — placeholder SVG art and poses, cosmetics/accessories, dropping in commissioned artwork, regenerating app icons, and writing his affirmation/help lines. Use for mascot art, icons, splash, or his dialogue.
---

# Chubbybara

He's round, soft and lovable (the household's plushie), and he runs the POBE Shop. The design brief for the illustrator is in `docs/design/mascot-spec.md`.

## Art

- Placeholder vector art: `packages/core/src/art.ts` → `chubbybaraSvg({ pose, accessory, accent, id, eyesClosed })`.
  - Poses: idle, happy, cheer, shopkeeper, sleepy, thinking, wave.
  - Accessories: none, beanie, bow, scarf, crown, flower, party-hat, glasses (sold as cosmetics in `cosmetics.ts`).
  - Cute-making rules: big glossy eyes set low with two highlights, a small snout, a tiny ω mouth, rosy cheeks, pink inner ears, toe beans, and his yuzu on top. Nothing angular; no frowns (even "thinking" smiles).
  - Keep gradient ids unique per instance (`id`). `SvgXml` needs aria attributes stripped (`forSvgXml` in `src/ui/Coins.tsx`).
- The app renders him via `apps/mobile/src/features/chubby/Chubby.tsx`, which adds a breathing bob, blinks and a bounce on `bounceKey`, and goes static under reduced motion.
- **Commissioned art drop-in:** add square PNG/SVG files under `apps/mobile/assets/chubbybara/` and point poses at them in the `COMMISSIONED` map in `src/features/chubby/assets.ts` (poses without art fall back to the SVG). Follow the sizes and safe areas in the mascot spec.
- **After any art change:**
  ```bash
  npx tsx apps/mobile/scripts/make-assets.ts   # app icons ×5 themes, adaptive icon, splash, favicon, PWA icons
  npx tsx docs/design/build-stylebook.ts        # style book page
  ```
  Look at `apps/mobile/assets/icons/icon-pink.png` and the rendered poses. For a quick check, render every pose to one HTML page and screenshot it with Playwright.

## Lines (his voice)

- Library: `packages/core/src/chubbybara/lines.ts`, grouped by context (greetings by time of day, taskDone, streak, goalReached, shopGreeting, iou, empty states, onboarding, help...). The picker (`pick.ts`) is seeded per day and avoids recent repeats.
- Voice: warm, short (≤ ~90 chars), a little playful, sometimes about yuzu, baths or naps. **Never** guilt, shame or pressure, especially about IOUs or missed chores. Use "we" and "you", not "the user".
- Placeholders (single braces): `{name}`, `{coins}`, `{task}`, `{goal}`, `{left}`, `{streak}`, `{partner}`, `{item}`, `{debt}`. In the app, use `say(context, { seed, vars })`; it translates and fills them. Don't wrap its output in `t()` again.
- Run `npm test -w @pobe/core`. `chubbybara/lines.test.ts` enforces known placeholders, ≤140 chars, ≥3 lines per context, no duplicates and no harsh words.
