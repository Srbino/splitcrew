'use client';

import { motion } from 'framer-motion';
import { ArrowRight, PieChart, Users, Receipt, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn, getInitials, avatarColorClass } from '@/lib/utils';
import { formatCurrency } from '@/lib/currencies';
import { donutSegments, barScale } from '@/lib/wallet-calc';

// ── Types (mirror /api/wallet?action=summary) ──

export interface CategorySlice { category: string; total: number; count: number }
export interface PayerSlice { paid_by: number; total: number; count: number; name: string; avatar: string | null; boat_id: number }
export interface OweRow {
  from_user_id: number; from_name: string; from_avatar: string | null;
  to_user_id: number; to_name: string; to_avatar: string | null;
  amount: number; is_settled: boolean;
}
export interface SummaryData {
  summary: { total: number; count: number; avgPerExpense: number; topCategory: string | null };
  by_category: CategorySlice[];
  by_payer: PayerSlice[];
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

// ── Per-person spend bars ──

function PayerBars({
  payers, toDisplay, baseCurrency,
}: {
  payers: PayerSlice[];
  toDisplay: (eur: number) => number;
  baseCurrency: string;
}) {
  const widths = barScale(payers.map(p => p.total));
  return (
    <div className="space-y-2.5">
      {payers.map((p, i) => (
        <div key={p.paid_by} className="flex items-center gap-3">
          <Avi name={p.name} avatar={p.avatar} userId={p.paid_by} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className="text-sm font-medium truncate">{p.name}</span>
              <span className="text-sm tabular-nums shrink-0">{formatCurrency(toDisplay(p.total), baseCurrency)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${widths[i]}%` }}
                transition={{ duration: 0.5, delay: i * 0.03 }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main overview ──

export function WalletOverview({
  data, toDisplay, baseCurrency, categoryLabel, t,
}: {
  data: SummaryData | null;
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
  const outstanding = settlements.filter(s => !s.is_settled);

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

      {/* Per-person spend */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <Users size={13} /> {t('wallet.overviewByPerson')}
          </h3>
          <PayerBars payers={by_payer} toDisplay={toDisplay} baseCurrency={baseCurrency} />
        </CardContent>
      </Card>

      {/* Who owes whom */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <ArrowRight size={13} /> {t('wallet.overviewWhoOwes')}
          </h3>
          {outstanding.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{t('wallet.allSettledUp')}</p>
          ) : (<>
            <p className="text-xs text-muted-foreground mb-3">{t('wallet.paymentsToSettle', { count: outstanding.length })}</p></>
          )}
          {outstanding.length > 0 && (
            <div className="space-y-2">
              {outstanding.map(s => (
                <div key={`${s.from_user_id}-${s.to_user_id}`} className="flex items-center gap-2.5 text-sm">
                  <Avi name={s.from_name} avatar={s.from_avatar} userId={s.from_user_id} />
                  <span className="font-medium truncate">{s.from_name}</span>
                  <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                  <Avi name={s.to_name} avatar={s.to_avatar} userId={s.to_user_id} />
                  <span className="font-medium truncate">{s.to_name}</span>
                  <span className="ml-auto font-bold tabular-nums text-destructive shrink-0">
                    {formatCurrency(toDisplay(s.amount), baseCurrency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
