/**
 * Builds docs/design/stylebook.html from the real design tokens and art in @pobe/core.
 * Run: npx tsx docs/design/build-stylebook.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHUBBY_ACCESSORIES, CHUBBY_POSES, chubbybaraSvg, coinSvg } from '../../packages/core/src/art';
import { COIN_STYLES, MOTION, THEMES, THEME_NAMES, contrast } from '../../packages/core/src/theme';

const coins = [100, 50, 25, 10, 5, 1];
const data = {
  themes: THEMES,
  order: THEME_NAMES,
  coins: Object.fromEntries(coins.map((d) => [d, coinSvg(d, 56)])),
  coinNames: Object.fromEntries(coins.map((d) => [d, COIN_STYLES[d]!.name])),
  poses: Object.fromEntries(CHUBBY_POSES.map((p) => [p, chubbybaraSvg({ pose: p, id: `p-${p}`, accent: '__ACCENT__' })])),
  accessories: Object.fromEntries(
    CHUBBY_ACCESSORIES.map((a) => [a, chubbybaraSvg({ pose: 'happy', accessory: a, id: `a-${a}`, accent: '__ACCENT__' })]),
  ),
  contrast: Object.fromEntries(
    THEME_NAMES.flatMap((t) =>
      (['light', 'dark'] as const).map((m) => {
        const p = THEMES[t][m];
        return [`${t}-${m}`, { ink: contrast(p.ink, p.bg), soft: contrast(p.inkSoft, p.surfaceAlt), btn: contrast(p.onPrimary, p.primary) }];
      }),
    ),
  ),
  motion: MOTION,
};

const pink = THEMES.pink;
const tokenKeys = Object.keys(pink.light) as (keyof typeof pink.light)[];
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const block = (prefix: 'l' | 'd', p: typeof pink.light) =>
  tokenKeys.map((k) => `--${prefix}-${kebab(k)}: ${p[k]};`).join(' ');
const use = (prefix: 'l' | 'd') => tokenKeys.map((k) => `--${kebab(k)}: var(--${prefix}-${kebab(k)});`).join(' ');

const html = `<title>Pobe Coins Style Book</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap">
<style>
/* Layout: one cozy column (max 1040px) of chapters; each chapter = label + live specimen. Theme picker restyles everything. */
:root {
  ${block('l', pink.light)}
  ${block('d', pink.dark)}
  ${use('l')}
  --display: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --body: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --r-sm: 10px; --r-md: 16px; --r-lg: 24px;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${use('d')} color-scheme: dark; } }
:root[data-theme="dark"] { ${use('d')} color-scheme: dark; }

* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 16px; line-height: 1.55; margin: 0; padding-inline: 16px; transition: background .3s ease, color .3s ease; }
.wrap { max-width: 1040px; margin: 0 auto; padding-block: 28px 80px; }
h1, h2, h3 { font-family: var(--display); line-height: 1.1; text-wrap: balance; margin: 0; }
h2 { font-size: 30px; font-weight: 700; }
h3 { font-size: 20px; font-weight: 700; }
p { margin: 0; max-width: 65ch; }
.soft { color: var(--ink-soft); }
.eyebrow { font-weight: 800; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

/* Hero */
.hero { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 24px; align-items: center; padding-block: 12px 28px; }
.hero h1 { font-size: clamp(40px, 7vw, 68px); font-weight: 800; letter-spacing: -.01em; }
.hero h1 span { color: var(--accent); }
.hero .lede { font-size: 18px; margin-top: 12px; }
.chubby-stage { position: relative; aspect-ratio: 1; max-width: 320px; width: 100%; justify-self: center; }
.chubby-stage::before { content: ''; position: absolute; inset: 8%; border-radius: 50%; background: var(--surface-alt); }
.chubby-stage .bubble { position: absolute; left: -6%; top: 2%; background: var(--surface); border: 2px solid var(--line); border-radius: 18px 18px 18px 4px; padding: 10px 14px; font-weight: 700; font-size: 15px; max-width: 70%; box-shadow: 0 6px 20px var(--shadow); }
.breathe { position: relative; animation: breathe 3.2s ease-in-out infinite; transform-origin: 50% 90%; }
@keyframes breathe { 50% { transform: scale(1.025, 1.015) translateY(-1%); } }

.picker { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
.swatch-btn { display: inline-flex; align-items: center; gap: 8px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 6px 14px 6px 6px; font: 700 14px var(--body); cursor: pointer; transition: transform .12s ease, border-color .2s; }
.swatch-btn:hover { transform: translateY(-1px); }
.swatch-btn:active { transform: scale(.96); }
.swatch-btn[aria-pressed="true"] { border-color: var(--accent); background: var(--surface-alt); }
.swatch-btn i { width: 24px; height: 24px; border-radius: 50%; display: block; border: 2px solid rgba(0,0,0,.08); }

/* Chapters */
.chapter { display: grid; gap: 18px; padding-block: 36px; border-top: 2px dashed var(--line); }
.chapter > header { display: grid; gap: 6px; }
.grid { display: grid; gap: 14px; }
.cols-5 { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
.card { background: var(--surface); border: 1.5px solid var(--line); border-radius: var(--r-lg); padding: 16px; box-shadow: 0 4px 16px var(--shadow); min-width: 0; }

/* Palettes */
.pal { border-radius: var(--r-lg); overflow: hidden; border: 1.5px solid var(--line); background: var(--surface); }
.pal .top { padding: 14px; display: grid; gap: 2px; }
.pal .chips { display: grid; grid-template-columns: repeat(4, 1fr); height: 46px; }
.pal .meta { padding: 10px 14px 14px; font-size: 13px; display: grid; gap: 2px; font-variant-numeric: tabular-nums; }
.pal.active { outline: 3px solid var(--accent); outline-offset: 2px; }

/* Type */
.type-row { display: grid; grid-template-columns: 110px minmax(0,1fr); gap: 16px; align-items: baseline; padding-block: 8px; border-bottom: 1px solid var(--line); }
.type-row code { font-size: 12px; color: var(--ink-soft); }

/* Coins */
.coins { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.coin-card { display: grid; justify-items: center; gap: 6px; text-align: center; padding: 14px 10px; }
.coin-card svg { width: 64px; height: 64px; }
.coin-card b { font-family: var(--display); font-size: 17px; }

/* Chubbybara */
.poses { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
.pose { display: grid; justify-items: center; gap: 4px; padding: 10px; }
.pose svg { width: 100%; max-width: 130px; height: auto; }
.pose span { font-weight: 800; font-size: 13px; }

/* Motion demo */
.demo { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; }
.purse { position: relative; overflow: hidden; min-height: 300px; display: grid; align-content: space-between; }
.purse .total { font-family: var(--display); font-size: 56px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.purse .stack { display: flex; flex-wrap: wrap; gap: 6px; min-height: 64px; align-items: flex-end; }
.purse .stack .c { display: grid; justify-items: center; font-size: 12px; font-weight: 800; color: var(--ink-soft); }
.purse .stack svg { width: 40px; height: 40px; }
.drop { position: absolute; top: -70px; width: 48px; height: 48px; animation: drop .9s cubic-bezier(.3,1.5,.6,1) forwards; pointer-events: none; }
@keyframes drop { 0% { transform: translateY(0) rotate(-20deg); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(240px) rotate(0); opacity: 0; } }
.mini-chubby { width: 96px; position: absolute; right: 10px; bottom: 6px; transition: transform .25s; }
.mini-chubby.bounce { animation: bounce .6s cubic-bezier(.3,1.6,.5,1); }
@keyframes bounce { 30% { transform: translateY(-18px) scale(1.06, .96); } 60% { transform: translateY(0) scale(.97, 1.03); } }
.btn { font: 800 16px var(--body); border: 0; border-radius: 999px; padding: 12px 20px; cursor: pointer; background: var(--primary); color: var(--on-primary); box-shadow: 0 3px 0 color-mix(in srgb, var(--on-primary) 25%, transparent); transition: transform .12s ease, box-shadow .12s ease; }
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(2px); box-shadow: 0 1px 0 color-mix(in srgb, var(--on-primary) 25%, transparent); }
.btn.secondary { background: var(--secondary); color: var(--on-secondary); }
.btn.ghost { background: transparent; color: var(--accent); box-shadow: none; border: 2px solid var(--line); }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.spec { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
.spec td, .spec th { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.spec th { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
canvas.confetti { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20; }

/* Components */
.task { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 12px; align-items: center; }
.check { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--primary); background: var(--surface); display: grid; place-items: center; cursor: pointer; transition: background .2s, transform .12s; }
.check:active { transform: scale(.9); }
.check.done { background: var(--primary); }
.check svg { opacity: 0; transition: opacity .2s; }
.check.done svg { opacity: 1; }
.task.done .title { text-decoration: line-through; color: var(--ink-soft); }
.title { font-weight: 800; }
.meta { font-size: 13px; color: var(--ink-soft); display: flex; gap: 10px; flex-wrap: wrap; }
.reward { display: inline-flex; align-items: center; gap: 4px; font-family: var(--display); font-weight: 800; font-size: 18px; background: var(--surface-alt); border-radius: 999px; padding: 2px 10px 2px 4px; }
.reward svg { width: 24px; height: 24px; }
.pill { display: inline-flex; gap: 4px; align-items: center; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 800; background: var(--surface-alt); color: var(--ink); }
.pill.warn { color: var(--warning); }
.goal-ring { --p: 64; width: 84px; height: 84px; border-radius: 50%; background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--surface-alt) 0); display: grid; place-items: center; }
.goal-ring > div { width: 64px; height: 64px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; font-family: var(--display); font-weight: 800; }
.notif { display: grid; grid-template-columns: 40px minmax(0,1fr); gap: 10px; background: var(--surface-alt); border-radius: 20px; padding: 12px; }
.notif .ic { width: 40px; height: 40px; border-radius: 10px; background: var(--primary); display: grid; place-items: center; overflow: hidden; }
.notif .ic svg { width: 44px; }
.widget { aspect-ratio: 1; max-width: 170px; border-radius: 26px; background: var(--primary); color: var(--on-primary); padding: 14px; display: grid; align-content: space-between; position: relative; overflow: hidden; }
.widget .n { font-family: var(--display); font-size: 40px; font-weight: 800; line-height: 1; }
.widget svg.cb { position: absolute; right: -14px; bottom: -18px; width: 96px; }
.comp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 14px; }
.list { display: grid; gap: 8px; margin: 0; padding-left: 20px; }

@media (max-width: 720px) {
  .hero, .demo { grid-template-columns: minmax(0, 1fr); }
  .chubby-stage { max-width: 240px; }
  .type-row { grid-template-columns: minmax(0, 1fr); gap: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .breathe, .mini-chubby.bounce { animation: none; }
  .drop { animation: fade .15s forwards; top: 40%; }
  @keyframes fade { to { opacity: 0; } }
}
</style>

<div class="wrap">
  <section class="hero">
    <div>
      <div class="eyebrow">Design system · v1 draft for review</div>
      <h1>Pobe Coins <span>Style Book</span></h1>
      <p class="lede soft">Cozy, pastel and quick to use. These are the colors, type, coins and motion the app is built from, with Chubbybara (placeholder art) running the shop. Pick a theme to restyle the whole page.</p>
      <div class="picker" id="picker" role="group" aria-label="Theme"></div>
    </div>
    <div class="chubby-stage">
      <div class="bubble" id="bubble">Hi! I'm Chubbybara. Welcome to the POBE Shop!</div>
      <div class="breathe" id="hero-chubby"></div>
    </div>
  </section>

  <section class="chapter" id="palettes">
    <header><div class="eyebrow">1 · Color</div><h2>Five pastel themes, each with light and dark</h2>
    <p class="soft">Pastels fill surfaces and buttons; text always uses the theme's deep ink, so every pairing passes WCAG AA (4.5:1). The numbers below are the measured contrast ratios in the mode you're viewing.</p></header>
    <div class="grid cols-5" id="palette-grid"></div>
  </section>

  <section class="chapter">
    <header><div class="eyebrow">2 · Type</div><h2>Plus Jakarta Sans, one family at four weights</h2>
    <p class="soft">A crisp, modern geometric sans: ExtraBold with tight tracking for headings and numbers, Medium for reading. The warmth comes from the colors and Chubbybara, not the letterforms. Coin counts use tabular figures so totals don't jiggle while they count up.</p></header>
    <div>
      <div class="type-row"><code>hero · 44</code><div style="font-family:var(--display);font-size:44px;font-weight:800;line-height:1.05;letter-spacing:-0.035em">1,284 coins</div></div>
      <div class="type-row"><code>xxl · 32</code><div style="font-family:var(--display);font-size:32px;font-weight:700">Saving for a picnic basket</div></div>
      <div class="type-row"><code>xl · 24</code><div style="font-family:var(--display);font-size:24px;font-weight:700">Today's chores</div></div>
      <div class="type-row"><code>lg · 20</code><div style="font-weight:800;font-size:20px">Take out the recycling</div></div>
      <div class="type-row"><code>md · 16</code><div>Chubbybara says: every little chore adds up. You're 12 coins from your goal.</div></div>
      <div class="type-row"><code>sm · 14</code><div class="soft" style="font-size:14px">Every Mon, Wed · streak 6 · needs approval</div></div>
      <div class="type-row"><code>xs · 12</code><div class="eyebrow">Pending approval</div></div>
    </div>
  </section>

  <section class="chapter">
    <header><div class="eyebrow">3 · Coins</div><h2>Six coins, same colors in every theme</h2>
    <p class="soft">Each denomination has its own color and name, so a purse reads at a glance. Custom coin types an admin adds get a neutral cocoa coin.</p></header>
    <div class="coins" id="coin-grid"></div>
  </section>

  <section class="chapter">
    <header><div class="eyebrow">4 · Chubbybara</div><h2>Placeholder poses and shop cosmetics</h2>
    <p class="soft">Vector stand-ins until the commissioned art arrives. The app loads him from one registry by pose name, so the real art drops in without layout changes. The apron and accessories take the theme color.</p></header>
    <h3>Poses</h3>
    <div class="poses" id="pose-grid"></div>
    <h3>Accessories (POBE Shop cosmetics)</h3>
    <div class="poses" id="acc-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))"></div>
  </section>

  <section class="chapter">
    <header><div class="eyebrow">5 · Motion</div><h2>Celebrate in proportion</h2>
    <p class="soft">Try it: finish a chore and watch the coins land in the purse. Taps get small feedback and milestones get Chubbybara. With Reduce Motion on, movement becomes a short fade.</p></header>
    <div class="demo">
      <div class="card purse" id="purse">
        <div>
          <div class="eyebrow">Your purse</div>
          <div class="total" id="total" aria-live="polite">85</div>
          <div class="soft" style="font-size:14px">coins on hand</div>
        </div>
        <div class="stack" id="stack"></div>
        <div class="mini-chubby" id="mini-chubby"></div>
      </div>
      <div class="card" style="display:grid;gap:14px;align-content:start">
        <div class="row">
          <button class="btn" id="earn">Finish "Dishes" · +30</button>
          <button class="btn secondary" id="spend">Spend 20</button>
          <button class="btn ghost" id="party">Goal reached!</button>
        </div>
        <p class="soft" id="motion-log" style="font-size:14px">Spending makes change like a cash register: paying 20 with a 25 gives back a 5.</p>
        <table class="spec">
          <thead><tr><th>Moment</th><th>Motion</th><th>Timing</th></tr></thead>
          <tbody>
            <tr><td>Tap / press</td><td>Scale to 0.96, haptic "light"</td><td>${MOTION.tap}ms</td></tr>
            <tr><td>Check a chore</td><td>Fill + tick, coin pop, counter ticks up</td><td>${MOTION.micro}ms + spring</td></tr>
            <tr><td>Coins land</td><td>Bouncy spring, ${MOTION.stagger}ms stagger per coin</td><td>damping ${MOTION.bouncy.damping}, stiffness ${MOTION.bouncy.stiffness}</td></tr>
            <tr><td>Sheets / screens</td><td>Spring slide</td><td>~${MOTION.sheet}ms · damping ${MOTION.spring.damping}</td></tr>
            <tr><td>Milestone / goal</td><td>Chubbybara cheer + confetti + chime</td><td>${MOTION.celebrate}ms</td></tr>
            <tr><td>Chubbybara idle</td><td>Breathing scale, blink every 4–7s</td><td>3.2s loop</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="chapter">
    <header><div class="eyebrow">6 · Components</div><h2>How the pieces look in the app</h2>
    <p class="soft">Sample data. Tap the checkbox on a chore.</p></header>
    <div class="comp-grid">
      <div class="card" style="display:grid;gap:12px">
        <div class="eyebrow">Tasks</div>
        <div class="task" data-task>
          <button class="check" aria-label="Mark Dishes done"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div style="min-width:0"><div class="title">Dishes after dinner</div><div class="meta"><span>Every day</span><span>🔥 6-day streak</span></div></div>
          <span class="reward" data-coin="25"></span>
        </div>
        <div class="task" data-task>
          <button class="check" aria-label="Mark Vacuum done"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div style="min-width:0"><div class="title">Vacuum the living room</div><div class="meta"><span class="pill">⏳ Needs approval</span><span>Your turn this week</span></div></div>
          <span class="reward" data-coin="50"></span>
        </div>
        <div class="task" data-task>
          <button class="check" aria-label="Mark Water plants done"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div style="min-width:0"><div class="title">Water the plants</div><div class="meta"><span class="pill warn">⚠ Overdue since Tue</span></div></div>
          <span class="reward" data-coin="10"></span>
        </div>
      </div>

      <div class="card" style="display:grid;gap:12px;align-content:start">
        <div class="eyebrow">Wishlist goal</div>
        <div class="row" style="flex-wrap:nowrap">
          <div class="goal-ring" style="--p:64"><div>64%</div></div>
          <div style="min-width:0"><div class="title">Picnic basket for two</div><div class="meta"><span>Shared goal · 320 / 500</span></div><div class="meta"><span>You 180 · Partner 140</span></div></div>
        </div>
        <div class="eyebrow" style="margin-top:6px">Paid for by</div>
        <div class="meta" style="font-size:14px"><span>Dishes ×3</span><span>Deep clean ×1</span><span>Streak bonus</span></div>
      </div>

      <div class="card" style="display:grid;gap:12px;align-content:start">
        <div class="eyebrow">Notification</div>
        <div class="notif">
          <div class="ic" id="notif-icon"></div>
          <div style="min-width:0"><div class="title" style="font-size:14px">Pobe Coins · now</div><div style="font-size:14px">Your partner finished "Vacuum the living room" (+50). Approve?</div>
          <div class="row" style="margin-top:8px"><button class="btn" style="padding:6px 14px;font-size:13px">Approve</button><button class="btn ghost" style="padding:6px 14px;font-size:13px">Not yet</button></div></div>
        </div>
        <div class="eyebrow" style="margin-top:6px">Home-screen widget</div>
        <div class="widget"><div style="font-weight:800;font-size:13px">My purse</div><div><div class="n">85</div><div style="font-size:12px;font-weight:700">2 chores today</div></div><span id="widget-chubby"></span></div>
      </div>
    </div>
  </section>

  <section class="chapter">
    <header><div class="eyebrow">7 · Research</div><h2>What shaped these choices</h2></header>
    <ul class="list">
      <li><b>Finch</b>: meet the mascot first, keep the tone kind, use soft pastels to lower stress. Chubbybara runs onboarding, and missed streaks read as "fresh start".</li>
      <li><b>Duolingo</b>: celebrate right after the action, and scale the celebration to the effort. That gives us three tiers: tap, milestone, big moment.</li>
      <li><b>Monzo pots</b>: goals as jars that fill up. Used for wishlist and shared goals.</li>
      <li><b>Habitica</b>: rewards the group defines itself. Used for the POBE Shop rewards catalog.</li>
      <li><b>Accessibility</b>: pastel-on-pastel text is the classic failure, so text only uses deep inks. Automated tests check contrast for every theme.</li>
    </ul>
    <p class="soft" style="font-size:14px">Full notes and sources: <code>docs/design/research.md</code> in the repo.</p>
  </section>

  <section class="chapter">
    <header><div class="eyebrow">For you to decide</div><h2>Open questions</h2></header>
    <ul class="list">
      <li>Is Chubbybara's yuzu hat right, or does your plushie have its own signature item?</li>
      <li>Coin names (Peach penny, Mint nickel, Sky dime, Lilac quarter, Butter half, Rose crown): keep them, rename them, or show numbers only?</li>
      <li>Default theme is Strawberry milk (pink). Should each person get their own theme, or one per household?</li>
    </ul>
  </section>
</div>

<script>
const DATA = ${JSON.stringify(data)};
const root = document.documentElement;
let current = 'pink';
try { const saved = localStorage.getItem('pobe-theme'); if (saved && DATA.themes[saved]) current = saved; } catch (e) {}
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDark = () => root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
const pal = () => DATA.themes[current][isDark() ? 'dark' : 'light'];
const chubby = (svg) => svg.split('__ACCENT__').join(pal().primary);

function applyTheme(name) {
  current = name;
  try { localStorage.setItem('pobe-theme', name); } catch (e) {}
  const t = DATA.themes[name];
  for (const [k, v] of Object.entries(t.light)) root.style.setProperty('--l-' + kebab(k), v);
  for (const [k, v] of Object.entries(t.dark)) root.style.setProperty('--d-' + kebab(k), v);
  document.querySelectorAll('.swatch-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === name)));
  document.querySelectorAll('.pal').forEach((p) => p.classList.toggle('active', p.dataset.theme === name));
  renderArt();
}

function renderPicker() {
  document.getElementById('picker').innerHTML = DATA.order.map((n) => {
    const t = DATA.themes[n];
    return '<button class="swatch-btn" data-theme="' + n + '" aria-pressed="false"><i style="background:' + t.light.primary + '"></i>' + t.label + '</button>';
  }).join('');
  document.querySelectorAll('.swatch-btn').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
}

function renderPalettes() {
  const mode = isDark() ? 'dark' : 'light';
  document.getElementById('palette-grid').innerHTML = DATA.order.map((n) => {
    const t = DATA.themes[n]; const p = t[mode]; const c = DATA.contrast[n + '-' + mode];
    return '<button class="pal" data-theme="' + n + '" style="text-align:left;cursor:pointer;padding:0;font:inherit;color:inherit">' +
      '<div class="top" style="background:' + p.bg + ';color:' + p.ink + '"><b style="font-family:var(--display);font-size:18px">' + t.label + '</b><span style="color:' + p.inkSoft + ';font-size:13px">' + n + ' · ' + mode + '</span></div>' +
      '<div class="chips">' + [p.primary, p.surfaceAlt, p.secondary, p.accent].map((x) => '<span style="background:' + x + '"></span>').join('') + '</div>' +
      '<div class="meta"><span>Text on background ' + c.ink.toFixed(1) + ':1</span><span>Soft text on panel ' + c.soft.toFixed(1) + ':1</span><span>Button label ' + c.btn.toFixed(1) + ':1</span></div></button>';
  }).join('');
  document.querySelectorAll('.pal').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
  document.querySelectorAll('.pal').forEach((p) => p.classList.toggle('active', p.dataset.theme === current));
}

function renderStatic() {
  document.getElementById('coin-grid').innerHTML = [100, 50, 25, 10, 5, 1].map((d) =>
    '<div class="card coin-card">' + DATA.coins[d] + '<b>' + DATA.coinNames[d] + '</b><span class="soft" style="font-size:13px">worth ' + d + '</span></div>').join('');
  document.querySelectorAll('[data-coin]').forEach((el) => { const d = el.dataset.coin; el.innerHTML = DATA.coins[d] + '+' + d; });
}

function renderArt() {
  document.getElementById('hero-chubby').innerHTML = chubby(DATA.poses.wave);
  document.getElementById('pose-grid').innerHTML = Object.entries(DATA.poses).map(([k, v]) => '<div class="card pose">' + chubby(v) + '<span>' + k + '</span></div>').join('');
  document.getElementById('acc-grid').innerHTML = Object.entries(DATA.accessories).map(([k, v]) => '<div class="card pose">' + chubby(v) + '<span>' + k + '</span></div>').join('');
  document.getElementById('mini-chubby').innerHTML = chubby(DATA.poses.happy);
  document.getElementById('notif-icon').innerHTML = chubby(DATA.poses.idle);
  document.getElementById('widget-chubby').innerHTML = chubby(DATA.poses.happy).replace('<svg ', '<svg class="cb" ');
  renderPalettes();
}

// ---- purse demo (same algorithm as packages/core coins.ts, simplified: greedy change) ----
const TYPES = [100, 50, 25, 10, 5, 1];
let purse = { 25: 3, 10: 1 };
const bal = () => Object.entries(purse).reduce((s, [d, n]) => s + d * n, 0);
const payout = (amt) => { const o = {}; for (const c of TYPES) { const n = Math.floor(amt / c); if (n) { o[c] = n; amt -= n * c; } } return o; };
function renderPurse() {
  document.getElementById('stack').innerHTML = TYPES.filter((d) => purse[d]).map((d) =>
    '<div class="c">' + DATA.coins[d] + '×' + purse[d] + '</div>').join('');
}
function countTo(target) {
  const el = document.getElementById('total'); const start = Number(el.textContent);
  if (reduce) { el.textContent = target; return; }
  const t0 = performance.now(); const dur = 600;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function bounce() { const m = document.getElementById('mini-chubby'); m.classList.remove('bounce'); void m.offsetWidth; m.classList.add('bounce'); }
document.getElementById('earn').addEventListener('click', () => {
  const coins = payout(30); const box = document.getElementById('purse'); let i = 0;
  for (const [d, n] of Object.entries(coins)) for (let k = 0; k < n; k++) {
    const el = document.createElement('div'); el.className = 'drop'; el.innerHTML = DATA.coins[d];
    el.style.left = (30 + Math.random() * 45) + '%'; el.style.animationDelay = (i++ * ${MOTION.stagger}) + 'ms';
    box.appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  setTimeout(() => { for (const [d, n] of Object.entries(coins)) purse[d] = (purse[d] || 0) + n; renderPurse(); countTo(bal()); bounce(); }, reduce ? 0 : 520);
  document.getElementById('bubble').textContent = 'Dishes done! That\\'s 30 coins. Cozy work!';
  document.getElementById('motion-log').textContent = 'Earned 30 → paid out as ' + Object.entries(coins).map(([d, n]) => n + '×' + d).join(' + ') + '.';
});
document.getElementById('spend').addEventListener('click', () => {
  if (bal() < 20) { document.getElementById('motion-log').textContent = 'Not enough coins. The real app offers an IOU up to your household limit.'; return; }
  // pay: exact if possible, else smallest overpay + change (brute force is fine for a demo purse)
  const denoms = TYPES.filter((d) => purse[d]); let best = null;
  const walk = (i, sum, cnt, pick) => { if (i === denoms.length) { if (sum >= 20 && (!best || sum < best.sum || (sum === best.sum && cnt < best.cnt))) best = { sum, cnt, pick: { ...pick } }; return; }
    const d = denoms[i]; for (let n = 0; n <= purse[d]; n++) { pick[d] = n; walk(i + 1, sum + d * n, cnt + n, pick); } };
  walk(0, 0, 0, {});
  for (const [d, n] of Object.entries(best.pick)) purse[d] -= n;
  const change = payout(best.sum - 20); for (const [d, n] of Object.entries(change)) purse[d] = (purse[d] || 0) + n;
  renderPurse(); countTo(bal());
  const paid = Object.entries(best.pick).filter(([, n]) => n).map(([d, n]) => n + '×' + d).join(' + ');
  const ch = Object.entries(change).map(([d, n]) => n + '×' + d).join(' + ');
  document.getElementById('motion-log').textContent = 'Spent 20: handed over ' + paid + (ch ? ', got back ' + ch + ' in change.' : ', exact, no change.');
  document.getElementById('bubble').textContent = 'Enjoy your treat! You earned it.';
});
document.getElementById('party').addEventListener('click', () => {
  bounce(); document.getElementById('bubble').textContent = 'You did it! Picnic basket unlocked!';
  document.getElementById('hero-chubby').innerHTML = chubby(DATA.poses.cheer);
  setTimeout(() => { document.getElementById('hero-chubby').innerHTML = chubby(DATA.poses.wave); }, 2400);
  if (reduce) return;
  const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = [pal().primary, pal().secondary, '#FCE6A6', '#C4EBD2', '#DCCDF8'];
  const bits = Array.from({ length: 110 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.55, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6 }));
  const t0 = performance.now();
  const tick = (t) => { const k = (t - t0) / ${MOTION.celebrate}; ctx.clearRect(0, 0, cv.width, cv.height);
    for (const b of bits) { b.vy += .5; b.x += b.vx; b.y += b.vy; b.a += .2; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); ctx.restore(); }
    if (k < 1) requestAnimationFrame(tick); else cv.remove(); };
  requestAnimationFrame(tick);
});
document.querySelectorAll('[data-task] .check').forEach((b) => b.addEventListener('click', () => {
  b.classList.toggle('done'); b.closest('[data-task]').classList.toggle('done');
}));

renderPicker(); renderStatic(); renderPurse(); applyTheme(current);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderArt);
new MutationObserver(renderArt).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
</script>
`;

const out = join(import.meta.dirname, 'stylebook.html');
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
