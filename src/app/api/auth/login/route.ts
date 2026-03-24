import { getSession } from '@/lib/auth';
import { getSetting, getUserById } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { compare } from '@/lib/bcrypt';

/** Generate a random hex CSRF token */
function newCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { login_type, user_id, password } = body;

    const session = await getSession();

    // Rate limiting
    const now = Math.floor(Date.now() / 1000);
    const lastAttempt = session.loginLastAttempt ?? 0;

    if (now - lastAttempt > 900) {
      session.loginAttempts = 0;
    }

    if ((session.loginAttempts ?? 0) >= 10) {
      const waitMin = Math.ceil((900 - (now - lastAttempt)) / 60);
      await session.save();
      return apiError(`Too many attempts. Try again in ${waitMin} min.`, 429);
    }

    if (login_type === 'admin') {
      const adminHash = await getSetting('admin_password', '');
      if (!adminHash || !(await compare(password, adminHash))) {
        session.loginAttempts = (session.loginAttempts ?? 0) + 1;
        session.loginLastAttempt = now;
        await session.save();
        return apiError('Incorrect admin password.');
      }

      // Success — generate CSRF token here (Route Handler can modify cookies)
      session.loginAttempts = undefined;
      session.loginLastAttempt = undefined;
      session.isAdmin = true;
      session.userName = 'Administrator';
      session.lastActivity = now;
      session.csrfToken = newCsrfToken();
      await session.save();
      return apiSuccess({ redirect: '/admin' });
    }

    if (login_type === 'member') {
      if (!user_id || user_id <= 0) {
        return apiError('Select your name.');
      }

      const memberHash = await getSetting('member_password', '');
      if (!memberHash || !(await compare(password, memberHash))) {
        session.loginAttempts = (session.loginAttempts ?? 0) + 1;
        session.loginLastAttempt = now;
        await session.save();
        return apiError('Incorrect password.');
      }

      const user = await getUserById(user_id);
      if (!user) {
        return apiError('User not found.');
      }

      // Success — generate CSRF token here
      session.loginAttempts = undefined;
      session.loginLastAttempt = undefined;
      session.userId = user.id;
      session.userName = user.name;
      session.boatId = user.boat_id;
      session.isAdmin = false;
      session.lastActivity = now;
      session.csrfToken = newCsrfToken();
      await session.save();
      return apiSuccess({ redirect: '/dashboard' });
    }

    return apiError('Invalid login type.');
  } catch (err) {
    console.error('Login error:', err);
    return apiError('Server error', 500);
  }
}
