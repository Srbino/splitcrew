import { requireAuth } from '@/lib/auth';
import { query, getSetting } from '@/lib/db';
import { formatMoney, formatDate, cn, getInitials, avatarColorClass } from '@/lib/utils';
import { formatCurrency } from '@/lib/currencies';
import { t } from '@/lib/i18n';
import { AnimatedPage } from '@/components/shared/animations';
import {
  Wallet, Users, Ship, Calendar, ShoppingCart, Navigation,
  Utensils, MapPin, ArrowRight, Receipt, Anchor, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
  const session = await requireAuth();
  const userId = session.userId || null;
  const userName = session.userName || 'Sailor';
  const isAdmin = session.isAdmin;

  // ── Data fetching ──

  const tripName = await getSetting('trip_name', 'Voyage');
  const tripFrom = await getSetting('trip_date_from', '');
  const tripTo = await getSetting('trip_date_to', '');
  const baseCurrency = await getSetting('base_currency', 'EUR');
  const locale = await getSetting('language', 'en');

  // User balance (members only)
  let paid = 0, owed = 0, balance = 0;
  if (userId) {
    const [paidRes, owedRes] = await Promise.all([
      query<{ total: string }>('SELECT COALESCE(SUM(amount_eur),0) as total FROM wallet_expenses WHERE paid_by=$1', [userId]),
      query<{ total: string }>('SELECT COALESCE(SUM(amount_eur),0) as total FROM wallet_expense_splits WHERE user_id=$1', [userId]),
    ]);
    paid = parseFloat(paidRes[0]?.total || '0');
    owed = parseFloat(owedRes[0]?.total || '0');
    balance = paid - owed;
  }

  // Total spent + count
  const totalResult = await query<{ total: string; count: string }>(
    'SELECT COALESCE(SUM(amount_eur),0) as total, COUNT(*) as count FROM wallet_expenses'
  );
  const totalSpent = parseFloat(totalResult[0]?.total || '0');
  const expenseTotal = parseInt(totalResult[0]?.count || '0');

  // Crew counts
  const boatCounts = await query<{ boat_id: number; name: string; count: string }>(
    `SELECT u.boat_id, b.name, COUNT(*) as count
     FROM users u LEFT JOIN boats b ON u.boat_id = b.id
     GROUP BY u.boat_id, b.name ORDER BY u.boat_id`
  );
  const totalCrew = boatCounts.reduce((sum, bc) => sum + parseInt(bc.count), 0);

  // Recent expenses (last 5)
  const recentExpenses = await query<{
    id: number; description: string; amount: number; currency: string;
    amount_eur: number; paid_by_name: string; paid_by_avatar: string | null;
    paid_by: number; created_at: string;
  }>(
    `SELECT e.id, e.description, e.amount, e.currency, e.amount_eur,
            u.name as paid_by_name, u.avatar as paid_by_avatar, e.paid_by, e.created_at
     FROM wallet_expenses e JOIN users u ON e.paid_by = u.id
     ORDER BY e.created_at DESC LIMIT 5`
  );

  // Shopping progress
  const shoppingStats = await query<{ total: string; bought: string }>(
    `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_bought) as bought FROM shopping_items`
  );
  const shopTotal = parseInt(shoppingStats[0]?.total || '0');
  const shopBought = parseInt(shoppingStats[0]?.bought || '0');
  const shopPercent = shopTotal > 0 ? Math.round((shopBought / shopTotal) * 100) : 0;

  // Sailing stats
  const sailingStats = await query<{ total_nm: string; total_days: string }>(
    `SELECT COALESCE(SUM(nautical_miles),0) as total_nm, COUNT(*) as total_days FROM logbook`
  );
  const totalNm = parseFloat(sailingStats[0]?.total_nm || '0');
  const totalDays = parseInt(sailingStats[0]?.total_days || '0');

  // Today's meals
  const todayMeals = await query<{
    meal_type: string; meal_description: string | null;
    cook_name: string | null; cook_avatar: string | null; cook_user_id: number | null;
    boat_name: string;
  }>(
    `SELECT mp.meal_type, mp.meal_description, u.name as cook_name,
            u.avatar as cook_avatar, mp.cook_user_id, b.name as boat_name
     FROM menu_plan mp LEFT JOIN users u ON mp.cook_user_id = u.id
     LEFT JOIN boats b ON mp.boat_id = b.id
     WHERE mp.date = CURRENT_DATE
     ORDER BY mp.boat_id,
       CASE mp.meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 ELSE 4 END`
  );

  // Next itinerary stop
  const nextStop = await query<{
    title: string; date: string; location_from: string | null;
    location_to: string | null; type: string;
  }>(
    `SELECT title, date, location_from, location_to, type
     FROM itinerary WHERE date >= CURRENT_DATE ORDER BY date, sort_order LIMIT 1`
  );

  // ── Helpers ──

  let daysText = '';
  if (tripFrom) {
    const diff = Math.ceil((new Date(tripFrom).getTime() - Date.now()) / 86400000);
    if (diff > 1) daysText = t(locale, 'dashboard.daysToGo', { days: diff });
    else if (diff === 1) daysText = t(locale, 'dashboard.oneDayToGo');
    else if (diff === 0) daysText = t(locale, 'dashboard.startsToday');
    else daysText = t(locale, 'dashboard.underway');
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t(locale, 'dashboard.goodMorning') : hour < 17 ? t(locale, 'dashboard.goodAfternoon') : t(locale, 'dashboard.goodEvening');

  function timeAgo(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days}d ago` : formatDate(dateStr);
  }

  const mealLabel: Record<string, string> = {
    breakfast: t(locale, 'menu.mealTypes.breakfast'),
    lunch: t(locale, 'menu.mealTypes.lunch'),
    dinner: t(locale, 'menu.mealTypes.dinner'),
    snack: t(locale, 'menu.mealTypes.snack'),
  };

  // ── Render ──

  return (
    <AnimatedPage className="space-y-5">

      {/* ── Header ── */}
      <div>
        <p className="text-sm text-muted-foreground">{greeting}, {userId ? userName : 'Admin'}</p>
        <h1 className="text-2xl font-bold tracking-tight mt-0.5">{tripName}</h1>
        <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
          {daysText && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-semibold text-xs">
              {daysText}
            </Badge>
          )}
          {tripFrom && tripTo && (
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <Calendar size={12} />
              {tripFrom} — {tripTo}
            </span>
          )}
          <span className="text-muted-foreground text-xs flex items-center gap-1">
            <Users size={12} />
            {totalCrew} {t(locale, 'crews.crew')} · {boatCounts.map(b => b.name).join(' & ')}
          </span>
        </div>
      </div>

      {/* ── Row 1: Balance + Total Spent — always side-by-side ── */}
      <div className="grid gap-3 grid-cols-2">
        {/* Balance (members) or Crew overview (admin) */}
        {userId ? (
          <Link href="/wallet" className="no-underline">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    balance >= 0 ? 'bg-success-subtle' : 'bg-danger-subtle',
                  )}>
                    <Wallet size={16} className={balance >= 0 ? 'text-success' : 'text-destructive'} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{t(locale, 'dashboard.yourBalance')}</span>
                </div>
                <div className={cn(
                  'text-xl sm:text-2xl font-bold tracking-tight tabular-nums',
                  balance >= 0 ? 'text-success' : 'text-destructive',
                )}>
                  {balance >= 0 ? '+' : ''}{formatCurrency(balance, baseCurrency)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex gap-2">
                  <span>{t(locale, 'dashboard.paid')} {formatCurrency(paid, baseCurrency)}</span>
                  <span>·</span>
                  <span>{t(locale, 'dashboard.owes')} {formatCurrency(owed, baseCurrency)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-info-subtle flex items-center justify-center">
                  <Users size={16} className="text-info" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{t(locale, 'dashboard.crew')}</span>
              </div>
              <div className="space-y-1">
                {boatCounts.map(bc => (
                  <div key={bc.boat_id} className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Ship size={13} /> {bc.name}
                    </span>
                    <strong>{bc.count}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Total Spent */}
        <Link href="/wallet" className="no-underline">
          <Card className="h-full hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Receipt size={16} className="text-primary" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{t(locale, 'dashboard.totalSpent')}</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
                {formatCurrency(totalSpent, baseCurrency)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {expenseTotal} {t(locale, 'dashboard.expenses')} · {totalCrew} {t(locale, 'crews.crew')}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Row 2: Recent Expenses ── */}
      {recentExpenses.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t(locale, 'dashboard.recentExpenses')}</h2>
              <Link href="/wallet" className="text-xs text-primary font-medium no-underline hover:underline">
                {t(locale, 'common.viewAll')}
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentExpenses.map(exp => {
                const src = exp.paid_by_avatar
                  ? (exp.paid_by_avatar.startsWith('data:') || exp.paid_by_avatar.startsWith('http') ? exp.paid_by_avatar : `/${exp.paid_by_avatar}`)
                  : null;
                const converted = exp.currency !== baseCurrency;
                return (
                  <div key={exp.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      {src && <AvatarImage src={src} alt={exp.paid_by_name} />}
                      <AvatarFallback className={cn('text-[9px] font-semibold', avatarColorClass(exp.paid_by))}>
                        {getInitials(exp.paid_by_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{exp.description}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {exp.paid_by_name} · {timeAgo(exp.created_at)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-semibold tabular-nums">
                        {converted ? formatCurrency(exp.amount, exp.currency) : formatCurrency(exp.amount_eur, baseCurrency)}
                      </div>
                      {converted && (
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {formatCurrency(exp.amount_eur, baseCurrency)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Row 3: Today's Meals + Next Stop ── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {/* Today's Meals */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-warning-subtle flex items-center justify-center">
                <Utensils size={14} className="text-warning" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{t(locale, 'dashboard.todaysMeals')}</span>
              <Link href="/menu" className="ml-auto text-[11px] text-primary font-medium no-underline hover:underline">
                {t(locale, 'common.plan')}
              </Link>
            </div>
            {todayMeals.length > 0 ? (
              <div className="space-y-1.5">
                {todayMeals.map((meal, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] min-w-[60px] justify-center py-0.5">
                      {mealLabel[meal.meal_type] || meal.meal_type}
                    </Badge>
                    <span className="text-[13px] truncate flex-1">
                      {meal.meal_description || '—'}
                    </span>
                    {meal.cook_name && (
                      <span className="text-[11px] text-muted-foreground shrink-0">{meal.cook_name}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">{t(locale, 'dashboard.noMealsToday')}</p>
            )}
          </CardContent>
        </Card>

        {/* Next Itinerary Stop */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-info-subtle flex items-center justify-center">
                <MapPin size={14} className="text-info" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{t(locale, 'dashboard.nextStop')}</span>
              <Link href="/itinerary" className="ml-auto text-[11px] text-primary font-medium no-underline hover:underline">
                {t(locale, 'common.view')}
              </Link>
            </div>
            {nextStop.length > 0 ? (
              <div>
                <div className="text-[13px] font-semibold">{nextStop[0].title}</div>
                {(nextStop[0].location_from || nextStop[0].location_to) && (
                  <div className="flex items-center gap-1 text-[13px] text-muted-foreground mt-0.5">
                    {nextStop[0].location_from}
                    {nextStop[0].location_from && nextStop[0].location_to && <ArrowRight size={11} />}
                    {nextStop[0].location_to}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar size={10} />
                  {formatDate(nextStop[0].date)}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">{t(locale, 'dashboard.noUpcomingStops')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Sailing Stats + Shopping Progress ── */}
      <div className="grid gap-3 grid-cols-2">
        {/* Sailing Stats */}
        <Link href="/logbook" className="no-underline">
          <Card className="h-full hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Navigation size={14} className="text-primary" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{t(locale, 'dashboard.sailing')}</span>
              </div>
              {totalDays > 0 ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-primary tabular-nums">{totalNm}</span>
                    <span className="text-xs text-muted-foreground">NM</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {totalDays} {totalDays === 1 ? t(locale, 'dashboard.entry') : t(locale, 'dashboard.entries')}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Anchor size={14} className="opacity-40" />
                  {t(locale, 'dashboard.noEntriesYet')}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Shopping Progress */}
        <Link href="/shopping" className="no-underline">
          <Card className="h-full hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-success-subtle flex items-center justify-center">
                  <ShoppingCart size={14} className="text-success" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{t(locale, 'nav.shopping')}</span>
              </div>
              {shopTotal > 0 ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold tabular-nums">{shopBought}</span>
                    <span className="text-xs text-muted-foreground">/ {shopTotal}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-success transition-all duration-500"
                      style={{ width: `${shopPercent}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {shopTotal - shopBought} {t(locale, 'common.remaining')}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">{t(locale, 'common.noData')}</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Quick Actions ── */}
      <div className="flex gap-2 pt-1">
        <Button asChild size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-none">
          <Link href="/wallet"><Plus size={14} /> {t(locale, 'dashboard.expense')}</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-none">
          <Link href="/shopping"><ShoppingCart size={14} /> {t(locale, 'nav.shopping')}</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-none">
          <Link href="/logbook"><Navigation size={14} /> {t(locale, 'nav.logbook')}</Link>
        </Button>
      </div>
    </AnimatedPage>
  );
}
