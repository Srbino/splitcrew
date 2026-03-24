import { getSession, requireCsrf } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { compare, hashPassword } from '@/lib/bcrypt';

/**
 * User self-service password change.
 * Requires current password + new password.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return apiError('Unauthorized', 401);
    }

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return apiError('Current and new password are required.');
    }
    if (new_password.length < 4) {
      return apiError('New password must be at least 4 characters.');
    }

    // Verify current password
    const user = await queryOne<{ password_hash: string | null }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [session.userId]
    );

    if (!user?.password_hash) {
      return apiError('No password set. Contact admin.');
    }

    const isValid = await compare(current_password, user.password_hash);
    if (!isValid) {
      return apiError('Current password is incorrect.');
    }

    // Update password
    const hash = await hashPassword(new_password);
    await execute('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, session.userId]);

    return apiSuccess({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    return apiError('Server error', 500);
  }
}
