import { getSession } from '@/lib/auth';
import { getSetting, getUserById } from '@/lib/db';
import { queryOne } from '@/lib/db';
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

      // Get user with password hash
      const user = await queryOne<{
        id: number; name: string; boat_id: number; password_hash: string | null; role: string;
      }>(
        'SELECT id, name, boat_id, password_hash, COALESCE(role, \'crew\') as role FROM users WHERE id = $1',
        [user_id]
      );

      if (!user) {
        return apiError('User not found.');
      }

      // Check per-user password
      if (!user.password_hash) {
        // User has no password set — admin needs to set one
        return apiError('No password set for this account. Contact admin.');
      }

      if (!(await compare(password, user.password_hash))) {
        session.loginAttempts = (session.loginAttempts ?? 0) + 1;
        session.loginLastAttempt = now;
        await session.save();
        return apiError('Incorrect password.');
      }

      session.loginAttempts = undefined;
      session.loginLastAttempt = undefined;
      session.userId = user.id;
      session.userName = user.name;
      session.boatId = user.boat_id;
      session.role = (user.role === 'captain' ? 'captain' : 'crew') as 'crew' | 'captain';
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
