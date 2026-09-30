import { createHash, randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastTime = 0;
let lastRandom: number[] = [];

/** ULID: 26 chars, lexicographically sortable by creation time (monotonic within a ms). */
export function ulid(now = Date.now()): string {
  let random: number[];
  if (now === lastTime) {
    random = [...lastRandom];
    for (let i = random.length - 1; i >= 0; i--) {
      if (random[i]! < 31) {
        random[i]!++;
        break;
      }
      random[i] = 0;
    }
  } else {
    const bytes = randomBytes(16);
    random = Array.from({ length: 16 }, (_, i) => bytes[i]! % 32);
  }
  lastTime = now;
  lastRandom = random;
  return encodeTime(now) + random.map((r) => ALPHABET[r]).join('');
}

/** The 10-char time prefix of a ULID. */
export function encodeTime(ms: number): string {
  let time = '';
  let t = ms;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  return time;
}

/** Creation time of a ULID. */
export function ulidTime(id: string): number {
  let t = 0;
  for (const ch of id.slice(0, 10)) t = t * 32 + ALPHABET.indexOf(ch);
  return t;
}

/** Random URL-safe secret (for device links, calendar feeds). */
export function secretToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
