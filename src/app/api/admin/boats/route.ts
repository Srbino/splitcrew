import { getSession, requireCsrf } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isAdmin) {
      return apiError('Unauthorized', 401);
    }

    const boats = await query<{
      id: number; name: string; emoji: string; color: string;
      description: string | null; crew_count: string;
    }>(
      `SELECT b.id, b.name, COALESCE(b.emoji, '⛵') as emoji,
              COALESCE(b.color, 'blue') as color, b.description,
              (SELECT COUNT(*) FROM users u WHERE u.boat_id = b.id) AS crew_count
       FROM boats b ORDER BY b.id`
    );

    return apiSuccess({
      boats: boats.map(b => ({
        id: b.id,
        name: b.name,
        emoji: b.emoji,
        color: b.color,
        description: b.description,
        crew_count: parseInt(b.crew_count, 10),
      })),
    });
  } catch (err) {
    console.error('Admin boats GET error:', err);
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
      const { name, emoji, color } = body;
      if (!name?.trim()) {
        return apiError('Boat name is required.');
      }

      const result = await query<{ id: number }>(
        'INSERT INTO boats (name, emoji, color) VALUES ($1, $2, $3) RETURNING id',
        [name.trim(), emoji || '⛵', color || 'blue']
      );

      return apiSuccess({ id: result[0]?.id });
    }

    if (action === 'edit') {
      const { id, name, emoji, color } = body;
      if (!id || !name?.trim()) {
        return apiError('Boat ID and name are required.');
      }

      await execute(
        'UPDATE boats SET name = $1, emoji = $2, color = $3 WHERE id = $4',
        [name.trim(), emoji || '⛵', color || 'blue', id]
      );

      return apiSuccess();
    }

    // Legacy: simple rename
    if (action === 'rename') {
      const { id, name } = body;
      if (!id || !name?.trim()) {
        return apiError('Boat ID and name are required.');
      }
      await execute('UPDATE boats SET name = $1 WHERE id = $2', [name.trim(), id]);
      return apiSuccess();
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return apiError('Boat ID is required.');

      // Check if any users are assigned to this boat
      const userCheck = await queryOne<{ count: string }>(
        'SELECT COUNT(*) AS count FROM users WHERE boat_id = $1',
        [id]
      );
      if (parseInt(userCheck?.count || '0', 10) > 0) {
        return apiError('Cannot delete boat with assigned crew members. Reassign them first.');
      }

      // Check for related data
      const dataCheck = await queryOne<{ count: string }>(
        `SELECT (
          (SELECT COUNT(*) FROM shopping_items WHERE boat_id = $1) +
          (SELECT COUNT(*) FROM logbook WHERE boat_id = $1) +
          (SELECT COUNT(*) FROM menu_plan WHERE boat_id = $1)
        ) AS count`,
        [id]
      );
      if (parseInt(dataCheck?.count || '0', 10) > 0) {
        return apiError('Cannot delete boat with existing data (shopping, logbook, or meals). Remove the data first.');
      }

      await execute('DELETE FROM boats WHERE id = $1', [id]);
      return apiSuccess();
    }

    return apiError('Invalid action.');
  } catch (err) {
    console.error('Admin boats POST error:', err);
    return apiError('Server error', 500);
  }
}
