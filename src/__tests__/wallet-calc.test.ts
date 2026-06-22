/**
 * Wallet calculation tests (TDD).
 *
 * Pure logic shared by /api/wallet, the wallet overview UI, and the export.
 * Everything works in EUR (the canonical storage currency).
 */
import { describe, it, expect } from 'vitest';
import {
  computeBalances,
  computeSettlements,
  aggregateByCategory,
  aggregateByPayer,
  aggregateByPayerCategory,
  summarize,
  donutSegments,
  barScale,
  type ExpenseLike,
} from '@/lib/wallet-calc';

// ─── computeBalances ───

describe('computeBalances', () => {
  it('balance = paid - share, rounded to cents', () => {
    const res = computeBalances([1, 2], { 1: 100 }, { 1: 40, 2: 60 });
    const u1 = res.find(r => r.userId === 1)!;
    const u2 = res.find(r => r.userId === 2)!;
    expect(u1).toMatchObject({ userId: 1, paid: 100, share: 40, balance: 60 });
    expect(u2).toMatchObject({ userId: 2, paid: 0, share: 60, balance: -60 });
  });

  it('treats missing map entries as 0', () => {
    const res = computeBalances([7], {}, {});
    expect(res[0]).toMatchObject({ paid: 0, share: 0, balance: 0 });
  });

  it('rounds floating point noise to 2 decimals', () => {
    const res = computeBalances([1], { 1: 0.1 + 0.2 }, { 1: 0 });
    expect(res[0].balance).toBe(0.3);
  });

  it('preserves user order from input', () => {
    const res = computeBalances([3, 1, 2], {}, {});
    expect(res.map(r => r.userId)).toEqual([3, 1, 2]);
  });
});

// ─── computeSettlements (greedy who-owes-whom) ───

describe('computeSettlements', () => {
  it('returns empty when everyone is balanced', () => {
    const res = computeSettlements([
      { userId: 1, balance: 0 },
      { userId: 2, balance: 0 },
    ]);
    expect(res).toEqual([]);
  });

  it('handles a simple two-person debt', () => {
    const res = computeSettlements([
      { userId: 1, balance: -30 }, // owes
      { userId: 2, balance: 30 },  // is owed
    ]);
    expect(res).toEqual([{ from_user_id: 1, to_user_id: 2, amount: 30 }]);
  });

  it('conserves money: sum of transfers equals total debt', () => {
    const balances = [
      { userId: 1, balance: -50 },
      { userId: 2, balance: -25 },
      { userId: 3, balance: 75 },
    ];
    const res = computeSettlements(balances);
    const moved = res.reduce((s, t) => s + t.amount, 0);
    expect(moved).toBeCloseTo(75, 2);
    // every transfer goes from a debtor to a creditor
    for (const t of res) {
      expect(t.from_user_id === 1 || t.from_user_id === 2).toBe(true);
      expect(t.to_user_id).toBe(3);
    }
  });

  it('minimises transactions (largest debtor matched first)', () => {
    const res = computeSettlements([
      { userId: 1, balance: -70 },
      { userId: 2, balance: -30 },
      { userId: 3, balance: 60 },
      { userId: 4, balance: 40 },
    ]);
    // 100 of debt, 100 of credit — solvable in 3 transfers max with greedy
    const moved = res.reduce((s, t) => s + t.amount, 0);
    expect(moved).toBeCloseTo(100, 2);
    expect(res.length).toBeLessThanOrEqual(3);
  });

  it('ignores sub-cent balances', () => {
    const res = computeSettlements([
      { userId: 1, balance: -0.004 },
      { userId: 2, balance: 0.004 },
    ]);
    expect(res).toEqual([]);
  });

  it('transfers the smaller side and keeps amounts in whole cents', () => {
    const res = computeSettlements([
      { userId: 1, balance: -33.33 },
      { userId: 2, balance: 33.34 },
    ]);
    expect(res[0].amount).toBe(33.33); // limited by the debtor
    // never more than 2 decimal places
    expect(Math.round(res[0].amount * 100)).toBe(res[0].amount * 100);
  });
});

// ─── aggregateByCategory ───

const SAMPLE: ExpenseLike[] = [
  { amount_eur: 100, category: 'fuel', paid_by: 1 },
  { amount_eur: 50, category: 'food', paid_by: 2 },
  { amount_eur: 25, category: 'fuel', paid_by: 1 },
  { amount_eur: 25, category: 'food', paid_by: 3 },
];

