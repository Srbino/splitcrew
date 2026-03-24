import { requireAuth, readCsrfToken } from '@/lib/auth';
import { getUserById, getSetting } from '@/lib/db';
import { query } from '@/lib/db';
import { AppShell } from '@/components/layout/app-shell';
import { ToastProvider } from '@/components/shared/toast';
import { I18nProvider } from '@/lib/i18n/context';
import { ensureTodayRates } from '@/lib/exchange';
import { parseAllowedCurrencies } from '@/lib/currencies';
import type { LocaleCode } from '@/lib/i18n';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const csrfToken = await readCsrfToken();

  // Get app settings
  const locale = (await getSetting('language', 'en')) as LocaleCode;
  const baseCurrency = await getSetting('base_currency', 'EUR');

  // Get trip info for topbar
  const tripName = await getSetting('trip_name', 'SplitCrew');
  const tripFrom = await getSetting('trip_date_from', '');
  const tripTo = await getSetting('trip_date_to', '');
  const appIcon = await getSetting('app_icon', '⛵');
  const allowedCurrenciesJson = await getSetting('allowed_currencies', `["${baseCurrency}"]`);
  const allowedCurrencies = parseAllowedCurrencies(allowedCurrenciesJson, baseCurrency);

  // Auto-refresh today's exchange rates (non-blocking, always EUR-based)
  ensureTodayRates('EUR').catch(() => {});

  // Get user info
  let userName = session.userName || 'Guest';
  let userAvatar: string | null = null;
  let boatId = session.boatId || 0;
  let boatName = '';

  if (session.userId) {
    const user = await getUserById(session.userId);
    if (user) {
      userName = user.name;
      userAvatar = user.avatar;
      boatId = user.boat_id;
    }
  }

  // Get boat name
  if (boatId) {
    const boat = await query<{ name: string }>(
      'SELECT name FROM boats WHERE id = $1',
      [boatId]
    );
    boatName = boat[0]?.name || '';
  }

  // Compute trip status server-side (accurate server time)
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  let tripStatus: 'before' | 'during' | 'after' | 'none' = 'none';
  let tripDayLabel = '';

  if (tripFrom && tripTo) {
    const start = new Date(tripFrom + 'T00:00:00');
    const end = new Date(tripTo + 'T23:59:59');

    if (now < start) {
      const daysLeft = Math.ceil((start.getTime() - now.getTime()) / 86400000);
      tripStatus = 'before';
      tripDayLabel = daysLeft === 1 ? '1 day to go' : `${daysLeft} days to go`;
    } else if (now > end) {
      tripStatus = 'after';
      tripDayLabel = 'Trip completed';
    } else {
      const dayNumber = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
      tripStatus = 'during';
      tripDayLabel = `Day ${dayNumber} of ${totalDays}`;
    }
  }

  // Fetch today's lunch for topbar quick info
  let todayMeal = '';
  try {
    const mealRow = await query<{ meal_description: string | null; cook_name: string | null }>(
      `SELECT mp.meal_description, u.name as cook_name
       FROM menu_plan mp LEFT JOIN users u ON mp.cook_user_id = u.id
       WHERE mp.date = CURRENT_DATE AND mp.meal_type = 'lunch'
       ORDER BY mp.boat_id LIMIT 1`
    );
    if (mealRow[0]) {
      const desc = mealRow[0].meal_description || 'Lunch';
      const cook = mealRow[0].cook_name;
      todayMeal = cook ? `${desc} (${cook})` : desc;
    }
  } catch { /* non-critical */ }

  return (
    <I18nProvider locale={locale}>
      <ToastProvider>
        <AppShell
          user={{
            id: session.userId || 0,
            name: userName,
            avatar: userAvatar,
            boatId,
            boatName,
            isAdmin: session.isAdmin,
          }}
          trip={{
            name: tripName || 'SplitCrew',
            dateFrom: tripFrom,
            dateTo: tripTo,
            appIcon,
            status: tripStatus,
            dayLabel: tripDayLabel,
            todayMeal,
          }}
          csrfToken={csrfToken}
          baseCurrency={baseCurrency}
          allowedCurrencies={allowedCurrencies}
        >
          {children}
        </AppShell>
      </ToastProvider>
    </I18nProvider>
  );
}
