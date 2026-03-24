import { getSession, requireCsrf } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { hashPassword, compare } from '@/lib/bcrypt';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const tripName = await getSetting('trip_name', '');
    const tripDateFrom = await getSetting('trip_date_from', '');
    const tripDateTo = await getSetting('trip_date_to', '');
    const baseCurrency = await getSetting('base_currency', 'EUR');
    const language = await getSetting('language', 'en');
    const appIcon = await getSetting('app_icon', '⛵');
    const allowedCurrencies = await getSetting('allowed_currencies', `["${baseCurrency}"]`);
    const exportCurrency = await getSetting('export_currency', baseCurrency);

    let parsedAllowed: string[];
    try {
      parsedAllowed = JSON.parse(allowedCurrencies);
    } catch {
      parsedAllowed = [baseCurrency];
    }

    return apiSuccess({
      trip_name: tripName,
      trip_date_from: tripDateFrom,
      trip_date_to: tripDateTo,
      base_currency: baseCurrency,
      language,
      app_icon: appIcon,
      allowed_currencies: parsedAllowed,
      export_currency: exportCurrency,
    });
  } catch (err) {
    console.error('Admin settings GET error:', err);
    return apiError('Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const isAuth = !!session.userId || !!session.isAdmin;
    if (!isAuth) {
      return apiError('Unauthorized', 401);
    }

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();

    // Non-admin can only change language
    if (!session.isAdmin) {
      if (body.settings?.language) {
        await setSetting('language', body.settings.language);
        return apiSuccess({ message: 'Language updated.' });
      }
      return apiError('Unauthorized', 401);
    }

    // Handle admin password change — requires current password verification
    if (body.action === 'change_password') {
      const { current_password, password } = body;
      if (!password || password.length < 4) {
        return apiError('Password must be at least 4 characters.');
      }

      // Verify current password before allowing change
      const currentHash = await getSetting('admin_password', '');
      if (currentHash && current_password) {
        const isValid = await compare(current_password, currentHash);
        if (!isValid) {
          return apiError('Current password is incorrect.');
        }
      }

      const hash = await hashPassword(password);
      await setSetting('admin_password', hash);

      return apiSuccess({ message: 'Admin password updated.' });
    }

    // Handle settings update (admin only)
    if (body.settings) {
      const { trip_name, trip_date_from, trip_date_to, base_currency, language } = body.settings;

      if (trip_name !== undefined) await setSetting('trip_name', trip_name);
      if (trip_date_from !== undefined) await setSetting('trip_date_from', trip_date_from);
      if (trip_date_to !== undefined) await setSetting('trip_date_to', trip_date_to);
      if (base_currency !== undefined) await setSetting('base_currency', base_currency);
      if (language !== undefined) await setSetting('language', language);
      if (body.settings.app_icon !== undefined) await setSetting('app_icon', body.settings.app_icon);
      if (body.settings.allowed_currencies !== undefined) {
        await setSetting('allowed_currencies', JSON.stringify(body.settings.allowed_currencies));
      }
      if (body.settings.export_currency !== undefined) {
        await setSetting('export_currency', body.settings.export_currency);
      }

      return apiSuccess({ message: 'Settings updated.' });
    }

    return apiError('Invalid request.');
  } catch (err) {
    console.error('Admin settings POST error:', err);
    return apiError('Server error', 500);
  }
}
