import { DynamoDBClient, TransactionCanceledException, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { ConditionFailed, type Condition, type Db, type Item, type Key, type QueryOptions, type WriteOp } from './types';

type Expr = { ConditionExpression?: string; ExpressionAttributeNames?: Record<string, string>; ExpressionAttributeValues?: Record<string, unknown> };

function condition(cond: Condition | undefined): Expr {
  if (!cond) return {};
  if ('notExists' in cond) return { ConditionExpression: 'attribute_not_exists(pk)' };
  if ('exists' in cond) return { ConditionExpression: 'attribute_exists(pk)' };
  if ('version' in cond)
    return { ConditionExpression: '#v = :v', ExpressionAttributeNames: { '#v': 'version' }, ExpressionAttributeValues: { ':v': cond.version } };
  if ('fieldMissing' in cond)
    return {
      ConditionExpression: 'attribute_exists(pk) AND attribute_not_exists(#f)',
      ExpressionAttributeNames: { '#f': cond.fieldMissing },
    };
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const parts = Object.entries(cond.equals).map(([f, v], i) => {
    names[`#e${i}`] = f;
    values[`:e${i}`] = v;
    return `#e${i} = :e${i}`;
  });
  return { ConditionExpression: parts.join(' AND '), ExpressionAttributeNames: names, ExpressionAttributeValues: values };
}

function incrementExpr(op: Extract<WriteOp, { increment: Key }>) {
  const names: Record<string, string> = { '#f': op.field };
  const values: Record<string, unknown> = { ':by': op.by, ':zero': 0 };
  const sets = ['#f = if_not_exists(#f, :zero) + :by'];
  Object.entries(op.init ?? {}).forEach(([f, v], i) => {
    if (f === op.field) return;
    names[`#i${i}`] = f;
    values[`:i${i}`] = v;
    sets.push(`#i${i} = if_not_exists(#i${i}, :i${i})`);
  });
  const expr: Expr & { UpdateExpression: string } = {
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
  if (op.max !== undefined) {
    values[':limit'] = op.max - op.by;
    expr.ConditionExpression = 'attribute_not_exists(#f) OR #f <= :limit';
  }
  return expr;
}

const cleanExpr = <T extends Expr>(e: T): T => {
  if (e.ExpressionAttributeNames && Object.keys(e.ExpressionAttributeNames).length === 0) delete e.ExpressionAttributeNames;
  if (e.ExpressionAttributeValues && Object.keys(e.ExpressionAttributeValues).length === 0) delete e.ExpressionAttributeValues;
  return e;
};

export class DynamoDb implements Db {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly table: string,
    client = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async get<T extends Item>(key: Key) {
    const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: { pk: key.pk, sk: key.sk } }));
    return r.Item as T | undefined;
  }

  async getMany<T extends Item>(keys: Key[]) {
    const out: T[] = [];
    for (let i = 0; i < keys.length; i += 100) {
      let request: Record<string, { Keys: Record<string, unknown>[] }> | undefined = {
        [this.table]: { Keys: keys.slice(i, i + 100).map((key) => ({ pk: key.pk, sk: key.sk })) },
      };
      while (request && Object.keys(request).length) {
        const r = await this.doc.send(new BatchGetCommand({ RequestItems: request }));
        out.push(...((r.Responses?.[this.table] ?? []) as T[]));
        request = r.UnprocessedKeys as typeof request;
      }
    }
    return out;
  }

  async query<T extends Item>(pk: string, o: QueryOptions = {}) {
    const pkField = o.index === 'gsi1' ? 'gsi1pk' : 'pk';
    const skField = o.index === 'gsi1' ? 'gsi1sk' : 'sk';
    const names: Record<string, string> = { '#pk': pkField };
    const values: Record<string, unknown> = { ':pk': pk };
    const conds = ['#pk = :pk'];
    if (o.beginsWith !== undefined || o.after !== undefined || o.before !== undefined) names['#sk'] = skField;
    if (o.beginsWith !== undefined && o.after === undefined && o.before === undefined) {
      values[':b'] = o.beginsWith;
      conds.push('begins_with(#sk, :b)');
    } else {
      // Range with an optional prefix: express the prefix as bounds.
      const lower = o.after ?? (o.beginsWith !== undefined ? o.beginsWith : undefined);
      const upper = o.before ?? (o.beginsWith !== undefined ? `${o.beginsWith}￿` : undefined);
      if (lower !== undefined) {
        values[':lo'] = lower;
        conds.push(o.after !== undefined ? '#sk > :lo' : '#sk >= :lo');
      }
      if (upper !== undefined) {
        values[':hi'] = upper;
        conds.push('#sk < :hi');
      }
    }
    const out: T[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(
        new QueryCommand({
          TableName: this.table,
          IndexName: o.index === 'gsi1' ? 'gsi1' : undefined,
          KeyConditionExpression: conds.join(' AND '),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ScanIndexForward: !o.newestFirst,
          Limit: o.limit ? o.limit - out.length : undefined,
          ExclusiveStartKey: start,
        }),
      );
      out.push(...((r.Items ?? []) as T[]));
      start = r.LastEvaluatedKey;
    } while (start && (!o.limit || out.length < o.limit));
    // Filter expired TTL items DynamoDB hasn't removed yet.
    const now = Date.now() / 1000;
    return out.filter((i) => !i.ttl || i.ttl > now);
  }

  async transact(ops: WriteOp[]) {
    const items: NonNullable<TransactWriteCommandInput['TransactItems']> = ops.map((op) => {
      if ('put' in op) return { Put: cleanExpr({ TableName: this.table, Item: op.put, ...condition(op.if) }) };
      if ('delete' in op)
        return { Delete: cleanExpr({ TableName: this.table, Key: { pk: op.delete.pk, sk: op.delete.sk }, ...condition(op.if) }) };
      if ('check' in op) {
        const c = condition(op.if);
        return {
          ConditionCheck: cleanExpr({ TableName: this.table, Key: { pk: op.check.pk, sk: op.check.sk }, ...c, ConditionExpression: c.ConditionExpression! }),
        };
      }
      return { Update: cleanExpr({ TableName: this.table, Key: { pk: op.increment.pk, sk: op.increment.sk }, ...incrementExpr(op) }) };
    });
    try {
      if (items.length === 1 && !('ConditionCheck' in items[0]!)) {
        await this.single(ops[0]!);
        return;
      }
      await this.doc.send(new TransactWriteCommand({ TransactItems: items }));
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        const idx = err.CancellationReasons?.findIndex((r) => r.Code === 'ConditionalCheckFailed');
        if (idx !== undefined && idx >= 0) throw new ConditionFailed(idx);
      }
      if (err instanceof ConditionalCheckFailedException) throw new ConditionFailed(0);
      throw err;
    }
  }

  /** Single writes don't need a (2× cost) transaction. */
  private async single(op: WriteOp) {
    if ('put' in op) await this.doc.send(new PutCommand(cleanExpr({ TableName: this.table, Item: op.put, ...condition(op.if) })));
    else if ('delete' in op)
      await this.doc.send(new DeleteCommand(cleanExpr({ TableName: this.table, Key: { pk: op.delete.pk, sk: op.delete.sk }, ...condition(op.if) })));
    else if ('increment' in op)
      await this.doc.send(new UpdateCommand(cleanExpr({ TableName: this.table, Key: { pk: op.increment.pk, sk: op.increment.sk }, ...incrementExpr(op) })));
  }

  async put(item: Item, cond?: Condition) {
    await this.transact([{ put: item, if: cond }]);
  }

  async delete(key: Key, cond?: Condition) {
    await this.transact([{ delete: key, if: cond }]);
  }

  async increment(key: Key, field: string, by: number, max?: number, init?: Omit<Item, 'pk' | 'sk'>) {
    const op = { increment: key, field, by, max, init };
    try {
      const r = await this.doc.send(
        new UpdateCommand(cleanExpr({ TableName: this.table, Key: { pk: key.pk, sk: key.sk }, ...incrementExpr(op), ReturnValues: 'UPDATED_NEW' })),
      );
      return Number(r.Attributes?.[field] ?? 0);
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) throw new ConditionFailed(0);
      throw err;
    }
  }

  async deletePartition(pk: string) {
    const rows = await this.query(pk);
    for (let i = 0; i < rows.length; i += 25) {
      let request: Record<string, unknown[]> | undefined = {
        [this.table]: rows.slice(i, i + 25).map((r) => ({ DeleteRequest: { Key: { pk: r.pk, sk: r.sk } } })),
      };
      while (request && Object.keys(request).length) {
        const r = await this.doc.send(new BatchWriteCommand({ RequestItems: request as never }));
        request = r.UnprocessedItems as typeof request;
      }
    }
    return rows.length;
  }

  async *scanIndex<T extends Item>(gsi1pk: string): AsyncIterable<T> {
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(
        new QueryCommand({
          TableName: this.table,
          IndexName: 'gsi1',
          KeyConditionExpression: 'gsi1pk = :p',
          ExpressionAttributeValues: { ':p': gsi1pk },
          ExclusiveStartKey: start,
        }),
      );
      for (const item of r.Items ?? []) yield item as T;
      start = r.LastEvaluatedKey;
    } while (start);
  }
}
