/**
 * Link previews (Open Graph) for purchase and wishlist links, guarded against SSRF:
 * http(s) only, standard ports, every hop's DNS answers must be public addresses,
 * 3s timeout, 1 MB cap, at most 3 redirects, results cached for 7 days.
 */
import { isIP } from 'node:net';
import type { LinkPreview } from '@pobe/core';
import type { Deps } from '../context';
import { keys } from '../db/keys';
import type { Item } from '../db/types';
import { ApiError } from '../lib/errors';
import { sha256 } from '../lib/ids';

const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 3000;
const MAX_REDIRECTS = 3;
const CACHE_DAYS = 7;

function ipv4ToInt(ip: string) {
  return ip.split('.').reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const n = ipv4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    if (lower === '::' || lower === '::1') return true;
    const first = parseInt(lower.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8:')) return true;
    return false;
  }
  return true;
}

async function assertPublicUrl(deps: Deps, raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError('BAD_REQUEST', "That link doesn't look right.");
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new ApiError('BAD_REQUEST', 'Only http and https links can be previewed.');
  if (url.username || url.password) throw new ApiError('BAD_REQUEST', "Links with passwords can't be previewed.");
  if (url.port && url.port !== '80' && url.port !== '443') throw new ApiError('BAD_REQUEST', 'Only standard web ports can be previewed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : await deps.resolveHost(host).catch(() => []);
  if (addresses.length === 0) throw new ApiError('BAD_REQUEST', "Couldn't find that website.");
  if (addresses.some(isPrivateAddress)) throw new ApiError('BAD_REQUEST', "That address can't be previewed.");
  return url;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

export function parseOpenGraph(html: string, pageUrl: string): LinkPreview {
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return content ? decode(content) : undefined;
  };
  const title = meta('og:title') ?? meta('twitter:title') ?? html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1];
  let image = meta('og:image') ?? meta('twitter:image');
  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
      if (!/^https?:/i.test(image)) image = undefined;
    } catch {
      image = undefined;
    }
  }
  return {
    url: pageUrl,
    title: title ? decode(title).slice(0, 200) : undefined,
    description: meta('og:description')?.slice(0, 300) ?? meta('description')?.slice(0, 300),
    image,
    siteName: meta('og:site_name') ?? new URL(pageUrl).hostname.replace(/^www\./, ''),
  };
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const buf = new Uint8Array(Math.min(total, MAX_BYTES));
  let off = 0;
  for (const c of chunks) {
    const n = Math.min(c.byteLength, buf.length - off);
    buf.set(c.subarray(0, n), off);
    off += n;
    if (off >= buf.length) break;
  }
  return new TextDecoder().decode(buf);
}

export async function fetchPreview(deps: Deps, rawUrl: string): Promise<LinkPreview> {
  const cacheKey = keys.preview(sha256(rawUrl));
  const cached = await deps.db.get<Item & { preview: LinkPreview }>(cacheKey);
  if (cached) return cached.preview;
  let url = await assertPublicUrl(deps, rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await deps.fetch(url.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'PobeCoinsPreview/1.0 (+link previews)', accept: 'text/html' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = await assertPublicUrl(deps, new URL(res.headers.get('location')!, url).toString());
        continue;
      }
      if (!res.ok) throw new ApiError('BAD_REQUEST', "That page didn't load.");
      const type = res.headers.get('content-type') ?? '';
      const preview = type.includes('html')
        ? parseOpenGraph(await readCapped(res), url.toString())
        : { url: url.toString(), siteName: url.hostname };
      await deps.db.put({ ...cacheKey, preview, ttl: Math.floor(deps.now().getTime() / 1000) + CACHE_DAYS * 86400 });
      return preview;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('BAD_REQUEST', "That page took too long or couldn't be read.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiError('BAD_REQUEST', 'That link redirects too many times.');
}
