import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute, getAllUsers } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

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
      const { name, phone, email, boat_id } = body;
      if (!name || !boat_id) {
        return apiError('Name and boat are required.');
      }

      await execute(
        'INSERT INTO users (name, phone, email, boat_id) VALUES ($1, $2, $3, $4)',
        [name, phone || null, email || null, boat_id]
      );

      return apiSuccess();
    }

    if (action === 'edit') {
      const { id, name, phone, email, boat_id } = body;
      if (!id || !name || !boat_id) {
        return apiError('ID, name, and boat are required.');
      }

      await execute(
        'UPDATE users SET name = $1, phone = $2, email = $3, boat_id = $4 WHERE id = $5',
        [name, phone || null, email || null, boat_id, id]
      );

      return apiSuccess();
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('User ID is required.');

      // Check if user has expenses
      const expenseCheck = await queryOne<{ count: string }>(
        'SELECT COUNT(*) AS count FROM wallet_expenses WHERE paid_by = $1',
        [id]
      );
      if (parseInt(expenseCheck?.count || '0', 10) > 0) {
        return apiError('Cannot delete user with existing expenses. Remove their expenses first.');
      }

      // Delete related records
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
