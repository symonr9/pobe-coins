# Chubbybara art brief

Chubbybara is a round, cute, lovable capybara based on our plushie. He runs the POBE Shop, gives affirmations and helps out. The app currently uses placeholder vector art (`packages/core/src/art.ts`); this brief is for the illustrator making the final art.

## Deliverables

One square illustration per **pose**, on a transparent background:

| Pose | Used for |
|---|---|
| `idle` | resting state, notifications, empty states |
| `happy` | home greeting, finished chores |
| `cheer` | celebrations: arms up, sparkles |
| `shopkeeper` | POBE Shop and purchases: little apron and bow tie |
| `sleepy` | night-time greeting, offline, errors |
| `thinking` | help, empty lists, "needs approval" |
| `wave` | onboarding, sign-in, join links |

Also needed:
- **Blink frame** for `idle` (eyes closed, otherwise identical). The app blinks every 4–7 seconds.
- **Accessories** as separate transparent layers that sit on the base poses: beanie, ribbon bow, winter scarf, yuzu crown, daisy clip, party hat, reading glasses. The apron, beanie, scarf and party hat pick up the user's theme color, so please also supply them in a neutral light grey that we can tint.
- **App icon** versions (1024×1024, full-bleed background, no transparency) for the five themes: Strawberry milk `#F9B9CD`, Sky puddle `#AAD3F4`, Lavender nap `#CFBCF5`, Butter toast `#FBE08C`, Matcha meadow `#AEE1BD`.

## Technical specs

- Canvas **1024 × 1024 px**, square, with the character centered and a soft ground shadow. Keep about 6% padding on each side.
- Formats: **SVG** preferred (it stays sharp everywhere and can be recolored). Otherwise **PNG @1x/2x/3x** at 240, 480 and 720 px.
- He should read clearly at 56 px (list rows) as well as at 180 px (onboarding).
- Signature details to keep: the **yuzu on his head** (from capybaras in yuzu hot springs), blush cheeks, the big soft snout, tiny ears, and a round, huggable shape.

## How the art is plugged in

Put the files in `apps/mobile/assets/chubbybara/` and point each pose at them in `apps/mobile/src/features/chubby/assets.ts`. Nothing else changes: the breathing and hop animations, the speech bubbles and the sizes all stay the same.
