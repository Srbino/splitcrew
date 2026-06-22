/**
 * Pure wallet calculations shared by the API, the wallet overview UI and the export.
 *
 * Everything operates in EUR (the canonical storage currency). No DB, no I/O —
 * so it is fully unit-testable and produces identical numbers everywhere.
 */

/** Round to 2 decimal places, killing floating-point noise. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface Balance {
  userId: number;
  paid: number;
  share: number;
  balance: number;
}

/**
 * Compute per-user balance (paid − share) in EUR.
 * `userIds` drives the output order; missing map entries count as 0.
 */
export function computeBalances(
  userIds: number[],
  paidMap: Record<number, number>,
  shareMap: Record<number, number>,
): Balance[] {
  return userIds.map(userId => {
    const paid = round2(paidMap[userId] ?? 0);
    const share = round2(shareMap[userId] ?? 0);
    return { userId, paid, share, balance: round2(paid - share) };
  });
}

export interface Transfer {
  from_user_id: number;
  to_user_id: number;
  amount: number;
}

/**
 * "Who owes whom" — produces a near-minimal set of payments that settles every
 * balance exactly. This is the standard debt-simplification approach (the same
 * idea Splitwise uses): the goal is the fewest possible payments overall.
 *
 * Two passes, both working in integer **cents** so there is zero floating-point
 * drift and the transfers always sum back to the balances exactly:
 *
 *  1. Exact matches — if a debtor owes exactly what some creditor is owed, a
 *     single payment clears both of them. One payment settles two people.
 *  2. Greedy — repeatedly pay the largest remaining debtor to the largest
 *     remaining creditor. Each payment fully clears at least one person, so the
 *     total number of payments is at most (people − 1), which is the theoretical
 *     minimum when no smaller zero-sum subgroup exists.
 *
 * Balances rounded to 0 cents are treated as already settled.
 */
export function computeSettlements(balances: { userId: number; balance: number }[]): Transfer[] {
  const debtors: { userId: number; cents: number }[] = [];
  const creditors: { userId: number; cents: number }[] = [];

  for (const b of balances) {
    const cents = Math.round(b.balance * 100);
    if (cents < 0) debtors.push({ userId: b.userId, cents: -cents });
    else if (cents > 0) creditors.push({ userId: b.userId, cents });
  }

  const transfers: Transfer[] = [];
  const push = (from: number, to: number, cents: number) => {
    if (cents > 0) transfers.push({ from_user_id: from, to_user_id: to, amount: cents / 100 });
  };

  // Pass 1 — exact matches (one payment fully settles a debtor and a creditor)
  for (const d of debtors) {
    if (d.cents === 0) continue;
    const c = creditors.find(c => c.cents === d.cents);
    if (c) {
      push(d.userId, c.userId, d.cents);
      d.cents = 0;
      c.cents = 0;
    }
  }

  // Pass 2 — greedy on whatever is left, largest debtor → largest creditor
  const remD = debtors.filter(d => d.cents > 0).sort((a, b) => b.cents - a.cents);
  const remC = creditors.filter(c => c.cents > 0).sort((a, b) => b.cents - a.cents);
  let di = 0;
  let ci = 0;
  while (di < remD.length && ci < remC.length) {
    const amount = Math.min(remD[di].cents, remC[ci].cents);
    push(remD[di].userId, remC[ci].userId, amount);
    remD[di].cents -= amount;
    remC[ci].cents -= amount;
    if (remD[di].cents === 0) di++;
    if (remC[ci].cents === 0) ci++;
  }

  return transfers;
}

export interface TransferStats {
  /** total number of payments */
  count: number;
  /** the most people any single debtor has to pay */
  maxPayeesPerDebtor: number;
  /** the most people any single creditor receives from */
  maxPayersPerCreditor: number;
}