describe('aggregateByCategory', () => {
  it('sums amounts and counts per category, sorted by total desc', () => {
    const res = aggregateByCategory(SAMPLE);
    expect(res).toEqual([
      { category: 'fuel', total: 125, count: 2 },
      { category: 'food', total: 75, count: 2 },
    ]);
  });

  it('returns [] for no expenses', () => {
    expect(aggregateByCategory([])).toEqual([]);
  });
});

// ─── aggregateByPayer ───

describe('aggregateByPayer', () => {
  it('sums amounts per payer, sorted by total desc', () => {
    const res = aggregateByPayer(SAMPLE);
    expect(res[0]).toEqual({ paid_by: 1, total: 125, count: 2 });
    expect(res.find(r => r.paid_by === 2)).toEqual({ paid_by: 2, total: 50, count: 1 });
  });
});

// ─── aggregateByPayerCategory (the matrix) ───

describe('aggregateByPayerCategory', () => {
  it('builds a person × category matrix with totals', () => {
    const m = aggregateByPayerCategory(SAMPLE);
    // categories ordered by total: fuel 125 > food 75
    expect(m.categories).toEqual(['fuel', 'food']);
    // payer 1 paid all fuel (125), payer 2 food 50, payer 3 food 25
    const row1 = m.rows.find(r => r.paid_by === 1)!;
    expect(row1.byCat).toEqual({ fuel: 125, food: 0 });
    expect(row1.total).toBe(125);
    const row2 = m.rows.find(r => r.paid_by === 2)!;
    expect(row2.byCat).toEqual({ fuel: 0, food: 50 });
    expect(m.columnTotals).toEqual({ fuel: 125, food: 75 });
    expect(m.grandTotal).toBe(200);
  });

  it('rows are sorted by total descending', () => {
    const m = aggregateByPayerCategory(SAMPLE);
    const totals = m.rows.map(r => r.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it('column totals equal the sum of every row cell, and grand total matches', () => {
    const m = aggregateByPayerCategory(SAMPLE);
    for (const c of m.categories) {
      const colFromRows = m.rows.reduce((s, r) => s + r.byCat[c], 0);
      expect(Math.round(colFromRows * 100) / 100).toBe(m.columnTotals[c]);
    }
    const sumRows = m.rows.reduce((s, r) => s + r.total, 0);
    expect(Math.round(sumRows * 100) / 100).toBe(m.grandTotal);
  });

  it('handles no expenses', () => {
    expect(aggregateByPayerCategory([])).toEqual({ categories: [], rows: [], columnTotals: {}, grandTotal: 0 });
  });
});

// ─── summarize ───

describe('summarize', () => {
  it('computes total, count, average and top category', () => {
    const res = summarize(SAMPLE);
    expect(res.total).toBe(200);
    expect(res.count).toBe(4);
    expect(res.avgPerExpense).toBe(50);
    expect(res.topCategory).toBe('fuel');
  });

  it('handles empty input safely', () => {
    expect(summarize([])).toEqual({ total: 0, count: 0, avgPerExpense: 0, topCategory: null });
  });
});

// ─── donutSegments (SVG geometry) ───

describe('donutSegments', () => {
  it('fractions sum to 1 and offsets are cumulative', () => {
    const segs = donutSegments([25, 25, 50]);
    expect(segs.map(s => s.fraction)).toEqual([0.25, 0.25, 0.5]);
    // offsets are the cumulative start of each segment
    expect(segs[0].offset).toBeCloseTo(0, 5);
    expect(segs[1].offset).toBeCloseTo(0.25, 5);
    expect(segs[2].offset).toBeCloseTo(0.5, 5);
  });

  it('scales dash lengths to the given circumference', () => {
    const segs = donutSegments([1, 1], { circumference: 100 });
    expect(segs[0].dash).toBeCloseTo(50, 5);
    expect(segs[1].dash).toBeCloseTo(50, 5);
  });

  it('returns [] when total is zero', () => {
    expect(donutSegments([0, 0])).toEqual([]);
    expect(donutSegments([])).toEqual([]);
  });
});

// ─── barScale ───

describe('barScale', () => {
  it('returns widths relative to the max value (0..100)', () => {
    expect(barScale([50, 100, 25])).toEqual([50, 100, 25]);
  });

  it('returns all zeros when every value is zero', () => {
    expect(barScale([0, 0])).toEqual([0, 0]);
  });

  it('accepts an explicit max', () => {
    expect(barScale([50], 200)).toEqual([25]);
  });
});
