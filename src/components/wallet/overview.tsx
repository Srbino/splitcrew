'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, PieChart, Receipt, TrendingUp, Table2, Ship, Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn, getInitials, avatarColorClass, formatDate } from '@/lib/utils';
import { formatCurrency, formatTripCzk as fmtCzk } from '@/lib/currencies';
import { donutSegments } from '@/lib/wallet-calc';

// ── Types (mirror /api/wallet?action=summary) ──

export interface CategorySlice { category: string; total: number; count: number }
export interface PayerSlice { paid_by: number; total: number; count: number; name: string; avatar: string | null; boat_id: number }
export interface OweRow {
  from_user_id: number; from_name: string; from_avatar: string | null;
  to_user_id: number; to_name: string; to_avatar: string | null;
  amount: number; is_settled: boolean;
}
export interface MatrixRow { paid_by: number; name: string; avatar: string | null; byCat: Record<string, number>; total: number }
export interface MatrixData {
  categories: string[];
  rows: MatrixRow[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}
export interface ExpenseItem {
  id: number;
  paid_by: number;
  paid_by_name: string;
  description: string;
  category: string;
  expense_date: string;
  amount: number;
  currency: string;
  amount_eur: number;
  split_amounts: Record<number, number>;
}
export interface BoatTotalUI { boat_id: number; boat_name: string; members: number; paid: number; cost: number }
export interface SummaryData {
  summary: { total: number; count: number; avgPerExpense: number; topCategory: string | null };
  by_category: CategorySlice[];
  by_payer: PayerSlice[];
  by_boat?: BoatTotalUI[];
  matrix?: MatrixData;
  matrix_cost?: MatrixData;
  settlements: OweRow[];
}

// Stable category → colour palette (works in light & dark).
const CATEGORY_COLORS: Record<string, string> = {
  food: '#f59e0b',
  transport: '#3b82f6',
  marina: '#06b6d4',
  fuel: '#ef4444',
  entertainment: '#a855f7',
  shopping: '#ec4899',
  accommodation: '#14b8a6',
  other: '#94a3b8',
};
function categoryColor(cat: string, i: number): string {
  return CATEGORY_COLORS[cat] ?? ['#6366f1', '#22c55e', '#eab308', '#f97316', '#0ea5e9'][i % 5];
}

function Avi({ name, avatar, userId }: { name: string; avatar: string | null; userId: number }) {
  return (
    <Avatar size="sm" className={avatarColorClass(userId)}>
      {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

// ── Donut chart (dependency-free SVG) ──

function Donut({
  slices, toDisplay, baseCurrency, categoryLabel,
}: {
  slices: CategorySlice[];
  toDisplay: (eur: number) => number;
  baseCurrency: string;
  categoryLabel: (c: string) => string;
}) {
  const R = 60;
  const STROKE = 26;
  const C = 2 * Math.PI * R;
  const segs = donutSegments(slices.map(s => s.total), { circumference: C });
  const total = slices.reduce((s, x) => s + x.total, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0 -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--muted)" strokeWidth={STROKE} opacity={0.25} />
        {segs.map((seg, i) => (
          <circle
            key={i}
            cx="80" cy="80" r={R} fill="none"
            stroke={categoryColor(slices[i].category, i)}
            strokeWidth={STROKE}
            strokeDasharray={`${seg.dash} ${C - seg.dash}`}
            strokeDashoffset={-seg.offset * C}
          />
        ))}
      </svg>
      <div className="flex-1 w-full space-y-1.5">
        {slices.map((s, i) => (
          <div key={s.category} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: categoryColor(s.category, i) }} />
            <span className="flex-1 truncate">{categoryLabel(s.category)}</span>
            <span className="text-muted-foreground tabular-nums text-xs">
              {total > 0 ? Math.round((s.total / total) * 100) : 0}%
            </span>
            <span className="font-medium tabular-nums w-24 text-right">
              {formatCurrency(toDisplay(s.total), baseCurrency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settlement leveling chart ──
// Each person's bar is what they PAID. A dash-dot vertical line marks the average
// per person. Everyone "levels" to their own fair share: the part of an
// overpayer's bar above their share is hatched (= what they get refunded), and a
// debtor's bar shows a dashed outline up to their share (= what they must top up).
// Under each bar the actual settlement lines list who pays/receives, in € and Kč.

function SettlementChart({
  payers, settlements, toDisplay, baseCurrency, t,
}: {
  payers: PayerSlice[];
  settlements: OweRow[];
  toDisplay: (eur: number) => number;
  baseCurrency: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const outstanding = settlements.filter(s => !s.is_settled);
  const netMap = new Map<number, number>();
  const inMap = new Map<number, OweRow[]>();
  const outMap = new Map<number, OweRow[]>();
  const push = (m: Map<number, OweRow[]>, k: number, v: OweRow) => {
    const arr = m.get(k); if (arr) arr.push(v); else m.set(k, [v]);
  };
  for (const s of outstanding) {
    netMap.set(s.to_user_id, (netMap.get(s.to_user_id) ?? 0) + s.amount);
    netMap.set(s.from_user_id, (netMap.get(s.from_user_id) ?? 0) - s.amount);
    push(inMap, s.to_user_id, s);
    push(outMap, s.from_user_id, s);
  }

  const axisMax = Math.max(1, ...payers.map(p => {
    const nt = netMap.get(p.paid_by) ?? 0;
    return Math.max(p.total, p.total - nt); // debtor share = paid + |net|
  }));

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
          <Scale size={13} /> {t('wallet.settleTitle')}
        </h3>
        <p className="text-[11px] text-muted-foreground mb-4 leading-snug">
          {t('wallet.settleHint')}
        </p>
        <div className="space-y-3.5">
          {payers.map(p => {
            const nt = netMap.get(p.paid_by) ?? 0;
            const paid = p.total;
            const share = paid - nt;
            const isCreditor = nt > 0.005;
            const isDebtor = nt < -0.005;
            const solidW = ((isCreditor ? share : paid) / axisMax) * 100;
            const extraW = (Math.abs(nt) / axisMax) * 100;
            const sharePct = (share / axisMax) * 100; // this person's own fair-share line
            const ins = inMap.get(p.paid_by) ?? [];
            const outs = outMap.get(p.paid_by) ?? [];
            return (
              <div key={p.paid_by} className="flex items-start gap-3">
                <Avi name={p.name} avatar={p.avatar} userId={p.paid_by} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    <span className="text-xs tabular-nums shrink-0">
                      {isCreditor && (
                        <span className="text-green-600 dark:text-green-400">
                          +{formatCurrency(toDisplay(nt), baseCurrency)} · {fmtCzk(nt)}
                        </span>
                      )}
                      {isDebtor && (
                        <span className="text-destructive">
                          −{formatCurrency(toDisplay(-nt), baseCurrency)} · {fmtCzk(-nt)}
                        </span>
                      )}
                      {!isCreditor && !isDebtor && (
                        <span className="text-muted-foreground">{t('wallet.allSettledUp')}</span>
                      )}
                    </span>
                  </div>
                  {/* bar: solid = own share (debtor: paid), hatched/outline = amount to settle */}
                  <div className="relative h-3 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-primary" style={{ width: `${solidW}%` }} />
                    {isCreditor && extraW > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${extraW}%`,
                          backgroundImage:
                            'repeating-linear-gradient(45deg, var(--primary) 0px, var(--primary) 2px, transparent 2px, transparent 5px)',
                        }}
                      />
                    )}
                    {isDebtor && extraW > 0 && (
                      <div
                        className="h-full border-y border-r border-dashed border-primary/70"
                        style={{ width: `${extraW}%` }}
                      />
                    )}
                    {/* this person's own fair-share line (what they level to) */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-foreground/70"
                      style={{ left: `calc(${sharePct}% - 1px)` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                    {t('wallet.settlePaid')}: {formatCurrency(toDisplay(paid), baseCurrency)} · {fmtCzk(paid)}
                  </div>
                  {ins.map(s => (
                    <div key={`in-${s.from_user_id}`} className="flex items-center gap-1.5 text-[11px] mt-1">
                      <ArrowRight size={11} className="text-green-600 dark:text-green-400 rotate-180 shrink-0" />
                      <span className="truncate">{s.from_name}</span>
                      <span className="ml-auto tabular-nums font-medium shrink-0">
                        {formatCurrency(toDisplay(s.amount), baseCurrency)} · {fmtCzk(s.amount)}
                      </span>
                    </div>
                  ))}
                  {outs.map(s => (
                    <div key={`out-${s.to_user_id}`} className="flex items-center gap-1.5 text-[11px] mt-1">
                      <ArrowRight size={11} className="text-destructive shrink-0" />
                      <span className="truncate">{s.to_name}</span>
                      <span className="ml-auto tabular-nums font-medium shrink-0">
                        {formatCurrency(toDisplay(s.amount), baseCurrency)} · {fmtCzk(s.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Expense matrix: who paid what, per category, with filters ──

const SELECT_CLS = 'h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function ExpenseMatrix({
  paidMatrix, costMatrix, expenses, settlements, toDisplay, baseCurrency, categoryLabel, t,
}: {
  paidMatrix: MatrixData;
  costMatrix?: MatrixData;
  expenses?: ExpenseItem[];
  settlements?: OweRow[];
  toDisplay: (eur: number) => number;
  baseCurrency: string;
  categoryLabel: (c: string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [mode, setMode] = useState<'paid' | 'cost'>('paid');
  const [person, setPerson] = useState<number | 'all'>('all');
  const [category, setCategory] = useState<string>('all');

  const matrix = mode === 'cost' && costMatrix ? costMatrix : paidMatrix;

  const cols = useMemo(
    () => (category === 'all' ? matrix.categories : matrix.categories.filter(c => c === category)),
    [matrix.categories, category],
  );
  const rows = useMemo(
    () => (person === 'all' ? matrix.rows : matrix.rows.filter(r => r.paid_by === person)),
    [matrix.rows, person],
  );

  // Totals recomputed over the *visible* cells
  const colTotals = cols.map(c => rows.reduce((s, r) => s + (r.byCat[c] ?? 0), 0));
  const rowTotal = (r: MatrixRow) => cols.reduce((s, c) => s + (r.byCat[c] ?? 0), 0);
  const grand = colTotals.reduce((s, v) => s + v, 0);
  const cell = (v: number) => (v > 0 ? formatCurrency(toDisplay(v), baseCurrency) : '—');

  // Item-by-item drill-down for the selected person
  const selectedName = person === 'all' ? '' : (matrix.rows.find(r => r.paid_by === person)?.name ?? '');
  const drillItems = useMemo(() => {
    if (person === 'all' || !expenses) return [];
    const inCat = (c: string) => category === 'all' || c === category;
    const items = mode === 'cost'
      ? expenses
          .filter(e => (e.split_amounts?.[person] ?? 0) > 0 && inCat(e.category))
          .map(e => ({ id: e.id, description: e.description, by: e.paid_by_name, category: e.category, date: e.expense_date, amount: e.split_amounts[person] }))
      : expenses
          .filter(e => e.paid_by === person && inCat(e.category))
          .map(e => ({ id: e.id, description: e.description, by: e.paid_by_name, category: e.category, date: e.expense_date, amount: e.amount_eur }));
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [person, mode, category, expenses]);

  // Settlement perspective for the selected person
  const outgoing = person === 'all' ? [] : (settlements ?? []).filter(s => s.from_user_id === person);
  const incoming = person === 'all' ? [] : (settlements ?? []).filter(s => s.to_user_id === person);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Table2 size={13} /> {mode === 'cost' ? t('wallet.matrixTitleCost') : t('wallet.matrixTitle')}
          </h3>
          {costMatrix && (
            <div className="flex rounded-md border border-border p-0.5 bg-muted/50 text-xs">
              <button
                className={cn('px-2.5 py-1 rounded cursor-pointer border-none', mode === 'paid' ? 'bg-background shadow-sm font-medium' : 'bg-transparent text-muted-foreground')}
                onClick={() => setMode('paid')}
              >{t('wallet.matrixModePaid')}</button>
              <button
                className={cn('px-2.5 py-1 rounded cursor-pointer border-none', mode === 'cost' ? 'bg-background shadow-sm font-medium' : 'bg-transparent text-muted-foreground')}
                onClick={() => setMode('cost')}
              >{t('wallet.matrixModeCost')}</button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">{mode === 'cost' ? t('wallet.matrixHintCost') : t('wallet.matrixHintPaid')}</p>
        <div className="flex gap-2 mb-3">
          <select className={SELECT_CLS} value={person} onChange={e => setPerson(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">{t('wallet.matrixAllPeople')}</option>
            {matrix.rows.map(r => <option key={r.paid_by} value={r.paid_by}>{r.name}</option>)}
          </select>
          <select className={SELECT_CLS} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="all">{t('wallet.matrixAllCategories')}</option>
            {matrix.categories.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-collapse text-sm" style={{ minWidth: cols.length > 3 ? 520 : undefined }}>
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium py-2 pr-3 sticky left-0 bg-card">{t('wallet.name')}</th>
                {cols.map(c => (
                  <th key={c} className="text-right font-medium py-2 px-2 whitespace-nowrap">{categoryLabel(c)}</th>
                ))}
                <th className="text-right font-semibold py-2 pl-2">{t('wallet.matrixTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.paid_by} className="border-t border-border">
                  <td className="py-2 pr-3 sticky left-0 bg-card">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avi name={r.name} avatar={r.avatar} userId={r.paid_by} />
                      <span className="truncate">{r.name}</span>
                    </div>
                  </td>
                  {cols.map(c => (
                    <td key={c} className="text-right py-2 px-2 tabular-nums whitespace-nowrap">{cell(r.byCat[c] ?? 0)}</td>
                  ))}
                  <td className="text-right py-2 pl-2 font-semibold tabular-nums whitespace-nowrap">{cell(rowTotal(r))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2 pr-3 sticky left-0 bg-card">{t('wallet.totalSpent')}</td>
                {colTotals.map((v, i) => (
                  <td key={cols[i]} className="text-right py-2 px-2 tabular-nums whitespace-nowrap">{cell(v)}</td>
                ))}
                <td className="text-right py-2 pl-2 tabular-nums whitespace-nowrap">{cell(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Settlement perspective for the selected person (with avatars) */}
        {person !== 'all' && (outgoing.length > 0 || incoming.length > 0) && (
          <div className="mt-4 pt-3 border-t border-border space-y-3">
            {outgoing.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-2">{t('wallet.willPay', { name: selectedName })}</h4>
                <div className="flex flex-col gap-1.5">
                  {outgoing.map(s => (
                    <div key={`o-${s.to_user_id}`} className="flex items-center gap-2.5 text-sm">
                      <ArrowRight size={14} className="text-destructive shrink-0" />
                      <Avi name={s.to_name} avatar={s.to_avatar} userId={s.to_user_id} />
                      <span className="font-medium truncate">{s.to_name}</span>
                      <span className="ml-auto font-bold tabular-nums text-destructive shrink-0">{formatCurrency(toDisplay(s.amount), baseCurrency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {incoming.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-2">{t('wallet.willReceive', { name: selectedName })}</h4>
                <div className="flex flex-col gap-1.5">
                  {incoming.map(s => (
                    <div key={`i-${s.from_user_id}`} className="flex items-center gap-2.5 text-sm">
                      <Avi name={s.from_name} avatar={s.from_avatar} userId={s.from_user_id} />
                      <span className="font-medium truncate">{s.from_name}</span>
                      <ArrowRight size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                      <span className="ml-auto font-bold tabular-nums text-green-600 dark:text-green-400 shrink-0">{formatCurrency(toDisplay(s.amount), baseCurrency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Item-by-item drill-down for the selected person */}
        {person !== 'all' && drillItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold mb-2">
              {mode === 'cost' ? t('wallet.drillCost', { name: selectedName }) : t('wallet.drillPaid', { name: selectedName })}
            </h4>
            <div className="flex flex-col divide-y divide-border">
              {drillItems.map(it => (
                <div key={it.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{it.description}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDate(it.date)} · {categoryLabel(it.category)}
                      {mode === 'cost' ? ` · ${t('wallet.drillPaidBy')}: ${it.by}` : ''}
                    </div>
                  </div>
                  <span className="tabular-nums shrink-0 font-medium">{formatCurrency(toDisplay(it.amount), baseCurrency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main overview ──

export function WalletOverview({
  data, expenses, toDisplay, baseCurrency, categoryLabel, t,
}: {
  data: SummaryData | null;
  expenses?: ExpenseItem[];
  toDisplay: (eur: number) => number;
  baseCurrency: string;
  categoryLabel: (c: string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!data || data.summary.count === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <PieChart size={48} className="opacity-30 mx-auto mb-3" />
        <p>{t('wallet.noExpenses')}</p>
      </div>
    );
  }

  const { summary, by_category, by_payer, settlements } = data;

  const stat = (icon: React.ReactNode, label: string, value: string) => (
    <Card className="py-0">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">{icon}<span className="text-[11px] font-medium uppercase tracking-wide">{label}</span></div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stat(<Receipt size={13} />, t('wallet.totalSpent'), formatCurrency(toDisplay(summary.total), baseCurrency))}
        {stat(<TrendingUp size={13} />, t('wallet.overviewAvg'), formatCurrency(toDisplay(summary.avgPerExpense), baseCurrency))}
        {stat(<Receipt size={13} />, t('wallet.expenses'), String(summary.count))}
      </div>

      {/* Category donut */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <PieChart size={13} /> {t('wallet.overviewByCategory')}
          </h3>
          <Donut slices={by_category} toDisplay={toDisplay} baseCurrency={baseCurrency} categoryLabel={categoryLabel} />
        </CardContent>
      </Card>

      {/* Per-person settlement chart — paid bars + fair-share line + who pays whom */}
      {by_payer.length > 0 && (
        <SettlementChart
          payers={by_payer}
          settlements={settlements}
          toDisplay={toDisplay}
          baseCurrency={baseCurrency}
          t={t}
        />
      )}

      {/* Cost per boat */}
      {data.by_boat && data.by_boat.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Ship size={13} /> {t('wallet.byBoat')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.by_boat.map(b => (
                <div key={b.boat_id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{b.boat_name}</span>
                    <span className="text-xs text-muted-foreground">{t('wallet.boatMembers', { count: b.members })}</span>
                  </div>
                  <div className="text-xl font-bold tabular-nums mt-1">{formatCurrency(toDisplay(b.cost), baseCurrency)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t('wallet.boatPerPerson')}: {formatCurrency(toDisplay(b.members > 0 ? b.cost / b.members : 0), baseCurrency)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-person × category matrix with filters + Paid/Cost toggle */}
      {data.matrix && data.matrix.rows.length > 0 && (
        <ExpenseMatrix
          paidMatrix={data.matrix}
          costMatrix={data.matrix_cost}
          expenses={expenses}
          settlements={data.settlements}
          toDisplay={toDisplay}
          baseCurrency={baseCurrency}
          categoryLabel={categoryLabel}
          t={t}
        />
      )}

    </motion.div>
  );
}
