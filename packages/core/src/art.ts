/**
 * Placeholder vector art as SVG strings, shared by the app (react-native-svg `SvgXml`)
 * and the web design pages. The commissioned Chubbybara art will replace these via the
 * app's asset registry; keep the same poses and viewBox (240×240) so layouts don't shift.
 */
import { coinStyle } from './theme';

export const CHUBBY_POSES = ['idle', 'happy', 'cheer', 'shopkeeper', 'sleepy', 'thinking', 'wave'] as const;
export type ChubbyPose = (typeof CHUBBY_POSES)[number];

export const CHUBBY_ACCESSORIES = ['none', 'beanie', 'bow', 'scarf', 'crown', 'flower', 'party-hat', 'glasses'] as const;
export type ChubbyAccessory = (typeof CHUBBY_ACCESSORIES)[number];

export interface ChubbyOptions {
  pose?: ChubbyPose;
  accessory?: ChubbyAccessory;
  /** Theme color for the apron / accessories. */
  accent?: string;
  /** Unique suffix for gradient ids when several drawings share a page. */
  id?: string;
  /** Draw the eyes closed (used for blinking). */
  eyesClosed?: boolean;
}

const FUR = '#C99A6E';
const FUR_DARK = '#A97A52';
const FUR_LIGHT = '#E6C7A3';
const INK = '#3A2A22';
const BLUSH = '#F4A0B6';
const YUZU = '#F8D35E';
const LEAF = '#7DBE8C';

function eyes(pose: ChubbyPose): string {
  switch (pose) {
    case 'happy':
    case 'cheer':
      return `<path d="M72 100 q10 -12 20 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M148 100 q10 -12 20 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    case 'sleepy':
      return `<path d="M72 100 q10 8 20 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M148 100 q10 8 20 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    case 'thinking':
      return `<circle cx="84" cy="96" r="7" fill="${INK}"/><circle cx="86" cy="93" r="2.4" fill="#fff"/>
        <circle cx="160" cy="96" r="7" fill="${INK}"/><circle cx="162" cy="93" r="2.4" fill="#fff"/>`;
    default:
      return `<circle cx="82" cy="98" r="7" fill="${INK}"/><circle cx="84.5" cy="95.5" r="2.4" fill="#fff"/>
        <circle cx="158" cy="98" r="7" fill="${INK}"/><circle cx="160.5" cy="95.5" r="2.4" fill="#fff"/>`;
  }
}

function mouth(pose: ChubbyPose): string {
  if (pose === 'sleepy') return `<ellipse cx="120" cy="155" rx="4" ry="3" fill="${INK}" opacity="0.8"/>`;
  if (pose === 'thinking') return `<path d="M113 155 h14" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
  if (pose === 'happy' || pose === 'cheer' || pose === 'wave' || pose === 'shopkeeper')
    return `<path d="M108 152 q6 8 12 0 q6 8 12 0" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
  return `<path d="M111 153 q9 6 18 0" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
}

function arms(pose: ChubbyPose): string {
  const arm = (x: number, y: number, r: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="11" ry="20" fill="${FUR_DARK}" transform="rotate(${r} ${x} ${y})"/>`;
  if (pose === 'cheer') return arm(36, 108, -35) + arm(204, 108, 35);
  if (pose === 'wave') return arm(216, 88, 35) + arm(40, 168, 25);
  return arm(40, 168, 25) + arm(200, 168, -25);
}

function extras(pose: ChubbyPose, accent: string): string {
  switch (pose) {
    case 'cheer':
      return `<g fill="${YUZU}"><path d="M28 60 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z"/><path d="M206 52 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/></g>`;
    case 'sleepy':
      return `<g fill="${INK}" opacity="0.55" font-family="Baloo 2, Nunito, sans-serif" font-weight="700"><text x="182" y="60" font-size="22">z</text><text x="200" y="40" font-size="16">z</text></g>`;
    case 'thinking':
      return `<g><circle cx="200" cy="44" r="20" fill="#fff" stroke="${FUR_DARK}" stroke-width="3"/><circle cx="182" cy="72" r="5" fill="#fff" stroke="${FUR_DARK}" stroke-width="2.5"/><text x="200" y="53" text-anchor="middle" font-size="24" font-weight="800" fill="${INK}" font-family="Baloo 2, Nunito, sans-serif">?</text></g>`;
    case 'shopkeeper':
      return `<path d="M70 184 q50 -20 100 0 v28 q-50 16 -100 0z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2.5"/>
        <rect x="104" y="192" width="32" height="14" rx="6" fill="#fff" opacity="0.85"/>
        <path d="M120 176 l-16 -10 v20z M120 176 l16 -10 v20z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2"/>
        <circle cx="120" cy="176" r="5" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2"/>`;
    default:
      return '';
  }
}

