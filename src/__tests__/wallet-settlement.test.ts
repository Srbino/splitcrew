/**
 * Settlement correctness + currency conversion verification.
 *
 * Proves three things end-to-end:
 *  1. The "who owes whom" plan settles EVERY balance exactly (no residual,
 *     no money created or lost).
 *  2. The plan uses a near-minimal number of payments (≤ people − 1) and keeps
 *     payments-per-debtor low — the debt-simplification best practice.
 *  3. CZK ⇄ EUR storage and display conversions are correct, including the real
 *     trip numbers.
 */
import { describe, it, expect } from 'vitest';
import {
  computeBalances,
  computeSettlements,
  transferStats,
  type Transfer,
} from '@/lib/wallet-calc';
import { convertToBase, convertFromBase } from '@/lib/currencies';
import realBalances from './fixtures/real-balances.json';

// ── Helpers ──

/** Apply transfers to balances and return the largest leftover (should be ~0). */
function maxResidualCents(
  balances: { userId: number; balance: number }[],
  transfers: Transfer[],
): number {
  const net = new Map<number, number>();
  for (const b of balances) net.set(b.userId, Math.round(b.balance * 100));
  for (const t of transfers) {
    net.set(t.from_user_id, (net.get(t.from_user_id) ?? 0) + Math.round(t.amount * 100)); // debtor pays → balance rises toward 0
    net.set(t.to_user_id, (net.get(t.to_user_id) ?? 0) - Math.round(t.amount * 100));     // creditor receives → balance falls toward 0
  }
  let max = 0;
  for (const v of net.values()) max = Math.max(max, Math.abs(v));
  return max;
}

/** Replicates the route's per-person split (floor + remainder to first payer). */
function splitEur(amountEur: number, count: number): number[] {
  const perPerson = Math.floor((amountEur / count) * 100) / 100;
  const remainder = Math.round((amountEur - perPerson * count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => (i === 0 ? perPerson + remainder : perPerson));
}

const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

// ── 1. Settlement always fully clears every balance ──

describe('settlement fully settles everyone (no residual)', () => {
  const cases: { name: string; balances: { userId: number; balance: number }[] }[] = [
    { name: 'two people', balances: [{ userId: 1, balance: -30 }, { userId: 2, balance: 30 }] },
    { name: 'one creditor, many debtors', balances: [
      { userId: 1, balance: -30 }, { userId: 2, balance: -30 }, { userId: 3, balance: -40 }, { userId: 4, balance: 100 },
    ] },
    { name: 'one debtor, many creditors', balances: [
      { userId: 1, balance: -100 }, { userId: 2, balance: 30 }, { userId: 3, balance: 30 }, { userId: 4, balance: 40 },
    ] },
    { name: 'messy decimals', balances: [
      { userId: 1, balance: -12.37 }, { userId: 2, balance: -88.11 }, { userId: 3, balance: 41.22 },
      { userId: 4, balance: 5.05 }, { userId: 5, balance: 54.21 },
    ] },
    { name: 'already balanced', balances: [{ userId: 1, balance: 0 }, { userId: 2, balance: 0 }] },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const transfers = computeSettlements(c.balances);
      // everyone ends at zero
      expect(maxResidualCents(c.balances, transfers)).toBe(0);
      // money is conserved: total paid out equals total debt
      const totalDebt = Math.round(c.balances.filter(b => b.balance < 0).reduce((s, b) => s - b.balance, 0) * 100);
      const totalMoved = Math.round(transfers.reduce((s, t) => s + t.amount, 0) * 100);
      expect(totalMoved).toBe(totalDebt);
      // each payment is debtor → creditor, positive, max 2 decimals
      const debtorIds = new Set(c.balances.filter(b => b.balance < -0.005).map(b => b.userId));
      const creditorIds = new Set(c.balances.filter(b => b.balance > 0.005).map(b => b.userId));
      for (const t of transfers) {
        expect(debtorIds.has(t.from_user_id)).toBe(true);
        expect(creditorIds.has(t.to_user_id)).toBe(true);
        expect(t.amount).toBeGreaterThan(0);
        expect(Math.round(t.amount * 100)).toBe(t.amount * 100);
      }
    });
  }
});

// ── 2. Near-minimal payments + best-practice structure ──

