import { ConditionFailed, type Condition, type Db, type Item, type Key, type QueryOptions, type WriteOp } from './types';

const k = (key: Key) => `${key.pk}\u0000${key.sk}`;
const clone = <T>(v: T): T => structuredClone(v);

/** In-memory Db with the same semantics as the DynamoDB implementation (for tests and local dev). */
export class MemoryDb implements Db {
  readonly items = new Map<string, Item>();

  constructor(private readonly clock: () => number = () => Date.now()) {}

  private live(item: Item | undefined): Item | undefined {
    if (!item) return undefined;
    if (item.ttl && item.ttl * 1000 < this.clock()) return undefined;
    return item;
  }

  private check(key: Key, cond: Condition | undefined): boolean {
    if (!cond) return true;
    const existing = this.live(this.items.get(k(key)));
    if ('notExists' in cond) return !existing;
    if ('exists' in cond) return !!existing;
    if ('version' in cond) return !!existing && existing.version === cond.version;
    if ('equals' in cond) return !!existing && Object.entries(cond.equals).every(([f, v]) => existing[f] === v);
    if ('fieldMissing' in cond) return !!existing && existing[cond.fieldMissing] === undefined;
    return true;
  }

  async get<T extends Item>(key: Key) {
    const item = this.live(this.items.get(k(key)));
    return item ? (clone(item) as T) : undefined;
  }

  async getMany<T extends Item>(keys: Key[]) {
    const out: T[] = [];
    for (const key of keys) {
      const item = await this.get<T>(key);
      if (item) out.push(item);
    }
    return out;
  }

  async query<T extends Item>(pk: string, o: QueryOptions = {}) {
    const pkField = o.index === 'gsi1' ? 'gsi1pk' : 'pk';
    const skField = o.index === 'gsi1' ? 'gsi1sk' : 'sk';
    let rows = [...this.items.values()]
      .filter((i) => this.live(i) && i[pkField] === pk)
      .filter((i) => {
        const sk = String(i[skField] ?? '');
        if (o.beginsWith && !sk.startsWith(o.beginsWith)) return false;
        if (o.after !== undefined && !(sk > o.after)) return false;
        if (o.before !== undefined && !(sk < o.before)) return false;
        return true;
      })
      .sort((a, b) => (String(a[skField]) < String(b[skField]) ? -1 : 1));
    if (o.newestFirst) rows.reverse();
    if (o.limit) rows = rows.slice(0, o.limit);
    return clone(rows) as T[];
  }

  async transact(ops: WriteOp[]) {
    if (ops.length > 100) throw new Error('Too many operations in one transaction.');
    const keys = new Set<string>();
    ops.forEach((op, i) => {
      const key = 'put' in op ? op.put : 'delete' in op ? op.delete : 'check' in op ? op.check : op.increment;
      const id = k(key);
      if (keys.has(id)) throw new Error(`Transaction touches ${id} twice.`);
      keys.add(id);
      if ('increment' in op) {
        const current = Number(this.live(this.items.get(id))?.[op.field] ?? 0);
        if (op.max !== undefined && current + op.by > op.max) throw new ConditionFailed(i);
      } else if (!this.check(key, op.if)) throw new ConditionFailed(i);
    });
    for (const op of ops) {
      if ('put' in op) this.items.set(k(op.put), clone(op.put));
      else if ('delete' in op) this.items.delete(k(op.delete));
      else if ('increment' in op) {
        const id = k(op.increment);
        const existing = this.live(this.items.get(id)) ?? { ...op.init, ...op.increment };
        existing[op.field] = Number(existing[op.field] ?? 0) + op.by;
        this.items.set(id, existing);
      }
    }
  }

  async put(item: Item, cond?: Condition) {
    await this.transact([{ put: item, if: cond }]);
  }

  async delete(key: Key, cond?: Condition) {
    await this.transact([{ delete: key, if: cond }]);
  }

  async increment(key: Key, field: string, by: number, max?: number, init?: Omit<Item, 'pk' | 'sk'>) {
    await this.transact([{ increment: key, field, by, max, init }]);
    return Number(this.items.get(k(key))![field]);
  }

  async deletePartition(pk: string) {
    let n = 0;
    for (const [id, item] of this.items) {
      if (item.pk === pk) {
        this.items.delete(id);
        n++;
      }
    }
    return n;
  }

  async *scanIndex<T extends Item>(gsi1pk: string): AsyncIterable<T> {
    for (const item of await this.query<T>(gsi1pk, { index: 'gsi1' })) yield item;
  }
}
