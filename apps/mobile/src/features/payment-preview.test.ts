import { describe, expect, it } from 'vitest';
import { describeCoins, previewPayment } from './payment-preview';

const types = [1, 5, 10, 25, 50, 100];

describe('spend preview', () => {
  it('exact payment', () => {
    expect(previewPayment({ 10: 2 }, 0, 20, types, 50)).toEqual({ kind: 'exact', out: { 10: 2 }, back: {} });
  });
  it('change', () => {
    const p = previewPayment({ 25: 1 }, 0, 20, types, 50)!;
    expect(p.kind).toBe('change');
    expect(describeCoins(p.out)).toBe('1×25');
    expect(describeCoins(p.back)).toBe('1×5');
  });
  it('IOU within the limit, short beyond it', () => {
    expect(previewPayment({ 5: 1 }, 0, 30, types, 50)).toMatchObject({ kind: 'iou', borrow: 25 });
    expect(previewPayment({ 5: 1 }, 40, 30, types, 50)).toMatchObject({ kind: 'short', borrow: 25 });
  });
  it('nothing for zero', () => {
    expect(previewPayment({}, 0, 0, types, 50)).toBeNull();
  });
  it('describes coins largest first', () => {
    expect(describeCoins({ 1: 3, 100: 1, 25: 2 })).toBe('1×100 + 2×25 + 3×1');
  });
});