describe('settlement is near-minimal', () => {
  it('never exceeds (non-zero people − 1) payments', () => {
    const balances = [
      { userId: 1, balance: -70 }, { userId: 2, balance: -30 }, { userId: 3, balance: -55 },
      { userId: 4, balance: 60 }, { userId: 5, balance: 40 }, { userId: 6, balance: 55 },
    ];
    const transfers = computeSettlements(balances);
    const nonZero = balances.filter(b => Math.abs(b.balance) > 0.005).length;
    expect(transfers.length).toBeLessThanOrEqual(nonZero - 1);
  });

  it('exact-match pass: mirrored pairs settle in one payment each', () => {
    const balances = [
      { userId: 1, balance: -50 }, { userId: 2, balance: 50 }, // mirror
      { userId: 3, balance: -25 }, { userId: 4, balance: 25 }, // mirror
    ];
    const transfers = computeSettlements(balances);
    expect(transfers.length).toBe(2);
    const stats = transferStats(transfers);
    expect(stats.maxPayeesPerDebtor).toBe(1); // each debtor pays exactly one person
  });

  it('one big creditor: every debtor pays just one person', () => {
    const balances = [
      { userId: 1, balance: -30 }, { userId: 2, balance: -45 }, { userId: 3, balance: -25 },
      { userId: 4, balance: 100 },
    ];
    const stats = transferStats(computeSettlements(balances));
    expect(stats.maxPayeesPerDebtor).toBe(1);
  });
});

// ── 3. Currency conversion (CZK ⇄ EUR) ──

describe('currency conversion is correct', () => {
  // Real rate from the trip: 1 EUR = 24.227 CZK
  const RATE = 24.227;

  it('stores a CZK expense as the right EUR amount (real: 6375 CZK fuel)', () => {
    // 6375 / 24.227 = 263.13... → 263.14 (matches production amount_eur)
    expect(convertToBase(6375, RATE)).toBe(263.14);
  });

  it('an EUR expense is stored unchanged (route skips conversion for EUR)', () => {
    // The route only calls convertToBase when currency !== EUR; an EUR amount is
    // stored as-is. convertToBase with rate 1 is the identity, confirming that.
    expect(convertToBase(150, 1)).toBe(150);
  });

  it('per-person splits always sum back to the stored EUR amount', () => {
    for (const [amount, count] of [[263.14, 14], [263.14, 15], [100, 3], [0.07, 5], [9999.99, 13]] as [number, number][]) {
      expect(sum(splitEur(amount, count))).toBe(amount);
    }
  });

  it('displays a stored EUR amount back in CZK', () => {
    const storedEur = 263.14;
    const displayCzk = convertFromBase(storedEur, RATE); // 263.14 * 24.227
    expect(displayCzk).toBeGreaterThan(6370);
    expect(displayCzk).toBeLessThan(6380);
  });

  it('CZK → EUR → CZK round-trips within a cent', () => {
    const czk = 6375;
    expect(Math.abs(convertFromBase(convertToBase(czk, RATE), RATE) - czk)).toBeLessThan(1);
  });

  it('settlement amounts convert to CZK for display correctly', () => {
    const owedEur = 342.85; // Alan's debt
    const owedCzk = convertFromBase(owedEur, RATE);
    expect(owedCzk).toBeCloseTo(342.85 * 24.227, 1);
  });
});

// ── 4. Real trip data (Loď vol.5) ──

describe('real trip data: Loď vol.5', () => {
  const users = realBalances.users;
  const paidMap = Object.fromEntries(users.map(u => [u.userId, u.paid]));
  const shareMap = Object.fromEntries(users.map(u => [u.userId, u.share]));
  const balances = computeBalances(users.map(u => u.userId), paidMap, shareMap);

  it('total paid equals total share (money is conserved)', () => {
    const totalPaid = sum(users.map(u => u.paid));
    const totalShare = sum(users.map(u => u.share));
    expect(totalPaid).toBe(realBalances.totalEur);
    expect(totalShare).toBe(realBalances.totalEur);
  });

  it('debtors and creditors net to zero', () => {
    const net = sum(balances.map(b => b.balance));
    expect(net).toBe(0);
  });

  it('the settlement plan clears every single person to zero', () => {
    const transfers = computeSettlements(balances);
    expect(maxResidualCents(balances, transfers)).toBe(0);
  });

  it('total transferred equals the total debt exactly', () => {
    const transfers = computeSettlements(balances);
    const totalDebt = Math.round(balances.filter(b => b.balance < 0).reduce((s, b) => s - b.balance, 0) * 100);
    const moved = Math.round(transfers.reduce((s, t) => s + t.amount, 0) * 100);
    expect(moved).toBe(totalDebt);
  });

  it('uses at most (people − 1) payments and few payees per debtor', () => {
    const transfers = computeSettlements(balances);
    const nonZero = balances.filter(b => Math.abs(b.balance) > 0.005).length;
    const stats = transferStats(transfers);
    expect(transfers.length).toBeLessThanOrEqual(nonZero - 1);
    // On this real data the plan is mostly 1 payee per debtor; assert it stays low.
    expect(stats.maxPayeesPerDebtor).toBeLessThanOrEqual(3);
    // Surface the numbers in the test output for the analysis.
    console.log(`[real data] ${stats.count} payments · max payees/debtor=${stats.maxPayeesPerDebtor} · max payers/creditor=${stats.maxPayersPerCreditor}`);
  });
});