function accessory(kind: ChubbyAccessory, accent: string): string {
  switch (kind) {
    case 'beanie':
      return `<path d="M62 70 q58 -62 116 0 z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2.5"/><rect x="58" y="64" width="124" height="14" rx="7" fill="#fff" stroke="${FUR_DARK}" stroke-width="2.5"/><circle cx="120" cy="18" r="10" fill="#fff" stroke="${FUR_DARK}" stroke-width="2.5"/>`;
    case 'bow':
      return `<g transform="translate(168 58)"><path d="M0 0 l-20 -14 v28z M0 0 l20 -14 v28z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2.5"/><circle r="6" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2.5"/></g>`;
    case 'scarf':
      return `<path d="M52 150 q68 34 136 0 v18 q-68 34 -136 0z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2.5"/><rect x="150" y="160" width="20" height="44" rx="8" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2.5"/>`;
    case 'crown':
      return `<path d="M88 50 l8 -28 16 18 8 -24 8 24 16 -18 8 28z" fill="${YUZU}" stroke="#B9892A" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'flower':
      return `<g transform="translate(64 62)">${[0, 72, 144, 216, 288]
        .map((a) => `<ellipse rx="7" ry="11" cy="-10" fill="#fff" stroke="${accent}" stroke-width="2" transform="rotate(${a})"/>`)
        .join('')}<circle r="6" fill="${YUZU}"/></g>`;
    case 'party-hat':
      return `<path d="M100 56 l20 -50 20 50z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="120" cy="6" r="6" fill="${YUZU}"/>`;
    case 'glasses':
      return `<g fill="none" stroke="${INK}" stroke-width="3.5"><circle cx="83" cy="97" r="15"/><circle cx="157" cy="97" r="15"/><path d="M98 96 h44"/></g>`;
    default:
      return '';
  }
}

/** Chubbybara the capybara: round, cozy, wearing his yuzu. */
export function chubbybaraSvg(options: ChubbyOptions = {}): string {
  const pose = options.pose ?? 'idle';
  const acc = options.accessory ?? 'none';
  const accent = options.accent ?? '#F9B9CD';
  const id = options.id ?? pose;
  const hat = acc === 'beanie' || acc === 'crown' || acc === 'party-hat';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Chubbybara the capybara">
  <defs>
    <radialGradient id="fur-${id}" cx="40%" cy="35%" r="75%">
      <stop offset="0" stop-color="${FUR_LIGHT}"/>
      <stop offset="0.55" stop-color="${FUR}"/>
      <stop offset="1" stop-color="${FUR_DARK}"/>
    </radialGradient>
  </defs>
  <ellipse cx="120" cy="226" rx="78" ry="9" fill="${INK}" opacity="0.12"/>
  ${arms(pose)}
  <ellipse cx="84" cy="214" rx="20" ry="10" fill="${FUR_DARK}"/>
  <ellipse cx="156" cy="214" rx="20" ry="10" fill="${FUR_DARK}"/>
  <ellipse cx="64" cy="66" rx="11" ry="8" fill="${FUR_DARK}" transform="rotate(-25 64 66)"/>
  <ellipse cx="64" cy="67" rx="5" ry="3.5" fill="${BLUSH}" opacity="0.7" transform="rotate(-25 64 67)"/>
  <ellipse cx="176" cy="66" rx="11" ry="8" fill="${FUR_DARK}" transform="rotate(25 176 66)"/>
  <ellipse cx="176" cy="67" rx="5" ry="3.5" fill="${BLUSH}" opacity="0.7" transform="rotate(25 176 67)"/>
  <ellipse cx="120" cy="136" rx="92" ry="84" fill="url(#fur-${id})"/>
  <ellipse cx="120" cy="190" rx="54" ry="26" fill="${FUR_LIGHT}" opacity="0.75"/>
  <rect x="72" y="112" width="96" height="60" rx="30" fill="${FUR_DARK}" opacity="0.5"/>
  <ellipse cx="106" cy="126" rx="3.2" ry="5" fill="${INK}" transform="rotate(20 106 126)"/>
  <ellipse cx="134" cy="126" rx="3.2" ry="5" fill="${INK}" transform="rotate(-20 134 126)"/>
  ${options.eyesClosed && pose !== 'happy' && pose !== 'cheer' && pose !== 'sleepy' ? eyes('sleepy') : eyes(pose)}
  <ellipse cx="66" cy="136" rx="14" ry="8" fill="${BLUSH}" opacity="0.65"/>
  <ellipse cx="174" cy="136" rx="14" ry="8" fill="${BLUSH}" opacity="0.65"/>
  ${mouth(pose)}
  ${extras(pose, accent)}
  ${hat ? '' : `<circle cx="120" cy="52" r="17" fill="${YUZU}" stroke="#D9A93A" stroke-width="2"/><path d="M120 36 q10 -14 22 -8 q-8 12 -22 8z" fill="${LEAF}"/>`}
  ${accessory(acc, accent)}
</svg>`;
}

/** A coin as seen from the front: rim, face, value. */
export function coinSvg(denom: number, size = 64): string {
  const s = coinStyle(denom);
  const label = String(denom);
  const fontSize = label.length >= 3 ? 20 : label.length === 2 ? 24 : 28;
  const crown =
    denom === 100
      ? `<path d="M22 20 l3 -8 5 5 2 -7 2 7 5 -5 3 8z" fill="${s.rim}" opacity="0.9"/>`
      : `<path d="M32 13 q4 -5 8 -2 q-3 5 -8 2z" fill="${s.rim}" opacity="0.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${s.name}, worth ${denom}">
  <circle cx="32" cy="34" r="29" fill="${s.rim}"/>
  <circle cx="32" cy="31" r="29" fill="${s.rim}"/>
  <circle cx="32" cy="31" r="24" fill="${s.face}"/>
  <circle cx="32" cy="31" r="20" fill="none" stroke="${s.rim}" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.7"/>
  ${crown}
  <text x="32" y="${31 + fontSize * 0.36}" text-anchor="middle" font-family="Baloo 2, Nunito, sans-serif" font-weight="800" font-size="${fontSize}" fill="${s.ink}">${label}</text>
</svg>`;
}