/** Diagnostics for a settlement plan — used in the overview/export and tests. */
export function transferStats(transfers: Transfer[]): TransferStats {
  const payees = new Map<number, Set<number>>();
  const payers = new Map<number, Set<number>>();
  for (const t of transfers) {
    if (!payees.has(t.from_user_id)) payees.set(t.from_user_id, new Set());
    payees.get(t.from_user_id)!.add(t.to_user_id);
    if (!payers.has(t.to_user_id)) payers.set(t.to_user_id, new Set());
    payers.get(t.to_user_id)!.add(t.from_user_id);
  }
  const max = (m: Map<number, Set<number>>) => {
    let n = 0;
    for (const s of m.values()) n = Math.max(n, s.size);
    return n;
  };
  return { count: transfers.length, maxPayeesPerDebtor: max(payees), maxPayersPerCreditor: max(payers) };
}

export interface ExpenseLike {
  amount_eur: number;
  category: string;
  paid_by: number;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

/** Sum + count per category, sorted by total descending. */
export function aggregateByCategory(expenses: ExpenseLike[]): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const cur = map.get(e.category) ?? { total: 0, count: 0 };
    cur.total += e.amount_eur;
    cur.count += 1;
    map.set(e.category, cur);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, total: round2(v.total), count: v.count }))
    .sort((a, b) => b.total - a.total);
}

export interface PayerTotal {
  paid_by: number;
  total: number;
  count: number;
}

/** Sum + count per payer, sorted by total descending. */
export function aggregateByPayer(expenses: ExpenseLike[]): PayerTotal[] {
  const map = new Map<number, { total: number; count: number }>();
  for (const e of expenses) {
    const cur = map.get(e.paid_by) ?? { total: 0, count: 0 };
    cur.total += e.amount_eur;
    cur.count += 1;
    map.set(e.paid_by, cur);
  }
  return [...map.entries()]
    .map(([paid_by, v]) => ({ paid_by, total: round2(v.total), count: v.count }))
    .sort((a, b) => b.total - a.total);
}

export interface Summary {
  total: number;
  count: number;
  avgPerExpense: number;
  topCategory: string | null;
}

/** Headline numbers for the overview cards. */
export function summarize(expenses: ExpenseLike[]): Summary {
  const count = expenses.length;
  if (count === 0) return { total: 0, count: 0, avgPerExpense: 0, topCategory: null };
  const total = round2(expenses.reduce((s, e) => s + e.amount_eur, 0));
  const byCat = aggregateByCategory(expenses);
  return {
    total,
    count,
    avgPerExpense: round2(total / count),
    topCategory: byCat[0]?.category ?? null,
  };
}

export interface DonutSegment {
  /** share of the whole, 0..1 */
  fraction: number;
  /** stroke-dasharray length for this segment */
  dash: number;
  /** cumulative start (0..1) — multiply by circumference for stroke-dashoffset */
  offset: number;
}

/**
 * SVG donut geometry from a list of values. Returns one segment per value in
 * input order; `dash` is scaled to `circumference` (default 100 for percentages).
 * Empty / all-zero input yields [].
 */
export function donutSegments(
  values: number[],
  opts: { circumference?: number } = {},
): DonutSegment[] {
  const circumference = opts.circumference ?? 100;
  const total = values.reduce((s, v) => s + (v > 0 ? v : 0), 0);
  if (total <= 0) return [];
  const segments: DonutSegment[] = [];
  let acc = 0;
  for (const v of values) {
    const fraction = (v > 0 ? v : 0) / total;
    segments.push({ fraction, dash: fraction * circumference, offset: acc });
    acc += fraction;
  }
  return segments;
}

/**
 * Bar widths (0..100) relative to the max value (or an explicit max).
 * All-zero input yields all zeros.
 */
export function barScale(values: number[], max?: number): number[] {
  const peak = max ?? Math.max(0, ...values);
  if (peak <= 0) return values.map(() => 0);
  return values.map(v => round2((v / peak) * 100));
}
