---
name: ui-screen
description: Build or restyle a Pobe Coins screen or component with the design system — theme tokens, Plus Jakarta Sans Text variants, the ui/ kit, responsive phone/desktop layout, Chubbybara, i18n, accessibility and motion. Use for any change under apps/mobile/src (screens, layouts, themes, animations).
---

# Building UI in Pobe Coins

**Look and feel:** cozy, but sleek and modern. Pastel surfaces, deep-ink text, one family (Plus Jakarta Sans) with tight tracking on headings, generous whitespace, 14–20px radii, soft shadows, and springy but quick motion. Chubbybara brings the warmth; the type stays grown-up.

## Building blocks (use them; don't re-invent)

- `Screen` from `src/ui/layout.tsx` handles safe areas, scrolling and pull-to-refresh. Pass `wide` for dashboards, then use `Columns left right` for two columns at ≥900px. `useWide()` is available for other responsive tweaks.
- `Card` (`tint` for the soft variant), `Row`, `Stack`, `Section title action`.
- `Text` variants:
  - hero, h1 (one per screen, `accessibilityRole="header"`), h2, h3
  - title (list-item titles), body, small, smallBold
  - label (uppercase eyebrow, used for section headers)
  - number (tabular)
- `color`: 'ink' | 'soft' | 'accent' | 'onPrimary' | 'success' | 'warning' | 'danger', or a raw theme color.
- `Button` (primary | secondary | soft | ghost | danger, plus `small` and `full`), and `Pressy` for anything tappable (press-scale + haptics).
- Forms and misc: `Field`, `Segmented`, `ListRow`, `Sheet`, `EmptyState` (Chubbybara + line + action), `ProgressRing`, `Avatar`, `Icon` (names are the keys of `PATHS` in `src/ui/Icon.tsx`), `CoinAmount`/`PurseView`.
- Feedback: `useFeedback()` provides `toast` and `confirm` (never `Alert`). Celebrations use `useCelebrate()`.

## Rules

- Colors only from `useTheme().c` (`bg`, `surface`, `surfaceAlt`, `ink`, `inkSoft`, `primary`/`onPrimary`, `accent`, `line`, `shadow`, ...). Fonts only via `Text` variants or `theme.fonts`. No hex literals in screens.
- Every string goes through `t('Plain English')` with `{{vars}}`. Chubbybara's lines go through `say(context, { seed, vars })` and are rendered as-is. After adding strings, run `npm run i18n:extract -w @pobe/mobile`.
- Layout:
  - Phones first, in a single column ordered by what matters now.
  - Wide screens (web/tablet) get the side rail automatically; use `Columns` where two columns help.
  - Use `gap` for spacing, not margins. Give flex children holding text `minWidth: 0` and `numberOfLines` where they could overflow.
- Accessibility: meaningful `accessibilityLabel` on icon-only buttons, and `accessibilityRole` on custom controls. Touch targets ≥ 44px. Check contrast in both light and dark (theme tests cover tokens, not your combinations).
- Motion: `react-native-reanimated` entering animations (`FadeInDown.springify()`), with `MOTION` tokens for springs. Respect reduced motion; `Pressy` and `Chubby` already do.
- Navigation: `router.push('/path')` or `{ pathname: '/x/[id]', params }` (typed routes). New route files go in `src/app/`. Restart `expo start` if typed routes complain.
- Web and native differences: guard platform-only APIs with `Platform.OS` or a `.native.tsx`/`.ios.tsx` file split (see `src/widgets`, `src/features/share`).

## Verify

`npm run typecheck`, then `npm run screens` (with the servers running; see `dev-setup`). Open the phone and desktop PNGs and check alignment, truncation, and empty or loading states. For theme work, check a dark-mode shot too.
