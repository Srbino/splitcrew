import { getSession, requireCsrf } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { hashPassword } from '@/lib/bcrypt';

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

    return apiSuccess({
      trip_name: tripName,
      trip_date_from: tripDateFrom,
      trip_date_to: tripDateTo,
      base_currency: baseCurrency,
      language,
      member_password: '********',
      admin_password: '********',
    });
  } catch (err) {
    console.error('Admin settings GET error:', err);
    return apiError('Server error', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();

    // Handle password change
    if (body.action === 'change_password') {
      const { type, password } = body;
      if (!type || !password) {
        return apiError('Password type and value are required.');
      }
      if (type !== 'admin' && type !== 'member') {
        return apiError('Invalid password type. Must be admin or member.');
      }
      if (password.length < 4) {
        return apiError('Password must be at least 4 characters.');
      }

      const hash = await hashPassword(password);
      const settingKey = type === 'admin' ? 'admin_password' : 'member_password';
      await setSetting(settingKey, hash);

      return apiSuccess({ message: `${type} password updated.` });
    }

    // Handle settings update
    if (body.settings) {
      const { trip_name, trip_date_from, trip_date_to, base_currency, language } = body.settings;

      if (trip_name !== undefined) await setSetting('trip_name', trip_name);
      if (trip_date_from !== undefined) await setSetting('trip_date_from', trip_date_from);
      if (trip_date_to !== undefined) await setSetting('trip_date_to', trip_date_to);
      if (base_currency !== undefined) await setSetting('base_currency', base_currency);
      if (language !== undefined) await setSetting('language', language);

      return apiSuccess({ message: 'Settings updated.' });
    }

    return apiError('Invalid request.');
  } catch (err) {
    console.error('Admin settings POST error:', err);
    return apiError('Server error', 500);
  }
}
