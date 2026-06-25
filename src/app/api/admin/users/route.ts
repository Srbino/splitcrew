import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute, getAllUsers } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { hashPassword } from '@/lib/bcrypt';
import { toIban } from '@/lib/czech-payment';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const users = await getAllUsers();
    const boats = await query<{ id: number; name: string }>('SELECT * FROM boats ORDER BY id');

    return apiSuccess({ users, boats });
  } catch (err) {
    console.error('Admin users GET error:', err);
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
    const { action } = body;

    if (action === 'add') {
      const { name, phone, email, boat_id, password, role, bank_account } = body;
      if (!name || !boat_id) {
        return apiError('Name and boat are required.');
      }
      if (!password || password.length < 4) {
        return apiError('Password is required (min 4 characters).');
      }
      const validRole = role === 'captain' ? 'captain' : 'crew';

      const bank = typeof bank_account === 'string' ? bank_account.trim() : '';
      if (bank && !toIban(bank)) {
        return apiError('Neplatné číslo účtu nebo IBAN.');
      }

      const hash = await hashPassword(password);
      await execute(
        'INSERT INTO users (name, phone, email, boat_id, password_hash, role, bank_account) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [name, phone || null, email || null, boat_id, hash, validRole, bank || null]
      );

      return apiSuccess();
    }

    if (action === 'edit') {
      const { id, name, phone, email, boat_id, role, bank_account } = body;
      if (!id || !name || !boat_id) {
        return apiError('ID, name, and boat are required.');
      }
      const validRole = role === 'captain' ? 'captain' : 'crew';

      // bank_account: empty clears it; otherwise must be a valid Czech account / IBAN
      const bank = typeof bank_account === 'string' ? bank_account.trim() : '';
      if (bank && !toIban(bank)) {
        return apiError('Neplatné číslo účtu nebo IBAN.');
      }

      await execute(
        'UPDATE users SET name = $1, phone = $2, email = $3, boat_id = $4, role = $5, bank_account = $6 WHERE id = $7',
        [name, phone || null, email || null, boat_id, validRole, bank || null, id]
      );

      return apiSuccess();
    }

    if (action === 'reset_password') {
      const { id, password } = body;
      if (!id) return apiError('User ID is required.');
      if (!password || password.length < 4) {
        return apiError('Password must be at least 4 characters.');
      }

      const hash = await hashPassword(password);
      await execute(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hash, id]
      );

      return apiSuccess({ message: 'Password reset successfully.' });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('User ID is required.');

      const expenseCheck = await queryOne<{ count: string }>(
        'SELECT COUNT(*) AS count FROM wallet_expenses WHERE paid_by = $1',
        [id]
      );
      if (parseInt(expenseCheck?.count || '0', 10) > 0) {
        return apiError('Cannot delete user with existing expenses. Remove their expenses first.');
      }

      await execute('DELETE FROM wallet_expense_splits WHERE user_id = $1', [id]);
      await execute('DELETE FROM car_passengers WHERE user_id = $1', [id]);
      await execute('DELETE FROM users WHERE id = $1', [id]);

      return apiSuccess();
    }

    return apiError('Invalid action.');
  } catch (err) {
    console.error('Admin users POST error:', err);
    return apiError('Server error', 500);
  }
}
