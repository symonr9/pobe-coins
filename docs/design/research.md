# UX/UI research notes

What we took from cozy, gamified habit and money apps, and how it shapes Pobe Coins.

## Reference apps

| App | What works | What we borrow |
|---|---|---|
| **Finch** (self-care pet) | Onboarding opens by meeting the pet, not a feature list. Soft pastels and rounded shapes reduce "app fatigue". Progress feeds a visible meter tied to the pet. Kind, judgment-free tone. | Chubbybara greets you on first launch and walks you through setup. Pastel surfaces, rounded 16–24px corners. Gentle copy: IOUs and missed streaks are nudges, never scolding. |
| **Duolingo** | Celebration size scales with effort. Feedback is immediate after the action. The mascot carries emotion. Streaks are the core retention loop. Tiny animations are quick (<1s) so they don't get tiring. | Three celebration tiers: *tap* (coin pop + haptic, 300ms), *milestone* (Chubbybara cheer + coin shower, 1.2s), *big moment* (goal reached / Wrapped: confetti + sound). Streak flames on recurring chores. |
| **Habitica** | Real tasks turn into game rewards; custom rewards the group defines. | The POBE Shop's household rewards catalog ("Breakfast in bed: 50"). |
| **Monzo pots / Qapital** | Savings goals as containers with a progress fill; move money in with one tap. | Wishlist goals as jars that fill with coins; shared goals show each member's share. |
| **Sweepy / Tody** | Recurring chores with a "freshness" state; rotation between housemates. | Recurring chores with rotation and a due/overdue state. |
| **Apple Fitness** | Rings as an at-a-glance summary; widgets and notifications do the daily work. | Progress rings for goals, streaks and co-op challenges; a home-screen widget with purse + today's chores. |

## Principles for Pobe Coins

1. **Coins are physical.** Always show coins as coins (colored by denomination), not just a number. The total sits beside them. Change-making is shown before you confirm a spend.
2. **Cause and effect is visible.** Every purchase shows what paid for it ("Dishes ×3, Deep clean"). Every earning shows where it went.
3. **Kind by default.** Chubbybara never shames. Missed streaks say "fresh start", and IOUs say "you'll catch up".
4. **Fast first, delightful second.** Actions finish in one tap and the UI updates right away (optimistic). Animation plays *after* the state is safe, never blocking input.
5. **Celebrate in proportion.** Small things get small feedback; milestones get Chubbybara.
6. **Thumb-first layout.** Primary actions sit in the bottom half; a floating "+" for task/spend; tab bar at the bottom on phones, side rail on wide web.

## Color & accessibility

- Pastels are used only for **surfaces and fills**. All text uses each theme's deep "ink" tones. `packages/core/src/theme.test.ts` enforces WCAG AA (≥ 4.5:1) for every text/surface pair in all 10 theme × mode combinations, plus coin labels on coin faces.
- Pastel-on-pastel text is the most common failure in soft palettes, so text never uses the pastel hue directly.
- State is never communicated by color alone: pending items get an hourglass icon and a label, and overdue items get an icon and a label.

## Motion

- Micro-interactions: 120–200ms; sheets and transitions: ~320ms spring (damping 16, stiffness 220).
- Coin drop: coins fall into the purse with a bouncy spring, staggered 60ms each, and the counter ticks up as they land.
- Chubbybara idle: slow 3.2s "breathing" scale (1 → 1.02) and a blink every 4–7s.
- **Reduce motion**: all movement becomes a 150ms fade; confetti and coin showers are replaced by a static "+30" badge. Haptics still play (they're separate from visual motion).

## Sources
- [Finch UX teardown (Medium)](https://medium.com/@deepthi.aipm/ux-teardown-finch-self-care-app-18122357fae7)
- [Design critique: Finch (Pratt IXD)](https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/)
- [Duolingo: gamification as design language](https://blakecrosley.com/guides/design/duolingo)
- [Micro-interactions on Duolingo](https://medium.com/@Bundu/little-touches-big-impact-the-micro-interactions-on-duolingo-d8377876f682)
- [Micro-interaction examples (Eleken)](https://www.eleken.co/blog-posts/micro-interactions)
- [Accessible color palettes (Venngage)](https://venngage.com/blog/accessible-colors/)
- [Adding a high-contrast toggle to a pastel site (DEV)](https://dev.to/ingosteinke/add-a-high-contrast-theme-toggle-to-a-pastel-website-4kjn)
