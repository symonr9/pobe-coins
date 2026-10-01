/**
 * Purse math. A purse is a count of physical-style coins per denomination,
 * e.g. { "25": 3, "5": 2 } = 85 coins of value.
 *
 * All functions are pure and never mutate their inputs.
 */

export type CoinTypes = readonly number[];
/** Denomination (as string key, JSON-friendly) → count. */
export type Purse = Record<string, number>;

export const DEFAULT_COIN_TYPES: CoinTypes = [1, 5, 10, 25, 50, 100];

export class CoinError extends Error {
  constructor(
    public readonly code: 'INSUFFICIENT' | 'INVALID_AMOUNT' | 'INVALID_COIN_TYPES' | 'UNREPRESENTABLE',
    message: string,
  ) {
    super(message);
    this.name = 'CoinError';
  }
}

export function validateCoinTypes(coinTypes: CoinTypes): void {
  if (coinTypes.length === 0 || coinTypes.length > 12) {
    throw new CoinError('INVALID_COIN_TYPES', 'Choose between 1 and 12 coin types.');
  }
  if (!coinTypes.includes(1)) {
    throw new CoinError('INVALID_COIN_TYPES', 'Coin types must include a 1-coin so any amount can be paid.');
  }
  const seen = new Set<number>();
  for (const c of coinTypes) {
    if (!Number.isInteger(c) || c < 1 || c > 100_000) {
      throw new CoinError('INVALID_COIN_TYPES', `Coin type ${c} must be a whole number from 1 to 100000.`);
    }
    if (seen.has(c)) throw new CoinError('INVALID_COIN_TYPES', `Coin type ${c} is listed twice.`);
    seen.add(c);
  }
}

function assertAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new CoinError('INVALID_AMOUNT', `Amount must be a whole number of coins (got ${amount}).`);
  }
}

const sortedDesc = (coinTypes: CoinTypes) => [...coinTypes].sort((a, b) => b - a);

/** Normalizes a purse: drops zero/negative entries, keeps integer counts. */
export function cleanPurse(purse: Purse): Purse {
  const out: Purse = {};
  for (const [k, v] of Object.entries(purse)) {
    if (v > 0) out[k] = Math.floor(v);
  }
  return out;
}

export function balance(purse: Purse): number {
  let total = 0;
  for (const [denom, count] of Object.entries(purse)) total += Number(denom) * count;
  return total;
}

export function coinCount(purse: Purse): number {
  return Object.values(purse).reduce((a, b) => a + b, 0);
}

export function addCoins(purse: Purse, coins: Purse): Purse {
  const out: Purse = { ...purse };
  for (const [k, v] of Object.entries(coins)) out[k] = (out[k] ?? 0) + v;
  return cleanPurse(out);
}

/** Subtracts coins; returns null if the purse doesn't hold them all. */
export function removeCoins(purse: Purse, coins: Purse): Purse | null {
  const out: Purse = { ...purse };
  for (const [k, v] of Object.entries(coins)) {
    const next = (out[k] ?? 0) - v;
    if (next < 0) return null;
    out[k] = next;
  }
  return cleanPurse(out);
}

export function containsCoins(purse: Purse, coins: Purse): boolean {
  return removeCoins(purse, coins) !== null;
}

/**
 * Breaks an amount into the fewest coins (unbounded supply), e.g. 30 → {25:1, 5:1}.
 * Uses DP so it stays optimal for non-canonical coin sets like [1, 3, 4].
 */
export function payout(amount: number, coinTypes: CoinTypes = DEFAULT_COIN_TYPES): Purse {
  assertAmount(amount);
  if (amount === 0) return {};
  const types = sortedDesc(coinTypes);
  // Greedy is optimal for canonical systems (like the default); verify cheaply for small sets.
  if (isCanonical(types)) return greedy(amount, types);
  const INF = Number.MAX_SAFE_INTEGER;
  const best = new Array<number>(amount + 1).fill(INF);
  const pick = new Array<number>(amount + 1).fill(0);
  best[0] = 0;
  for (let v = 1; v <= amount; v++) {
    for (const c of types) {
      if (c <= v && best[v - c]! + 1 < best[v]!) {
        best[v] = best[v - c]! + 1;
        pick[v] = c;
      }
    }
  }
  if (best[amount] === INF) throw new CoinError('UNREPRESENTABLE', `Cannot make ${amount} from these coins.`);
  const out: Purse = {};
  for (let v = amount; v > 0; v -= pick[v]!) {
    const c = pick[v]!;
    out[c] = (out[c] ?? 0) + 1;
  }
  return out;
}

