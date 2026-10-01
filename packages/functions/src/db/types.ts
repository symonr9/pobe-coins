/**
 * A tiny storage interface over one DynamoDB table (pk/sk + gsi1pk/gsi1sk, `ttl`).
 * Conditions are structured (not raw expressions) so an in-memory implementation can
 * honor them exactly in tests.
 */

export interface Key {
  pk: string;
  sk: string;
}

export type Item = Key & {
  gsi1pk?: string;
  gsi1sk?: string;
  /** Epoch seconds; DynamoDB deletes the item some time after this. */
  ttl?: number;
  [field: string]: unknown;
};

export type Condition =
  { notExists: true } | { exists: true } | { version: number } | { equals: Record<string, unknown> } | { fieldMissing: string };

export type WriteOp =
  | { put: Item; if?: Condition }
  | { delete: Key; if?: Condition }
  | { check: Key; if: Condition }
  /** Atomic numeric increment; `max` fails the write if the result would exceed it. */
  | { increment: Key; field: string; by: number; max?: number; init?: Omit<Item, 'pk' | 'sk'> };

export interface QueryOptions {
  index?: 'gsi1';
  beginsWith?: string;
  /** Exclusive bounds on the sort key. */
  after?: string;
  before?: string;
  limit?: number;
  newestFirst?: boolean;
}

export interface Db {
  get<T extends Item = Item>(key: Key): Promise<T | undefined>;
  getMany<T extends Item = Item>(keys: Key[]): Promise<T[]>;
  query<T extends Item = Item>(pk: string, options?: QueryOptions): Promise<T[]>;
  /** Up to 100 operations, all-or-nothing. Throws ConditionFailed if any condition fails. */
  transact(ops: WriteOp[]): Promise<void>;
  put(item: Item, cond?: Condition): Promise<void>;
  delete(key: Key, cond?: Condition): Promise<void>;
  /** Returns the new value. */
  increment(key: Key, field: string, by: number, max?: number, init?: Omit<Item, 'pk' | 'sk'>): Promise<number>;
  /** Deletes every item in a partition (used for household deletion). */
  deletePartition(pk: string): Promise<number>;
  /** Iterates items whose gsi1pk equals a value (e.g. all households for the hourly job). */
  scanIndex<T extends Item = Item>(gsi1pk: string): AsyncIterable<T>;
}

export class ConditionFailed extends Error {
  constructor(public readonly index?: number) {
    super('A condition on the write failed.');
    this.name = 'ConditionFailed';
  }
}

/** Strips storage keys from an item before returning it to clients. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function strip<T = any>(item: Item): T {
  const { pk: _pk, sk: _sk, gsi1pk: _g, gsi1sk: _gs, ttl: _t, type: _type, ...rest } = item;
  return rest as T;
}
