/**
 * Single-table key layout. Household data lives in one partition (H#<id>) so a household
 * can be read, exported and deleted with partition queries. ULID ids make sort keys
 * time-ordered, so "newest first" is just a reverse query.
 */
export const HOUSEHOLDS_INDEX = 'HOUSEHOLDS';

const H = (hid: string) => `H#${hid}`;

export const keys = {
  household: (hid: string) => ({ pk: H(hid), sk: 'META' }),
  member: (hid: string, mid: string) => ({ pk: H(hid), sk: `M#${mid}` }),
  task: (hid: string, tid: string) => ({ pk: H(hid), sk: `T#${tid}` }),
  completion: (hid: string, cid: string) => ({ pk: H(hid), sk: `C#${cid}` }),
  purchase: (hid: string, pid: string) => ({ pk: H(hid), sk: `P#${pid}` }),
  ledger: (hid: string, lid: string) => ({ pk: H(hid), sk: `L#${lid}` }),
  goal: (hid: string, gid: string) => ({ pk: H(hid), sk: `W#${gid}` }),
  shopItem: (hid: string, id: string) => ({ pk: H(hid), sk: `SHOP#${id}` }),
  shopCooldown: (hid: string, itemId: string, mid: string) => ({ pk: H(hid), sk: `SHOPCD#${itemId}#${mid}` }),
  unlock: (hid: string, mid: string, cosmeticId: string) => ({ pk: H(hid), sk: `UNL#${mid}#${cosmeticId}` }),
  streak: (hid: string, tid: string, mid: string) => ({ pk: H(hid), sk: `S#${tid}#${mid}` }),
  period: (hid: string, tid: string, period: string) => ({ pk: H(hid), sk: `PER#${tid}#${period}` }),
  challenge: (hid: string, id: string) => ({ pk: H(hid), sk: `CH#${id}` }),
  reaction: (hid: string, itemId: string, mid: string) => ({ pk: H(hid), sk: `RX#${itemId}#${mid}` }),
  comment: (hid: string, itemId: string, cid: string) => ({ pk: H(hid), sk: `CM#${itemId}#${cid}` }),
  pushTarget: (hid: string, mid: string, hash: string) => ({ pk: H(hid), sk: `PT#${mid}#${hash}` }),
  audit: (hid: string, id: string) => ({ pk: H(hid), sk: `AUD#${id}` }),
  device: (hid: string, did: string) => ({ pk: H(hid), sk: `D#${did}` }),
  deviceLinkRef: (hid: string, id: string) => ({ pk: H(hid), sk: `DL#${id}` }),
  exportJob: (hid: string, id: string) => ({ pk: H(hid), sk: `EXP#${id}` }),
  calendarRef: (hid: string, mid: string) => ({ pk: H(hid), sk: `CALREF#${mid}` }),
  usage: (hid: string) => ({ pk: H(hid), sk: 'USAGE' }),
  // Global partitions
  deviceLink: (hash: string) => ({ pk: `LINK#${hash}`, sk: 'LINK' }),
  userProfile: (sub: string) => ({ pk: `U#${sub}`, sk: 'PROFILE' }),
  userHousehold: (sub: string, hid: string) => ({ pk: `U#${sub}`, sk: `H#${hid}` }),
  calendar: (hash: string) => ({ pk: `CAL#${hash}`, sk: 'CAL' }),
  rateLimit: (bucket: string, window: number) => ({ pk: `RL#${bucket}`, sk: `W#${window}` }),
  preview: (hash: string) => ({ pk: `PREV#${hash}`, sk: 'PREV' }),
};

export const partition = (hid: string) => H(hid);
export const memberLedgerIndex = (hid: string, mid: string) => `${H(hid)}#M#${mid}`;

export const PREFIX = {
  member: 'M#',
  task: 'T#',
  completion: 'C#',
  purchase: 'P#',
  ledger: 'L#',
  goal: 'W#',
  shopItem: 'SHOP#',
  unlock: 'UNL#',
  streak: 'S#',
  challenge: 'CH#',
  device: 'D#',
  deviceLinkRef: 'DL#',
  pushTarget: 'PT#',
  audit: 'AUD#',
  reaction: 'RX#',
  comment: 'CM#',
} as const;