function greedy(amount: number, typesDesc: number[]): Purse {
  const out: Purse = {};
  let rest = amount;
  for (const c of typesDesc) {
    const n = Math.floor(rest / c);
    if (n > 0) {
      out[c] = n;
      rest -= n * c;
    }
  }
  if (rest !== 0) throw new CoinError('UNREPRESENTABLE', `Cannot make ${amount} from these coins.`);
  return out;
}

const canonicalCache = new Map<string, boolean>();
/** Kozen–Zaks style check: greedy is optimal iff it's optimal for all amounts < c_{n-1} + c_n. */
function isCanonical(typesDesc: number[]): boolean {
  const key = typesDesc.join(',');
  const cached = canonicalCache.get(key);
  if (cached !== undefined) return cached;
  let result = true;
  if (typesDesc.length >= 3) {
    const limit = typesDesc[0]! + (typesDesc[1] ?? 0);
    const best = new Array<number>(limit + 1).fill(Number.MAX_SAFE_INTEGER);
    best[0] = 0;
    for (let v = 1; v <= limit && result; v++) {
      for (const c of typesDesc) if (c <= v) best[v] = Math.min(best[v]!, best[v - c]! + 1);
      let g = 0;
      let rest = v;
      for (const c of typesDesc) {
        g += Math.floor(rest / c);
        rest %= c;
      }
      if (g !== best[v]) result = false;
    }
  }
  canonicalCache.set(key, result);
  return result;
}

/**
 * Bounded "fewest coins" subset-sum over the purse for every total in [0, maxTotal].
 * Uses a sliding-window minimum per residue class so it runs in O(types × maxTotal)
 * regardless of how many coins of each type the purse holds.
 * Returns a function that reconstructs the coin selection for a reachable total.
 */
function boundedSubsets(purse: Purse, maxTotal: number) {
  const INF = Number.MAX_SAFE_INTEGER;
  const denoms = Object.keys(purse)
    .map(Number)
    .filter((d) => (purse[d] ?? 0) > 0)
    .sort((a, b) => b - a);
  let dp = new Array<number>(maxTotal + 1).fill(INF);
  dp[0] = 0;
  const takes: Int32Array[] = [];
  for (const d of denoms) {
    const count = purse[d]!;
    const next = new Array<number>(maxTotal + 1).fill(INF);
    const take = new Int32Array(maxTotal + 1);
    for (let r = 0; r < d && r <= maxTotal; r++) {
      // Monotonic deque over t (index along residue class) minimizing dp[r+t*d] - t.
      const valueAt = (t: number) => {
        const vv = r + t * d;
        return dp[vv]! === INF ? INF : dp[vv]! - t;
      };
      const dq: number[] = [];
      let head = 0;
      for (let t = 0, v = r; v <= maxTotal; t++, v += d) {
        const w = valueAt(t);
        while (dq.length > head && valueAt(dq[dq.length - 1]!) >= w) dq.pop();
        dq.push(t);
        while (dq[head]! < t - count) head++;
        const s = dq[head]!;
        const ws = valueAt(s);
        if (ws !== INF) {
          next[v] = ws + t;
          take[v] = t - s;
        }
      }
    }
    dp = next;
    takes.push(take);
  }
  return {
    reachable: (total: number) => total <= maxTotal && dp[total]! !== INF,
    coins: (total: number) => dp[total]!,
    reconstruct(total: number): Purse {
      const out: Purse = {};
      let v = total;
      for (let i = denoms.length - 1; i >= 0; i--) {
        const n = takes[i]![v]!;
        if (n > 0) out[denoms[i]!] = n;
        v -= n * denoms[i]!;
      }
      return out;
    },
  };
}

export interface Payment {
  /** Coins handed over from the purse. */
  coinsOut: Purse;
  /** Change handed back into the purse. */
  coinsIn: Purse;
  newPurse: Purse;
  /** Amount added to the member's IOU debt (0 when fully paid from the purse). */
  debtAdded: number;
}

/**
 * Pays `amount` from the purse like a cash register:
 * 1. exact combination with the fewest coins if one exists (no change),
 * 2. otherwise the smallest overpayment (fewest coins), with change returned via `payout`.
 * Throws INSUFFICIENT when the purse's balance is too low.
 */
