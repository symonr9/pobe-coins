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

const FUR = '#D9A879';
const FUR_DARK = '#B8844F';
const FUR_LIGHT = '#F3D9B8';
const SNOUT = '#C99466';
const INK = '#2E211C';
const BLUSH = '#F6A2B9';
const YUZU = '#F9D25C';
const LEAF = '#7CC495';

/** Big shiny eyes: the single biggest factor in "cute". */
function eye(cx: number, cy: number) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="9.5" ry="10.5" fill="${INK}"/>
    <circle cx="${cx - 3}" cy="${cy - 4}" r="3.6" fill="#fff"/>
    <circle cx="${cx + 3.4}" cy="${cy + 3.6}" r="1.6" fill="#fff" opacity="0.9"/>`;
}

function eyes(pose: ChubbyPose): string {
  switch (pose) {
    case 'happy':
    case 'cheer':
      return `<path d="M76 118 q10 -12 20 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M144 118 q10 -12 20 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    case 'sleepy':
      return `<path d="M76 116 q10 9 20 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M144 116 q10 9 20 0" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    case 'thinking':
      return eye(88, 112) + eye(156, 112);
    default:
      return eye(86, 116) + eye(154, 116);
  }
}

function mouth(pose: ChubbyPose): string {
  if (pose === 'sleepy') return `<ellipse cx="120" cy="156" rx="4" ry="3.2" fill="${INK}" opacity="0.75"/>`;
  if (pose === 'thinking') return `<path d="M114 157 q6 -3 12 0" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`;
  if (pose === 'cheer')
    return `<path d="M110 152 q10 14 20 0 z" fill="${INK}"/><path d="M114 157 q6 5 12 0" fill="#F58FA8"/>`;
  return `<path d="M111 153 q4.5 5 9 0 q4.5 5 9 0" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
}

function arms(pose: ChubbyPose): string {
  const arm = (x: number, y: number, r: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="12" ry="17" fill="${FUR_DARK}" transform="rotate(${r} ${x} ${y})"/>
     <ellipse cx="${x}" cy="${y - 4}" rx="7" ry="9" fill="${FUR}" opacity="0.5" transform="rotate(${r} ${x} ${y})"/>`;
  if (pose === 'cheer') return arm(40, 112, -38) + arm(200, 112, 38);
  if (pose === 'wave') return arm(214, 96, 36) + arm(46, 176, 28);
  return arm(46, 176, 28) + arm(194, 176, -28);
}

function extras(pose: ChubbyPose, accent: string): string {
  switch (pose) {
    case 'cheer':
      return `<g fill="${YUZU}"><path d="M30 58 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z"/><path d="M206 50 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/><circle cx="22" cy="104" r="3"/><circle cx="220" cy="92" r="2.5"/></g>`;
    case 'sleepy':
      return `<g fill="${INK}" opacity="0.5" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-weight="800"><text x="182" y="62" font-size="22">z</text><text x="200" y="42" font-size="15">z</text></g>`;
    case 'thinking':
      return `<g><circle cx="202" cy="46" r="20" fill="#fff" stroke="${FUR_DARK}" stroke-width="2.5"/><circle cx="184" cy="74" r="5" fill="#fff" stroke="${FUR_DARK}" stroke-width="2"/><text x="202" y="54" text-anchor="middle" font-size="22" font-weight="800" fill="${INK}" font-family="Plus Jakarta Sans, system-ui, sans-serif">?</text></g>`;
    case 'shopkeeper':
      return `<path d="M72 186 q48 -18 96 0 v26 q-48 14 -96 0z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2"/>
        <rect x="106" y="193" width="28" height="12" rx="5" fill="#fff" opacity="0.85"/>
        <path d="M120 178 l-15 -9 v18z M120 178 l15 -9 v18z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="120" cy="178" r="4.5" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2"/>`;
    default:
      return '';
  }
}

function accessory(kind: ChubbyAccessory, accent: string): string {
  switch (kind) {
    case 'beanie':
      return `<path d="M60 74 q60 -64 120 0 z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2"/><rect x="56" y="68" width="128" height="14" rx="7" fill="#fff" stroke="${FUR_DARK}" stroke-width="2"/><circle cx="120" cy="20" r="10" fill="#fff" stroke="${FUR_DARK}" stroke-width="2"/>`;
    case 'bow':
      return `<g transform="translate(170 62)"><path d="M0 0 l-19 -13 q-4 13 0 26z M0 0 l19 -13 q4 13 0 26z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2" stroke-linejoin="round"/><circle r="5.5" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2"/></g>`;
    case 'scarf':
      return `<path d="M50 160 q70 32 140 0 v17 q-70 32 -140 0z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2"/><rect x="150" y="170" width="20" height="42" rx="8" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2"/>`;
    case 'crown':
      return `<path d="M90 54 l7 -28 15 17 8 -23 8 23 15 -17 7 28z" fill="${YUZU}" stroke="#C99A2E" stroke-width="2" stroke-linejoin="round"/><circle cx="120" cy="44" r="3.5" fill="#F58FA8"/>`;
    case 'flower':
      return `<g transform="translate(66 66)">${[0, 72, 144, 216, 288]
        .map((a) => `<ellipse rx="6.5" ry="10.5" cy="-9.5" fill="#fff" stroke="${accent}" stroke-width="2" transform="rotate(${a})"/>`)
        .join('')}<circle r="5.5" fill="${YUZU}"/></g>`;
    case 'party-hat':
      return `<path d="M101 60 l19 -52 19 52z" fill="${accent}" stroke="${FUR_DARK}" stroke-width="2" stroke-linejoin="round"/><path d="M108 42 h24 M114 26 h12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/><circle cx="120" cy="8" r="6" fill="${YUZU}"/>`;
    case 'glasses':
      return `<g fill="none" stroke="${INK}" stroke-width="3.2"><circle cx="86" cy="116" r="16"/><circle cx="154" cy="116" r="16"/><path d="M102 114 q18 -8 36 0"/></g>`;
    default:
      return '';
  }
}