export function pay(purse: Purse, amount: number, coinTypes: CoinTypes = DEFAULT_COIN_TYPES): Payment {
  assertAmount(amount);
  const clean = cleanPurse(purse);
  if (amount === 0) return { coinsOut: {}, coinsIn: {}, newPurse: clean, debtAdded: 0 };
  const total = balance(clean);
  if (total < amount) {
    throw new CoinError('INSUFFICIENT', `Need ${amount} coins but only ${total} are in the purse.`);
  }
  const maxDenom = Math.max(...Object.keys(clean).map(Number));
  // Any purse with balance ≥ amount has a subset summing to [amount, amount + maxDenom).
  const limit = Math.min(total, amount + maxDenom - 1);
  const subsets = boundedSubsets(clean, limit);
  let target = -1;
  for (let v = amount; v <= limit; v++) {
    if (subsets.reachable(v)) {
      target = v;
      break;
    }
  }
  if (target < 0) throw new CoinError('INSUFFICIENT', 'No combination of coins covers this amount.');
  const coinsOut = subsets.reconstruct(target);
  const coinsIn = target > amount ? payout(target - amount, coinTypes) : {};
  const afterOut = removeCoins(clean, coinsOut)!;
  return { coinsOut, coinsIn, newPurse: addCoins(afterOut, coinsIn), debtAdded: 0 };
}

/**
 * Pays with IOU support: if the purse falls short, the whole purse is spent and the
 * shortfall becomes debt, as long as the total debt stays within `debtLimit`.
 */
export function payWithDebt(
  purse: Purse,
  debt: number,
  amount: number,
  debtLimit: number,
  coinTypes: CoinTypes = DEFAULT_COIN_TYPES,
): Payment & { newDebt: number } {
  assertAmount(amount);
  const total = balance(purse);
  if (total >= amount) return { ...pay(purse, amount, coinTypes), newDebt: debt };
  const shortfall = amount - total;
  if (debt + shortfall > debtLimit) {
    const room = Math.max(0, debtLimit - debt);
    throw new CoinError(
      'INSUFFICIENT',
      room > 0
        ? `You have ${total} coins and can borrow ${room} more (IOU limit ${debtLimit}).`
        : `You have ${total} coins and your IOU limit is used up.`,
    );
  }
  return {
    coinsOut: cleanPurse(purse),
    coinsIn: {},
    newPurse: {},
    debtAdded: shortfall,
    newDebt: debt + shortfall,
  };
}

export interface Receipt {
  coinsIn: Purse;
  debtPaid: number;
  newPurse: Purse;
  newDebt: number;
}

/** Receives `amount` coins of value. Outstanding debt is paid off first. */
export function receive(purse: Purse, debt: number, amount: number, coinTypes: CoinTypes = DEFAULT_COIN_TYPES): Receipt {
  assertAmount(amount);
  const debtPaid = Math.min(debt, amount);
  const coinsIn = payout(amount - debtPaid, coinTypes);
  return { coinsIn, debtPaid, newPurse: addCoins(purse, coinsIn), newDebt: debt - debtPaid };
}

/**
 * Reverses a payment (rejected purchase, undo). Returns the exact coins when the purse still
 * holds the change that was given; otherwise returns the same value in fresh coins.
 * Debt added by the payment is cancelled; if some of it was already paid off by
 * earnings in the meantime, that part comes back as coins.
 */
export function refund(
  purse: Purse,
  debt: number,
  payment: Pick<Payment, 'coinsOut' | 'coinsIn' | 'debtAdded'>,
  coinTypes: CoinTypes = DEFAULT_COIN_TYPES,
): Receipt & { exact: boolean } {
  const debtCancelled = Math.min(debt, payment.debtAdded);
  const alreadyRepaid = payment.debtAdded - debtCancelled;
  const newDebt = debt - debtCancelled;
  const withoutChange = removeCoins(purse, payment.coinsIn);
  if (withoutChange) {
    let newPurse = addCoins(withoutChange, payment.coinsOut);
    let coinsIn = { ...payment.coinsOut };
    if (alreadyRepaid > 0) {
      const extra = payout(alreadyRepaid, coinTypes);
      newPurse = addCoins(newPurse, extra);
      coinsIn = addCoins(coinsIn, extra);
    }
    return { coinsIn, debtPaid: 0, newPurse, newDebt, exact: true };
  }
  const value = balance(payment.coinsOut) - balance(payment.coinsIn) + alreadyRepaid;
  const r = receive(purse, newDebt, value, coinTypes);
  return { ...r, exact: false };
}

/** Re-mints a purse into a new set of coin types, keeping its value. */
export function convertPurse(purse: Purse, coinTypes: CoinTypes): Purse {
  validateCoinTypes(coinTypes);
  return payout(balance(purse), coinTypes);
}

/** Purse sorted by denomination descending, for display. */
export function purseEntries(purse: Purse, coinTypes: CoinTypes = DEFAULT_COIN_TYPES) {
  return sortedDesc(coinTypes).map((denom) => ({ denom, count: purse[denom] ?? 0 }));
}