/** Chubbybara: a round, soft capybara with sparkly eyes, rosy cheeks and his yuzu. */
export function chubbybaraSvg(options: ChubbyOptions = {}): string {
  const pose = options.pose ?? 'idle';
  const acc = options.accessory ?? 'none';
  const accent = options.accent ?? '#F9B9CD';
  const id = options.id ?? pose;
  const hat = acc === 'beanie' || acc === 'crown' || acc === 'party-hat';
  const closed = options.eyesClosed && pose !== 'happy' && pose !== 'cheer' && pose !== 'sleepy';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Chubbybara the capybara">
  <defs>
    <radialGradient id="fur-${id}" cx="42%" cy="30%" r="78%">
      <stop offset="0" stop-color="${FUR_LIGHT}"/>
      <stop offset="0.5" stop-color="${FUR}"/>
      <stop offset="1" stop-color="${FUR_DARK}"/>
    </radialGradient>
  </defs>
  <ellipse cx="120" cy="226" rx="72" ry="8" fill="${INK}" opacity="0.1"/>
  ${arms(pose)}
  <g>
    <ellipse cx="88" cy="214" rx="21" ry="11" fill="${FUR_DARK}"/>
    <ellipse cx="152" cy="214" rx="21" ry="11" fill="${FUR_DARK}"/>
    <g fill="${BLUSH}" opacity="0.8"><circle cx="81" cy="216" r="2.6"/><circle cx="88" cy="218.5" r="2.6"/><circle cx="95" cy="216" r="2.6"/><circle cx="145" cy="216" r="2.6"/><circle cx="152" cy="218.5" r="2.6"/><circle cx="159" cy="216" r="2.6"/></g>
  </g>
  <ellipse cx="68" cy="68" rx="12" ry="9" fill="${FUR_DARK}" transform="rotate(-28 68 68)"/>
  <ellipse cx="68" cy="69" rx="6" ry="4" fill="${BLUSH}" transform="rotate(-28 68 69)"/>
  <ellipse cx="172" cy="68" rx="12" ry="9" fill="${FUR_DARK}" transform="rotate(28 172 68)"/>
  <ellipse cx="172" cy="69" rx="6" ry="4" fill="${BLUSH}" transform="rotate(28 172 69)"/>
  <path d="M120 58 C 182 58 212 100 212 146 C 212 196 172 222 120 222 C 68 222 28 196 28 146 C 28 100 58 58 120 58 Z" fill="url(#fur-${id})"/>
  <ellipse cx="92" cy="86" rx="30" ry="14" fill="#fff" opacity="0.22" transform="rotate(-18 92 86)"/>
  <ellipse cx="120" cy="198" rx="50" ry="20" fill="${FUR_LIGHT}" opacity="0.7"/>
  <ellipse cx="120" cy="146" rx="40" ry="26" fill="${SNOUT}" opacity="0.55"/>
  <ellipse cx="108" cy="136" rx="3.4" ry="4.4" fill="${INK}" opacity="0.85" transform="rotate(18 108 136)"/>
  <ellipse cx="132" cy="136" rx="3.4" ry="4.4" fill="${INK}" opacity="0.85" transform="rotate(-18 132 136)"/>
  ${closed ? eyes('sleepy') : eyes(pose)}
  <ellipse cx="66" cy="142" rx="14" ry="9" fill="${BLUSH}" opacity="0.7"/>
  <ellipse cx="174" cy="142" rx="14" ry="9" fill="${BLUSH}" opacity="0.7"/>
  ${mouth(pose)}
  ${extras(pose, accent)}
  ${
    hat
      ? ''
      : `<path d="M112 60 q4 -10 8 -2 q4 -10 8 2" stroke="${FUR_DARK}" stroke-width="3" stroke-linecap="round" fill="none"/>
  <circle cx="120" cy="46" r="16" fill="${YUZU}" stroke="#DBA83A" stroke-width="2"/>
  <circle cx="114" cy="40" r="4" fill="#fff" opacity="0.6"/>
  <path d="M121 31 q11 -13 22 -6 q-9 11 -22 6z" fill="${LEAF}"/>`
  }
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
  <text x="32" y="${31 + fontSize * 0.36}" text-anchor="middle" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-weight="800" font-size="${fontSize}" fill="${s.ink}">${label}</text>
</svg>`;
}
